# Developer Onboarding

## Prerequisites

- **Node.js** ≥ 18 LTS
- **npm** ≥ 9 (or `pnpm` / `yarn` — adjust commands accordingly)
- An AWS account with the services below provisioned (see [AWS Services Integration](aws-services-integration.md))

## Installation

```bash
git clone <repo-url>
cd azure-virtual-network-simulator
npm install
```

The `postinstall` script clears stale caches (`.nuxt`, `node_modules/.vite`, `node_modules/.cache`) then runs `nuxt prepare` to generate the `.nuxt` directory and TypeScript types.

## Environment Variables

All variables are prefixed with `NUXT_PUBLIC_` and are embedded in the client bundle at build time.

**Local development:** Copy `.env.example` to `.env` in the project root and fill in the values. Nuxt reads this file automatically — no extra setup needed.

**Deployed to AWS Amplify:** Set the variables in **AWS Amplify → your app → Hosting → Environment variables**. Amplify injects them as OS environment variables during the `npm run generate` build step. The `.env` file is not used in CI builds.

```dotenv
# AWS region for Cognito and S3
NUXT_PUBLIC_AWS_REGION=us-east-1

# Amazon Cognito
NUXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NUXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Amazon S3 – bucket for saved diagrams
NUXT_PUBLIC_S3_BUCKET=your-diagrams-bucket-name

# Amazon Bedrock region — ap-southeast-1 uses global cross-region inference for Nova 2 Lite
NUXT_PUBLIC_BEDROCK_REGION=ap-southeast-1

# MongoDB Atlas (via AWS Lambda proxy) – user preference settings
NUXT_PUBLIC_MONGODB_ENDPOINT=https://<function-url-id>.lambda-url.<region>.on.aws
NUXT_PUBLIC_MONGODB_DATABASE=vnet-simulator
NUXT_PUBLIC_MONGODB_COLLECTION=user_settings
```

> **Note:** Because all variables are `public`, they are embedded in the built JavaScript bundle. Do **not** place IAM secret keys or other sensitive credentials here. Browser-side AWS access for S3 and Bedrock comes from temporary credentials resolved through the configured Cognito Identity Pool. If those credentials are unavailable or the deployed identity lacks the needed IAM permissions, Bedrock falls back to a locally generated challenge. MongoDB credentials (connection string) are stored exclusively in Lambda environment variables and never reach the browser — the browser authenticates to the Lambda proxy using its existing Cognito session token (see [MongoDB Atlas](aws-services-integration.md#mongodb-atlas)).

## Running Locally

```bash
npm run dev
```

The development server starts at `http://localhost:3000` with hot-module replacement. (Nuxt DevTools are currently disabled in `nuxt.config.ts`.)

## Building for Production

```bash
# Build the SPA bundle
npm run build

# Preview the production build locally
npm run preview

# Or generate a fully static output
npm run generate
```
