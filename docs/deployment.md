# Deployment

This project is a client-side Nuxt SPA (`ssr: false`). For production hosting, use static deployment with CDN edge caching.

## Recommended Topology: Amplify Origin + CloudFront Front Door

Use AWS Amplify Hosting as the application build/deploy origin and place CloudFront in front of it for custom-domain delivery.

This topology is the default for this repository, especially when the target domain pattern cannot be attached directly in Amplify custom-domain settings.

1. Connect the GitHub repository in **AWS Amplify -> Hosting**.
2. Select the target branch (`main` for production, optional `develop` for staging).
3. Configure build settings:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run generate
  artifacts:
    baseDirectory: .output/public
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

4. Add all required `NUXT_PUBLIC_*` variables in **Amplify → Hosting → Environment variables**. These are injected during the build step and embedded in the generated bundle. See the [Environment Variables](developer-onboarding.md#environment-variables) section for the full list.
5. In Amplify Hosting, add SPA rewrite rule so client-side routes resolve to `index.html`:
   - Source: `/<*>`
   - Target: `/index.html`
   - Type: `200 (Rewrite)`
6. Request an ACM certificate for the app hostname in `us-east-1` (CloudFront requirement), then validate via DNS in Route 53.
7. Create a CloudFront distribution:
   - Origin: Amplify app public domain URL
   - Alternate domain name (CNAME): app custom domain
   - TLS certificate: ACM certificate from `us-east-1`
8. In Route 53, point the app custom domain to the CloudFront distribution domain.

## AWS-Native Cache Invalidation Glue

Because Amplify and CloudFront are independently moving parts, CloudFront cache invalidation must run after every successful Amplify deployment.

Default mechanism:

1. EventBridge rule listens to Amplify deployment success events:
   - `source`: `aws.amplify`
   - `detail-type`: `Amplify Deployment Status Change`
   - `detail.jobStatus`: `SUCCEED`
2. Rule target is a Lambda function with permission to call `cloudfront:CreateInvalidation` for the specific distribution.
3. Lambda submits a full invalidation path set: `/*`.

Operational flow:

Git push -> Amplify build/deploy success -> EventBridge event -> Lambda -> CloudFront invalidation (`/*`) -> users receive fresh content.

This avoids GitHub-side CloudFront credentials and keeps invalidation fully AWS-native.

## Infrastructure as Code (Terraform)

Infrastructure is managed separately from app code lifecycle.

- App lifecycle: Amplify native Git-connected CI/CD builds and deploys application code.
- Infrastructure lifecycle: Terraform in `infra/` manages CloudFront, ACM, Route 53, EventBridge rule, Lambda function, IAM role/policies, and related wiring.

Before running Terraform in `infra/`, complete and verify these prerequisites:

1. Install Terraform CLI 1.6+ and verify:

```bash
terraform version
```

2. Install AWS CLI v2 and verify:

```bash
aws --version
```

3. Configure AWS credentials for the target account (profile or env vars), then verify access:

```bash
aws sts get-caller-identity
```

For human operators, use short-term credentials (IAM Identity Center preferred), ensure account access via assigned permission set with scope for this Terraform stack, and refresh via `aws sso login` when expired. Full credential workflows and scope details are documented in [`infra/README.md`](../infra/README.md) under "3) Configure and verify AWS credentials".

4. Optional preflight checks provided by this repository:

- PowerShell: `./infra/scripts/check-prereqs.ps1 -Profile <profile> -Region <region>`
- Bash/Zsh: `./infra/scripts/check-prereqs.sh <profile> <region>`

Detailed prerequisite and apply instructions are documented in [`infra/README.md`](../infra/README.md).

Keep these lifecycles decoupled: app releases continue through Amplify, while infra changes are applied through Terraform workflows.

## Environment Strategy

Use isolated AWS resources per environment (`dev`, `staging`, `production`) for Cognito, S3, Bedrock region config, and MongoDB endpoint/API key.

**Where to configure variables per context:**

| Context | Where to set `NUXT_PUBLIC_*` values |
|---|---|
| Local development | `.env` file in the project root (copy from `.env.example`) |
| AWS Amplify deployment | **Amplify → your app → Hosting → Environment variables** |

Important behavior for this app:

- All `NUXT_PUBLIC_*` values are embedded at build time — they are baked into the static JS bundle during `npm run generate`.
- Changing variables in Amplify does not affect a deployed build. A new build and redeploy is required for changes to take effect.
- Do not put private credentials in `NUXT_PUBLIC_*`.

## Rollback

- **Application rollback (Amplify):** Redeploy a previous successful Amplify build from deployment history.
- **Edge freshness rollback step (CloudFront):** Trigger a fresh invalidation (`/*`) so edge locations stop serving stale content from the superseded release.
