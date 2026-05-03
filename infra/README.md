# Terraform Infrastructure: CloudFront Fronting Amplify

This stack provisions the deployment edge and eventing glue for this repository's canonical deployment model:

- Amplify hosts and deploys the SPA from Git-connected CI/CD.
- CloudFront is the custom-domain front door.
- ACM (in us-east-1) provides TLS certificate for CloudFront.
- Route 53 maps your app hostname to CloudFront.
- EventBridge listens for successful Amplify deployments.
- Lambda invalidates CloudFront cache (`/*` by default).

## What this creates

- ACM certificate in `us-east-1` for your app custom domain
- DNS validation records in Route 53
- CloudFront distribution using Amplify branch domain as origin
- Route 53 alias records (`A` and `AAAA`) to CloudFront
- Lambda function (`python3.12`) that calls `CreateInvalidation`
- IAM role and policy for the Lambda function
- EventBridge rule for Amplify deployment success events
- EventBridge target and Lambda invoke permission

## Prerequisites

1. Terraform CLI 1.6+ installed and verified
2. AWS CLI v2 installed and verified
3. AWS credentials configured for the target account and verified
4. Existing public Route 53 hosted zone for your domain
5. Existing Amplify app/branch already deploying successfully
6. Amplify branch rewrite rule configured:
   - `/<*> -> /index.html` (200 rewrite)

### 1) Install and verify Terraform CLI 1.6+

Install Terraform using your platform package manager:

- Windows (`winget`):

```powershell
winget install HashiCorp.Terraform
```

- macOS (`brew`):

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

- Linux (Debian/Ubuntu via HashiCorp apt repo):

```bash
sudo apt-get update
sudo apt-get install -y gnupg software-properties-common curl
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update
sudo apt-get install -y terraform
```

Verify version:

```bash
terraform version
```

The returned version must be `1.6.0` or higher.

### 2) Install and verify AWS CLI v2

Install AWS CLI using your platform package manager:

- Windows (`winget`):

```powershell
winget install Amazon.AWSCLI
```

- macOS (`brew`):

```bash
brew install awscli
```

- Linux (Debian/Ubuntu):

```bash
sudo apt-get update
sudo apt-get install -y awscli
```

Verify installation:

```bash
aws --version
```

### 3) Configure and verify AWS credentials

Use short-term credentials for human access. IAM Identity Center is the recommended default.

#### A) IAM Identity Center (recommended)

Prerequisites:

1. An IAM Identity Center user (you sign in to the AWS access portal as this user).
2. Access to at least one target AWS account via assigned permission set.
   - If this is missing, ask your administrator to assign the account and permission set.

Required permission set scope for this Terraform stack:

- `acm:*` for certificate request/validation lifecycle (us-east-1)
- `route53:*` for hosted-zone lookup and record create/update/delete
- `cloudfront:*` for distribution create/update/read and invalidation
- `lambda:*` for function create/update/read and invoke permissions wiring
- `events:*` for EventBridge rule and target management
- `iam:*` for Lambda role/policy create/update/delete
- `logs:*` for Lambda log group/stream writes
- `sts:GetCallerIdentity` for identity verification checks

Recommended assignment model:

1. `TerraformPlanReadOnly` permission set for `terraform plan` and inspection workflows.
2. `TerraformApplyDeploy` permission set for `terraform apply/destroy` workflows.

Configure the profile:

```bash
aws configure sso --profile vnet-prod-sso
```

This creates/updates shared AWS config entries (Windows `%UserProfile%\\.aws\\config`, Linux/macOS `~/.aws/config`).

Example config:

```ini
[profile vnet-prod-sso]
sso_session = corp
sso_account_id = 123456789012
sso_role_name = PowerUserAccess
region = ap-southeast-1
output = json

[sso-session corp]
sso_start_url = https://your-portal.awsapps.com/start
sso_region = ap-southeast-1
sso_registration_scopes = sso:account:access
```

Get and verify temporary credentials:

```bash
aws sso login --profile vnet-prod-sso
aws sts get-caller-identity --profile vnet-prod-sso
```

Set active profile:

- PowerShell:

```powershell
$env:AWS_PROFILE = "vnet-prod-sso"
```

- Bash/Zsh:

```bash
export AWS_PROFILE=vnet-prod-sso
```

Refresh expired credentials:

```bash
aws sso login --profile vnet-prod-sso
aws sts get-caller-identity --profile vnet-prod-sso
```

If account assignments changed, rerun profile setup:

```bash
aws configure sso --profile vnet-prod-sso
```

#### B) Manual short-term credential profile (alternative)

If your organization provides STS credential triples directly, include all values:

- `aws_access_key_id`
- `aws_secret_access_key`
- `aws_session_token`

Shared credential file locations:

- Windows: `%UserProfile%\\.aws\\credentials` and `%UserProfile%\\.aws\\config`
- Linux/macOS: `~/.aws/credentials` and `~/.aws/config`

Example `credentials` entry:

```ini
[vnet-prod-temp]
aws_access_key_id = ASIA...
aws_secret_access_key = ...
aws_session_token = ...
```

Example `config` entry:

```ini
[profile vnet-prod-temp]
region = ap-southeast-1
output = json
```

Activate and verify:

- PowerShell:

```powershell
$env:AWS_PROFILE = "vnet-prod-temp"
aws sts get-caller-identity
```

- Bash/Zsh:

```bash
export AWS_PROFILE=vnet-prod-temp
aws sts get-caller-identity
```

#### C) CI/non-interactive environment variables

For automation, export environment variables directly:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=... # required for temporary credentials
export AWS_REGION=ap-southeast-1
```

Verify identity and account access:

```bash
aws sts get-caller-identity
```

Optional preflight helpers in this repo:

- Windows PowerShell:

```powershell
./scripts/check-prereqs.ps1 -Profile vnet-prod -Region ap-southeast-1
```

- Bash/Zsh:

```bash
./scripts/check-prereqs.sh vnet-prod ap-southeast-1
```

## Quick start

1. Copy the example variables file.

```bash
cp terraform.tfvars.example terraform.tfvars
```

2. Edit `terraform.tfvars` with your real values.

3. Run prerequisite checks (recommended).

```bash
./scripts/check-prereqs.sh vnet-prod ap-southeast-1
```

4. Initialize and apply.

```bash
terraform init
terraform plan
terraform apply
```

## Required variables

- `environment`: environment label (`dev`, `staging`, `prod`)
- `custom_domain_name`: app hostname (for example `azure-vnet.nguyenviettung.id.vn`)
- `route53_zone_name`: zone apex that owns the hostname (for example `nguyenviettung.id.vn`)
- `amplify_origin_domain`: Amplify branch domain (for example `main.d2wyzmcpzs71gr.amplifyapp.com`)
- `amplify_app_id`: Amplify app ID (for EventBridge filter)
- `amplify_branch_name`: Amplify branch name (for EventBridge filter)

Optional:

- `aws_region`: defaults to `ap-southeast-1`
- `project_name`: defaults to `azure-vnet`
- `cloudfront_invalidation_paths`: defaults to `["/*"]`
- `tags`: resource tags map

## Operational flow

1. You push to Git.
2. Amplify builds/deploys the branch.
3. Amplify emits `Amplify Deployment Status Change` event with `jobStatus=SUCCEED`.
4. EventBridge rule matches by app/branch/status.
5. Lambda is invoked and calls `cloudfront:CreateInvalidation`.
6. CloudFront edge cache refreshes based on configured invalidation paths.

## Notes

- ACM certificate is always created in `us-east-1` because CloudFront requires it.
- This stack is intentionally separate from app source deployment lifecycle.
- For rollback, redeploy previous Amplify build and let invalidation run (or manually invoke Lambda if needed).
