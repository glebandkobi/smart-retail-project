# AWS VPC and EKS Cluster Provisioning
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  name   = "retail-vpc"
  cidr   = "10.0.0.0/16"
  public_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"
  cluster_name    = "retail-cluster"
  cluster_version = "1.27"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.public_subnets

  eks_managed_node_groups = {
    warehouse_nodes = {
      min_size     = 2
      max_size     = 4
      instance_types = ["t3.medium"]
    }
  }
}