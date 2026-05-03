output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.app.id
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.app.domain_name
}

output "custom_domain_name" {
  description = "Configured app custom domain."
  value       = var.custom_domain_name
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN (us-east-1) attached to CloudFront."
  value       = aws_acm_certificate_validation.custom_domain.certificate_arn
}

output "eventbridge_rule_name" {
  description = "EventBridge rule that listens to Amplify deployment success."
  value       = aws_cloudwatch_event_rule.amplify_deploy_success.name
}

output "lambda_function_name" {
  description = "Lambda function used for CloudFront invalidation."
  value       = aws_lambda_function.cloudfront_invalidator.function_name
}
