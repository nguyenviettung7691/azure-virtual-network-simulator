variable "aws_region" {
  type        = string
  description = "Primary AWS region for Route 53 lookups, Lambda, and EventBridge."
  default     = "ap-southeast-1"
}

variable "project_name" {
  type        = string
  description = "Project name used in resource naming."
  default     = "azure-vnet-simulator"
}

variable "environment" {
  type        = string
  description = "Environment name (for example: dev, staging, prod)."
}

variable "custom_domain_name" {
  type        = string
  description = "Application hostname served via CloudFront (for example: app.nguyenviettung.id.vn)."
}

variable "route53_zone_name" {
  type        = string
  description = "Public Route 53 hosted zone name that owns custom_domain_name (for example: nguyenviettung.id.vn)."
}

variable "amplify_origin_domain" {
  type        = string
  description = "Amplify branch public domain used as CloudFront origin (for example: main.d123456abcdef.amplifyapp.com)."
}

variable "amplify_app_id" {
  type        = string
  description = "Amplify app ID used to filter deployment status events."
}

variable "amplify_branch_name" {
  type        = string
  description = "Amplify branch name used to filter deployment status events."
}

variable "cloudfront_invalidation_paths" {
  type        = list(string)
  description = "Paths invalidated after successful Amplify deployment."
  default     = ["/*"]
}

variable "tags" {
  type        = map(string)
  description = "Optional tags applied to resources that support tags."
  default     = {}
}
