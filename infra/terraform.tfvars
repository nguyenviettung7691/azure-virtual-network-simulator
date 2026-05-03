aws_region = "ap-southeast-1"

project_name = "azure-vnet"
environment  = "prod"

custom_domain_name = "azure-vnet.nguyenviettung.id.vn"
route53_zone_name  = "nguyenviettung.id.vn"

# Example: main.d123456abcdef.amplifyapp.com
amplify_origin_domain = "main.d2wyzmcpzs71gr.amplifyapp.com"
amplify_app_id        = "d2wyzmcpzs71gr"
amplify_branch_name   = "main"

cloudfront_invalidation_paths = ["/*"]

tags = {
  Owner = "platform"
}
