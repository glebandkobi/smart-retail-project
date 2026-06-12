terraform {
  required_version = ">= 1.3"

  backend "s3" {
    bucket = "retail-terraform-state-savestates3"
    key    = "dev/terraform.tfstate"
    region = "us-east-1"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

data "aws_availability_zones" "available" {}


# 1. THE NETWORKING LAYER (VPC Setup)

module "eks-vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "retail-cluster-v7-vpc"
  cidr = "10.0.0.0/16"

  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# 2. THE KUBERNETES LAYER (EKS Cluster)

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "retail-cluster-v7"
  cluster_version = "1.30"

  vpc_id                   = module.eks-vpc.vpc_id
  subnet_ids               = module.eks-vpc.private_subnets
  control_plane_subnet_ids = module.eks-vpc.private_subnets

  authentication_mode                      = "API_AND_CONFIG_MAP"
  enable_cluster_creator_admin_permissions = true
  cluster_endpoint_public_access           = true

  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy             = { most_recent = true }
    vpc-cni                = { most_recent = true }
    eks-pod-identity-agent = { most_recent = true }
  }

  eks_managed_node_groups = {
    default = {
      instance_types = ["t3.small"]

      min_size     = 1
      max_size     = 2
      desired_size = 1

      ami_type  = "BOTTLEROCKET_x86_64"
      disk_size = 20
    }
  }

  tags = {
    Environment = "dev"
    Terraform   = "true"
  }
}
# 3. KUBERNETES PROVIDER SETUP
data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}
# 4. THE FRONTEND LOAD BALANCER
resource "kubernetes_service" "factory_frontend_lb" {
  metadata {
    name = "factory-frontend-lb"
  }
  spec {
    selector = {
      app = "factory-frontend"
    }
    port {
      port        = 80
      target_port = 8081
    }
    type = "LoadBalancer"
  }
}
# 5. THE SERVERLESS FRONTEND S3 BUCKET
resource "aws_s3_bucket" "frontend_site" {
  bucket = "smart-retail-frontend-live"
}

resource "aws_s3_bucket_website_configuration" "frontend_config" {
  bucket = aws_s3_bucket.frontend_site.id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "public_access" {
  bucket = aws_s3_bucket.frontend_site.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "allow_public_read" {
  bucket = aws_s3_bucket.frontend_site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend_site.arn}/*"
      },
    ]
  })
}
# 6. RDS DATABASE NETWORKING & SECURITY

resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "retail-rds-subnet-group"
  subnet_ids = module.eks-vpc.private_subnets

  tags = {
    Name = "Retail RDS Subnet Group"
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "retail-rds-sg"
  description = "Allow inbound traffic from the internal VPC network to MySQL"
  vpc_id      = module.eks-vpc.vpc_id

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = [module.eks-vpc.vpc_cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Retail RDS Security Group"
  }
}
# 7. AWS RDS MYSQL DATABASE INSTANCE
resource "aws_db_instance" "retail_mysql" {
  allocated_storage     = 20
  max_allocated_storage = 50 # Auto-enables storage scaling to save hassle
  engine                = "mysql"
  engine_version        = "8.0"
  instance_class        = "db.t3.micro" # Free-tier eligible / cheapest option for dev testing

  db_name  = "smart_retail_db"
  username = "admin"
  password = "RetailSecurePass2026!" # Change this to your preferred password later

  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  skip_final_snapshot = true  # Prevents Terraform from hanging when you destroy it later
  publicly_accessible = false # Completely blocks the internet; only accessible inside the VPC
}
