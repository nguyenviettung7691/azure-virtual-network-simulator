# AWS Services Integration

This document describes the app-side AWS dependencies as they exist in the current repository. The Terraform stack in `infra/` provisions the deployment edge (CloudFront, ACM, Route 53, EventBridge, Lambda invalidation) but does **not** provision Cognito, S3, or Bedrock resources for the application itself.

---

## Amazon Cognito

**Purpose:** User authentication — sign up, email confirmation, sign in, password reset, and password change.

**SDK:** `aws-amplify/auth` (Amplify v6)

**Configuration (`lib/aws.ts`):**

```ts
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.public.cognitoUserPoolId,
      userPoolClientId: config.public.cognitoClientId,
      identityPoolId: config.public.cognitoIdentityPoolId,
    },
  },
})
```

**Current scope:** The repo reads `NUXT_PUBLIC_COGNITO_USER_POOL_ID`, `NUXT_PUBLIC_COGNITO_CLIENT_ID`, and `NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` at startup. The User Pool, app client, Identity Pool, email delivery, and authenticated IAM roles remain external setup work.

**Setup steps:**

### Part A — Create the User Pool and App Client

The current Cognito console uses an application-centric creation flow. It creates both the user pool and the app client in a single guided process.

1. Open the [Amazon Cognito console](https://console.aws.amazon.com/cognito/v2/idp/user-pools) and choose **Create user pool**.

2. **Define your application**
   - Under *Application type*, select **Single-page application (SPA)** — this configures the app client as a public client with the correct authentication flows for browser-based apps.
   - Under *Name your application*, enter a descriptive name (e.g. `azure-vnet-simulator`).

3. **Configure options** — these settings cannot be changed after the user pool is created:
   - Under *Options for sign-in identifiers*, select **Email**.
   - Under *Required attributes for sign-up*, confirm **email** is listed.

4. **Add a return URL**
   - Enter your app's callback path (e.g. `http://localhost:3000` for local dev, or your production URL).
   - This URL is used by the Cognito-managed login domain that the console auto-creates. Because this app uses its own auth forms rather than Managed Login, the URL is not actively used by the app — but the field is required to proceed. You can delete the auto-generated domain afterward via **User pool → App integration → Domain**.

5. Choose **Create your application**. Amazon Cognito creates the user pool and a public app client with default SPA settings.

6. On the **Set up your application** page, scroll down and select **Go to overview** to reach the user pool detail page.

7. On the **Overview** tab, copy the **User pool ID** (format: `us-east-1_XXXXXXXXX`) and set it in `.env`:
   ```
   NUXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
   ```

8. Navigate to the **App integration** tab → **App clients and analytics**, click your app client name, and verify the authentication flows include:
   - `ALLOW_USER_SRP_AUTH` ← required for Amplify v6 `signIn` (the default SRP-based flow)
   - `ALLOW_REFRESH_TOKEN_AUTH` ← required for session refresh
   - If either is missing, choose **Edit** and enable them. **Do not** enable a client secret — this must remain a public client.

9. Back on the app client detail page, copy the **Client ID** (a 26-character alphanumeric string) and set it in `.env`:
   ```
   NUXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

> **Email delivery note:** By default the user pool sends verification emails via the Cognito built-in sender (limited to 50 emails/day, suitable for development). For production, navigate to **Messaging → Email** in the user pool and switch to **Send email with Amazon SES**, then select a verified SES sender identity and ensure SES is out of the sandbox for your domain.

### Part B — Create the Identity Pool

The Identity Pool exchanges a signed-in user's Cognito ID token for temporary AWS credentials, enabling browser-side access to S3 and Bedrock. Without it those features are unavailable, and Bedrock falls back to a locally generated challenge.

10. In the Cognito console, choose **Identity pools** in the left sidebar, then **Create identity pool**.

11. **Configure identity pool trust**
    - Under *User access*, select **Authenticated access**.
    - Under *Identity types*, choose **Amazon Cognito user pool**.
    - Choose **Next**.

12. **Configure permissions**
    - Select **Create a new IAM role**.
    - Enter a descriptive role name (e.g. `AzureVnetSimulatorCognitoAuthRole`). Note this name — you will attach an S3 policy to it in the [Amazon S3 setup steps](#amazon-s3) below.
    - Choose **Next**.

13. **Connect identity providers**
    - Under the Amazon Cognito user pool section, enter the **User pool ID** and **App client ID** from steps 7–9 above.
    - Leave *Role settings* as **Default role**.
    - Leave *Attributes for access control* as **Inactive**.
    - Choose **Next**.

14. **Configure properties**
    - Under *Identity pool name*, enter a name (e.g. `azure-vnet-simulator-identity-pool`).
    - Leave *Basic (classic) authentication* disabled — the app uses the enhanced flow via Amplify.
    - Choose **Next**.

15. Review all settings and choose **Create identity pool**.

16. On the newly-created identity pool's detail page, copy the **Identity pool ID** (format: `us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) and set it in `.env`:
    ```
    NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ```

**Required IAM / resource-based permissions:** None beyond the User Pool app client for the basic auth flows. The authenticated IAM role created in step 12 will need S3 permissions to support saved-setup persistence — see the [Amazon S3 setup steps](#amazon-s3) below.

---

## Amazon S3

**Purpose:** Per-user persistence of saved setups. The app passes logical keys `users/{userId}/diagrams/{setupId}.json` and `users/{userId}/thumbnails/{setupId}.png` to Amplify Storage with `accessLevel: 'private'`. Amplify scopes those objects under the authenticated identity's private prefix in S3, so the physical object path becomes `private/{identityId}/users/{userId}/...`. TanStack Vue Query drives the authenticated list/save/delete lifecycle in the browser.

**SDK:** `aws-amplify/storage` (Amplify v6)

**Configuration (`lib/aws.ts`):**

```ts
Amplify.configure({
  Storage: {
    S3: {
      bucket: config.public.s3Bucket,
      region: config.public.awsRegion,
    },
  },
})
```

**Current scope:** The repo configures the bucket name, S3 region, and Cognito Identity Pool-backed credential path in `lib/aws.ts`, but it does not provision the bucket, CORS rules, Identity Pool, or IAM roles needed for browser uploads/downloads.

**Setup steps:**

### Part A — Create the S3 Bucket

1. Open the [Amazon S3 console](https://s3.console.aws.amazon.com/s3/) and choose **Create bucket**.

2. **General configuration**
   - Under *Bucket type*, select **General purpose**.
   - Enter a globally unique **Bucket name** (e.g. `azure-vnet-simulator-diagrams-<your-account-id>`). Bucket names must be 3–63 characters, lowercase, and contain only letters, numbers, and hyphens. The name cannot be changed after creation.
   - Under *AWS Region*, select the same region you plan to use for `NUXT_PUBLIC_AWS_REGION`.

3. **Object Ownership** — leave as **ACLs disabled (Bucket owner enforced)**. This is the default. All access is managed exclusively through IAM policies, which is the correct posture for this app.

4. **Block Public Access settings** — leave all four checkboxes enabled (**Block all public access**). This is the default and correct for this app. The browser will access objects using temporary IAM credentials via Cognito, not public URLs.

5. **Bucket Versioning** — leave as **Disabled** for development. Optionally enable for production if you want object version history.

6. **Default encryption** — leave as **Server-side encryption with Amazon S3 managed keys (SSE-S3)**, which is enabled automatically for all new buckets. No action needed.

7. Choose **Create bucket**.

8. Note the exact bucket name — you will need it when setting environment variables below.

> **Important:** The bucket name, owner account, and region cannot be changed after creation. If you need to change them, you must create a new bucket.

---

### Part B — Configure CORS on the Bucket

The browser uploads and downloads objects directly to S3 using Amplify Storage. You must allow cross-origin requests from your app's origins.

9. In the S3 console bucket list, click the name of the bucket you just created.

10. Choose the **Permissions** tab.

11. Scroll down to **Cross-origin resource sharing (CORS)** and choose **Edit**.

12. Paste the following JSON, replacing the `AllowedOrigins` values with your actual dev and production origins, then choose **Save changes**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

### Part C — Attach the S3 Policy to the Authenticated IAM Role

The Cognito Identity Pool setup (steps 12–15 above) already created an authenticated IAM role. You now need to attach an inline policy to that role to allow the browser to read and write objects in your bucket.

13. Open the [IAM console](https://console.aws.amazon.com/iam/) and choose **Roles** in the left navigation.

14. Search for and click the role you created in Cognito step 12 (e.g. `AzureVnetSimulatorCognitoAuthRole`).

15. On the role detail page, choose **Add permissions → Create inline policy**.

16. In the **Policy editor**, switch to **JSON** mode and paste the following, replacing `BUCKET_NAME` with your actual bucket name:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::BUCKET_NAME/private/${cognito-identity.amazonaws.com:sub}/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::BUCKET_NAME",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["private/${cognito-identity.amazonaws.com:sub}/*"]
        }
      }
    }
  ]
}
```

> **How the path scoping works:** Amplify Storage uses `accessLevel: 'private'`, which maps each user's objects under `private/{cognitoIdentityId}/...` in the bucket. The `${cognito-identity.amazonaws.com:sub}` policy variable resolves to the authenticated user's Cognito identity ID at request time, so each user can only read and write their own objects.

17. Choose **Next**, enter a **Policy name** (e.g. `S3DiagramsAccess`), then choose **Create policy**.

---

### Part D — Set the Environment Variables

**Local development:** Add the following to your `.env` file in the project root:

```dotenv
NUXT_PUBLIC_S3_BUCKET=your-bucket-name
```

**Deployed on AWS Amplify:** Do not use a `.env` file in CI builds. Instead, configure the variable in the Amplify console so it is injected during the `npm run generate` build step:

18. Open the [AWS Amplify console](https://console.aws.amazon.com/amplify/) and select your app.

19. In the left navigation, choose **Hosting → Environment variables**.

20. Choose **Add environment variable**, set the variable name to `NUXT_PUBLIC_S3_BUCKET` and the value to your bucket name.

21. Choose **Save**. The variable will be available to all future builds. Trigger a new build (or redeploy) to pick up the change.

---

## Amazon Bedrock

**Purpose:** AI-generated networking challenges. The app calls Amazon Bedrock from the browser to produce a structured `Challenge` JSON object tailored to the selected difficulty and the components already present in the diagram.

**SDK:** `@aws-sdk/client-bedrock-runtime`

**Current implementation:** `lib/bedrock.ts` creates a `BedrockRuntimeClient` using `NUXT_PUBLIC_BEDROCK_REGION` and an explicit credentials provider backed by `fetchAuthSession()`. The model is hardcoded to `global.amazon.nova-2-lite-v1:0` (Amazon Nova 2 Lite via the global cross-region inference profile); there is currently no runtime env var for model selection in this repo.

**Setup steps:**

### Part A — Model access

> **The Amazon Bedrock Model access page has been retired.** Serverless foundation models are now automatically enabled across all AWS commercial regions when first invoked in your account. No manual activation step is needed.

**Amazon Nova 2 Lite** is a first-party Amazon model. It is not sold through AWS Marketplace, which means:

- No AWS Marketplace permissions (`aws-marketplace:Subscribe` etc.) are required.
- No Anthropic First Time Use (FTU) form is required — that is specific to Anthropic models.

Simply attach the IAM permission in Part B and invoke the model. It activates automatically on first use.

> **Cross-region inference note:** `ap-southeast-1` (Singapore) does not support in-region or geo cross-region inference for Nova 2 Lite. The app uses the **global cross-region inference profile** (`global.amazon.nova-2-lite-v1:0`), which routes requests to the optimal AWS region worldwide and is fully supported from `ap-southeast-1`.

---

### Part B — Grant `bedrock:InvokeModel` to the authenticated IAM role

The Cognito Identity Pool (created in the [Amazon Cognito setup](#amazon-cognito)) provides temporary AWS credentials to signed-in users via the authenticated IAM role. For inference profiles, Bedrock requires permission on both the global inference-profile ARN and the underlying foundation-model ARN that the profile resolves to at runtime.

1. Open the [IAM console](https://console.aws.amazon.com/iam/) and choose **Roles** in the left navigation.

2. Search for and click the authenticated role you created during the Cognito Identity Pool setup (e.g. `AzureVnetSimulatorCognitoAuthRole`).

3. On the role detail page, choose **Add permissions → Create inline policy**.

4. In the **Policy editor**, switch to **JSON** mode and paste the following, replacing `ACCOUNT_ID` with your AWS account ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:*:ACCOUNT_ID:inference-profile/global.amazon.nova-2-lite-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0",
      "Condition": {
        "ArnLike": {
          "bedrock:InferenceProfileArn": "arn:aws:bedrock:*:ACCOUNT_ID:inference-profile/global.amazon.nova-2-lite-v1:0"
        }
      }
    }
  ]
}
```

> **Why there are two resources:** AWS requires both permissions for inference profiles. Bedrock first evaluates the global `inference-profile` resource and then evaluates the underlying `foundation-model` resource in the Region it selects for the request.

> **Why the condition matters:** the `bedrock:InferenceProfileArn` condition keeps the foundation-model allow scoped to requests that come through the global Nova 2 Lite inference profile, instead of granting direct model access outside that path.

5. Choose **Next**, enter a descriptive **Policy name** (e.g. `BedrockChallengeAccess`), then choose **Create policy**.

---

### Part C — Set the environment variables

**Local development:** Add the following to your `.env` file in the project root:

```dotenv
# Amazon Bedrock region — ap-southeast-1 uses global cross-region inference for Nova 2 Lite
NUXT_PUBLIC_BEDROCK_REGION=ap-southeast-1
```

**Deployed on AWS Amplify:** Do not use a `.env` file in CI builds. Instead, configure the variable in the Amplify console so it is injected during the `npm run generate` build step:

6. Open the [AWS Amplify console](https://console.aws.amazon.com/amplify/) and select your app.

7. In the left navigation, choose **Hosting → Environment variables**.

8. Choose **Add environment variable**, set the variable name to `NUXT_PUBLIC_BEDROCK_REGION` and the value to `ap-southeast-1`.

9. Choose **Save**. The variable will be available to all future builds. Trigger a new build (or redeploy) to pick up the change.

> **Fallback:** If the Bedrock call fails for any reason — missing browser credentials, IAM permission not yet attached, or any transient service error — the challenges store automatically falls back to a locally generated challenge so the app remains fully functional.

---

## MongoDB Atlas

**Purpose:** Per-user persistence of application preference settings (theme, dark mode, region defaults, UI toggles, etc.). Settings are stored in MongoDB Atlas and accessed through an **AWS Lambda Function URL proxy** — MongoDB credentials never reach the browser. The browser authenticates via its existing Cognito ID token; the Lambda verifies the JWT and executes the query using the native Node.js driver. TanStack Vue Query loads remote settings after authenticated session bootstrap, and a 1.5-second debounced mutation persists later changes. When a user is not signed in, settings fall back to `localStorage`.

> **Why a Lambda proxy?** The former Atlas App Services Data API (HTTPS Endpoints) was deprecated and reached end-of-life in 2025. The AWS Lambda Function URL approach replaces it with a solution that fits the existing AWS-native infrastructure, reuses the Cognito session already in the app, and eliminates the need for any third-party API key in the client bundle. See the [official migration guide](https://www.mongodb.com/docs/atlas/app-services/data-api/data-api-deprecation/) for alternatives that were considered.

**Client:** Browser `fetch()` → AWS Lambda Function URL (authenticated via `Authorization: Bearer <cognito-id-token>`) — no MongoDB driver or additional npm packages required in the browser. Because the browser sends `POST` requests with both `Content-Type: application/json` and `Authorization`, the Function URL CORS policy must allow the production origin, the `POST` method, and both request headers.

**Collection schema:** one document per user, keyed on `userId`.

```json
{
  "userId": "cognito-user-id",
  "theme": "ocean-blue",
  "darkMode": "system",
  "language": "en",
  "autoSave": true,
  "autoSaveInterval": 30,
  "showMinimap": true,
  "showGrid": true,
  "snapToGrid": false,
  "gridSize": 20,
  "defaultRegion": "eastus",
  "defaultResourceGroup": "my-rg",
  "showTooltips": true,
  "animateEdges": true,
  "compactNodes": false,
  "sidebarCollapsed": false,
  "rightPanelCollapsed": false
}
```

**Setup steps:**

### Part A — Create an Atlas cluster

1. Register or sign in at [cloud.mongodb.com](https://cloud.mongodb.com). Create an **Organization** and a **Project** if you are starting fresh.

2. On the **Database Deployments** page, click **Create** (top right) to open the cluster creation wizard.

3. Select the **M0 Free** tier (sufficient for this use case).

   > **Note:** As of January 2026, the M2 and M5 tiers have been retired and migrated to **Flex** clusters. M0 remains available and is the recommended free starting point.

4. Choose a **cloud provider** and **region** closest to your AWS deployment to minimize latency.

5. Give the cluster a name (e.g. `vnet-simulator-cluster`) and click **Create Deployment**.

6. While the cluster provisions, the quick-start wizard prompts you to create a database user — continue to Part B.

---

### Part B — Create a database user and configure network access

7. In the quick-start wizard (or **Security → Database Access**), click **Add New Database User**:
   - **Authentication Method:** Password
   - **Username:** `vnet-simulator-user` (or your preference)
   - **Password:** generate a strong password and save it — you will need it in Part D
   - **Database User Privileges:** select **Read and Write to any database**, or use **Specific Privileges** scoped to `vnet-simulator` only
   - Click **Add User**

8. Navigate to **Security → Network Access → Add IP Address**:
   - For initial testing you may allow **0.0.0.0/0** (allow access from anywhere). Tighten this to your Lambda's outbound IPs or a VPC CIDR before going to production.
   - Click **Confirm**

---

### Part C — Create the database and collection

9. In the left sidebar, click **Data Explorer** under the **Database** heading. The Data Explorer opens.

10. Hover over your cluster name and click the **+** icon → the **Create Database** dialog opens.

11. Fill in:
    - **Database Name:** `vnet-simulator`
    - **Collection Name:** `user_settings`
    - Click **Create Database**

    The new database and collection appear in the sidebar.

12. (Recommended) Create an index on `userId` for O(1) lookups:
    - Click the `user_settings` collection → **Indexes** tab → **Create Index**
    - Index definition: `{ "userId": 1 }`, leave unique unchecked
    - Click **Create Index**

---

### Part D — Copy the connection string

13. Click **Database** in the left navigation, then click **Connect** next to your cluster.

14. Choose **Drivers** and select **Node.js** as the driver.

15. Copy the connection string. It looks like:
    ```
    mongodb+srv://vnet-simulator-user:<password>@vnet-simulator-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=vnet-simulator-cluster
    ```

16. Replace `<password>` with the database user password you saved in step 7. Keep this string — you will need it for the Lambda in Part E.

---

### Part E — Create the AWS Lambda proxy function

17. Open the [AWS Lambda console](https://console.aws.amazon.com/lambda/) and choose **Create function**.

18. Select **Author from scratch** and fill in:
    - **Function name:** `vnet-simulator-mongodb-settings`
    - **Runtime:** Node.js 20.x
    - **Architecture:** arm64 (cost-efficient)
    - Click **Create function**

19. In the **Code** tab, upload a deployment ZIP that includes `infra/lambda/mongodb-settings.mjs` (renamed to `index.mjs` in the ZIP root) plus a `node_modules` folder containing the `mongodb` npm package:

    ```powershell
    # Run from the infra/lambda directory
    npm init -y
    npm install mongodb
    # Rename the file for Lambda entry point
    Copy-Item mongodb-settings.mjs index.mjs
    Compress-Archive -Path index.mjs, node_modules, package.json -DestinationPath function.zip
    ```

    Upload `function.zip` via **Upload from → .zip file** in the Lambda console, or deploy with the CLI:

    ```bash
    aws lambda update-function-code \
      --function-name vnet-simulator-mongodb-settings \
      --zip-file fileb://function.zip
    ```

20. Set the Lambda **Handler** to `index.handler` (under **Runtime settings → Edit**).

20a. Go to **Configuration → General configuration → Edit** and set:
    - **Timeout:** `15 sec`
    - **Memory:** `256 MB`

    The Lambda handler initializes `MongoClient` with `serverSelectionTimeoutMS: 5000`, so the default 3-second Lambda timeout is too short and causes Function URL responses to fail with `502 Bad Gateway` plus CloudWatch `Status: timeout` before MongoDB can connect or return a real error.

    If you are updating an existing function instead of using the console, run:

    ```bash
    aws lambda update-function-configuration \
      --function-name vnet-simulator-mongodb-settings \
      --timeout 15 \
      --memory-size 256
    ```

21. Go to **Configuration → Environment variables → Edit** and add:

    | Key | Value |
    |-----|-------|
    | `MONGODB_URI` | the connection string from step 16 |
    | `MONGODB_DATABASE` | `vnet-simulator` |
    | `MONGODB_COLLECTION` | `user_settings` |
    | `COGNITO_USER_POOL_ID` | your Cognito User Pool ID (e.g. `us-east-1_XXXXXXXXX`) |
    | `COGNITO_REGION` | the AWS region of your Cognito User Pool (e.g. `us-east-1`) |

    Click **Save**.

  CORS is configured on the **Function URL** itself in the next step, not through Lambda environment variables.

22. Go to **Configuration → Function URL → Create function URL**:
    - **Auth type:** NONE (the function verifies the Cognito JWT token itself)
    - **CORS → Allow origins:** your app domain (e.g. `https://yourdomain.com`), or `*` during development
    - **CORS → Allow methods:** `POST`
    - **CORS → Allow headers:** `Content-Type, Authorization`
    - **CORS → Max age:** `300`
    - Click **Save**

23. Copy the **Function URL** (format: `https://<id>.lambda-url.<region>.on.aws`). This is your `NUXT_PUBLIC_MONGODB_ENDPOINT` value.

    If you are updating an existing Function URL instead of recreating it, run:

    ```bash
    aws lambda update-function-url-config \
      --function-name vnet-simulator-mongodb-settings \
      --auth-type NONE \
      --cors 'AllowOrigins=["https://azure-vnet.nguyenviettung.id.vn"],AllowMethods=["POST"],AllowHeaders=["content-type","authorization"],MaxAge=300'
    ```

    If your deployed Function URL is attached to an alias instead of `$LATEST`, add `--qualifier <alias-name>` so you update the same URL referenced by `NUXT_PUBLIC_MONGODB_ENDPOINT`.

    This CORS-only change does not require a Lambda code upload or an Amplify rebuild.

  24. If the function still fails after increasing the Lambda timeout, check **MongoDB Atlas → Security → Network Access** and make sure the Lambda can reach the cluster.
    - For initial verification, temporarily allow `0.0.0.0/0`.
    - If the timeout changes into a logged MongoDB connection error after that, the root cause was Atlas network access rather than Lambda execution time.
    - Tighten the allow list again before production cutover.

> **Production hardening:** For full JWT signature verification, add the [`aws-jwt-verify`](https://github.com/awslabs/aws-jwt-verify) npm package to the Lambda deployment. The reference implementation in [`infra/lambda/mongodb-settings.mjs`](../infra/lambda/mongodb-settings.mjs) performs structural decode and expiry/issuer checks only; `aws-jwt-verify` adds RS256 signature validation against the Cognito public key.

---

### Part F — Set the environment variables

**Local development:** Add the following to your `.env` file in the project root:

```dotenv
NUXT_PUBLIC_MONGODB_ENDPOINT=https://<function-url-id>.lambda-url.<region>.on.aws
NUXT_PUBLIC_MONGODB_DATABASE=vnet-simulator
NUXT_PUBLIC_MONGODB_COLLECTION=user_settings
```

**Deployed on AWS Amplify:** Do not use a `.env` file in CI builds. Instead, configure the variables in the Amplify console so they are injected during the `npm run generate` build step:

24. Open the [AWS Amplify console](https://console.aws.amazon.com/amplify/) and select your app.

25. In the left navigation, choose **Hosting → Environment variables**.

26. Add the following variables (choose **Add environment variable** for each):

    | Variable name | Value |
    |---|---|
    | `NUXT_PUBLIC_MONGODB_ENDPOINT` | your Lambda Function URL from step 23 |
    | `NUXT_PUBLIC_MONGODB_DATABASE` | `vnet-simulator` |
    | `NUXT_PUBLIC_MONGODB_COLLECTION` | `user_settings` |

27. Choose **Save**. Trigger a new build (or redeploy) to pick up the changes.

> **Security note:** MongoDB credentials (the `mongodb+srv://` connection string) live exclusively in Lambda environment variables and are never embedded in the client bundle. The browser authenticates to the Lambda using its existing Cognito session token — no separate API key is needed. Restrict the Lambda Function URL CORS `Allow origins` to your app's exact domain in production.
