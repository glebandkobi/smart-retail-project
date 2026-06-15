# Permission for the GitHub Actions Robot
resource "aws_iam_user" "github_actions" {
  name = "github-actions-deployer-v8"
}

resource "aws_iam_user_policy_attachment" "admin" {
  user       = aws_iam_user.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
