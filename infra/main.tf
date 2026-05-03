data "aws_caller_identity" "current" {}

data "aws_route53_zone" "selected" {
  name         = trimsuffix(var.route53_zone_name, ".")
  private_zone = false
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

resource "aws_acm_certificate" "custom_domain" {
  provider          = aws.us_east_1
  domain_name       = var.custom_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.custom_domain.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = data.aws_route53_zone.selected.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "custom_domain" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.custom_domain.arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix} CloudFront front door for Amplify"
  default_root_object = "index.html"
  aliases             = [var.custom_domain_name]
  price_class         = "PriceClass_100"

  origin {
    domain_name = var.amplify_origin_domain
    origin_id   = "amplify-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "amplify-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.custom_domain.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.common_tags

  depends_on = [aws_acm_certificate_validation.custom_domain]
}

resource "aws_route53_record" "cloudfront_alias_a" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.custom_domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "cloudfront_alias_aaaa" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.custom_domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/invalidate-cloudfront.py"
  output_path = "${path.module}/lambda/invalidate-cloudfront.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cloudfront_invalidator" {
  name               = "${local.name_prefix}-cloudfront-invalidator-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "cloudfront_invalidator" {
  statement {
    sid = "AllowCreateInvalidation"

    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
    ]

    resources = [
      "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.app.id}",
    ]
  }

  statement {
    sid = "AllowCloudWatchLogs"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role_policy" "cloudfront_invalidator" {
  name   = "${local.name_prefix}-cloudfront-invalidator-policy"
  role   = aws_iam_role.cloudfront_invalidator.id
  policy = data.aws_iam_policy_document.cloudfront_invalidator.json
}

resource "aws_lambda_function" "cloudfront_invalidator" {
  function_name    = "${local.name_prefix}-cloudfront-invalidator"
  role             = aws_iam_role.cloudfront_invalidator.arn
  handler          = "invalidate-cloudfront.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 30
  tags             = local.common_tags

  environment {
    variables = {
      DISTRIBUTION_ID    = aws_cloudfront_distribution.app.id
      INVALIDATION_PATHS = join(",", var.cloudfront_invalidation_paths)
    }
  }

  depends_on = [aws_iam_role_policy.cloudfront_invalidator]
}

resource "aws_cloudwatch_event_rule" "amplify_deploy_success" {
  name        = "${local.name_prefix}-amplify-deploy-success"
  description = "Trigger CloudFront invalidation after successful Amplify deployment."

  event_pattern = jsonencode({
    source      = ["aws.amplify"]
    detail-type = ["Amplify Deployment Status Change"]
    detail = {
      appId      = [var.amplify_app_id]
      branchName = [var.amplify_branch_name]
      jobStatus  = ["SUCCEED"]
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.amplify_deploy_success.name
  target_id = "invalidate-cloudfront-cache"
  arn       = aws_lambda_function.cloudfront_invalidator.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cloudfront_invalidator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.amplify_deploy_success.arn
}
