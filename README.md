# Azure Virtual Network Simulator

An interactive, browser-based topology designer and simulator for Azure Virtual Network architectures. Build, visualise, and validate Azure network diagrams using a drag-and-drop canvas, then challenge yourself with AI-generated networking tasks.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Azure Network Components](#azure-network-components)
- [Developer Onboarding](#developer-onboarding)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
  - [Building for Production](#building-for-production)
- [Deployment](#deployment)
  - [Recommended Topology: Amplify Origin + CloudFront Front Door](#recommended-topology-amplify-origin--cloudfront-front-door)
  - [AWS-Native Cache Invalidation Glue](#aws-native-cache-invalidation-glue)
  - [Infrastructure as Code (Terraform)](#infrastructure-as-code-terraform)
  - [Environment Strategy](#environment-strategy)
  - [Rollback](#rollback)
- [AWS Services Integration](#aws-services-integration)
  - [Amazon Cognito](#amazon-cognito)
  - [Amazon S3](#amazon-s3)
  - [Amazon Bedrock](#amazon-bedrock)
  - [MongoDB Atlas](#mongodb-atlas)
- [Project Structure](#project-structure)
- [Key Composables](#key-composables)
- [Export & Import Formats](#export--import-formats)
- [Challenge System](#challenge-system)
- [Settings](#settings)

---

## Features

- **Interactive Canvas** — A drag-and-drop interface for arranging Azure networking components. Attachment lines and system nodes (like Public Internet) are rendered automatically based on your topology.
- **Component Configuration** — Click any component to instantly edit its properties and metadata via a dedicated configuration form. 
- **Real-Time Network Summary** — A live dashboard that groups your architecture by component type with collapsible sections and category sub-headings aligned to the top toolbar taxonomy (**Network**, **Security**, **Gateway**, **Compute**, **Storage**, **Identity**). At panel level, only **Components** is expanded by default; Components and Connectivity groups inside those sections default to collapsed for faster scanning on large diagrams. Hovering a Components or Connectivity group header activates identify-highlighting for that group only inside the panel; this identifying overlay is automatically disabled during Animation Mode. Hover interactions are optimized with debouncing and memoization for smooth performance on large diagrams. Security and Performance count badges dynamically reflect live audit findings: green (no issues), yellow (warning), red (critical).
- **Smart Auto-Layout** — One-click graph layout that runs a three-step pipeline: Kahn topological prerequisite sorting, hierarchical placement for clear left-to-right data flow, and orthogonal right-angle edge routing. Public-facing root nodes are placed in a dedicated near-top lane above policy nodes, root VNets are kept below top lanes, root VNet-managed nodes get their own post-VNet band, and private root infrastructure is placed in compact bottom rows. Root VNet spacing is normalized with deterministic minimum gaps on every run so repeated manual Auto-Layout passes do not overlap VNets. VNet Peering is parented to its Local VNet.
- **Network Testing & Validation** — Create and run connection, load-balancing, and DNS tests. Review results via detailed status summaries and step-by-step physical traversal paths with color-coded last-node indicators: green (pass), red (fail), yellow (warning). The summary block now uses a full-width PrimeVue MeterGroup segmented bar (Pass/Fail/Warning percentages) plus icon-labeled metric text for Pass, Fail, Warning, and Total.
- **Security & Performance Audits** — The Network Summary panel continuously audits your diagram for NSG coverage gaps, permissive inbound rules, missing health probes, and other best-practice issues — no test required.
- **Connection Flow Animations** — Visualize your connection tests in action. Switch to Animation Mode to see a paper-plane traveler follow the exact hop-by-hop path for connection tests, fan out **simultaneously** from the load balancer to every backend VM for load-balancer tests (at the same per-hop pace used by the other test types), and trace the DNS resolution chain for DNS tests. Active edges display animated marching dashes and a glow effect.
- **High-Contrast Diagram Edges** — In Architecture mode, all connection edges render in a theme-aware contrast color (`black` in light mode, `white` in dark mode) for clearer separation from component border colors.
- **AI Architecture Challenges** — Test your networking skills with time-boxed, dynamically generated challenges powered by Amazon Bedrock, featuring real-time evaluation of your diagram.
- **Cloud Saves** — Authenticated users can securely save, manage, and reload their diagrams and thumbnails using Amazon S3.
- **Import & Export** — Load existing layouts (`.drawio`, `.xml`, `.vsdx`) or export your finished architectures to PNG, SVG, PDF, draw.io, or Visio formats.
- **Quick Sample + Full Sample** — Start fast with a compact Quick Sample, or load a Full Sample that includes every supported Azure component type and a broader test suite to showcase end-to-end simulator features.
- **Canvas Controls** — Lock the canvas to safely pan and zoom without accidental edits, easily fit the entire topology to your screen, or clear the board to start fresh. The Minimap is interactive: drag inside it to pan and use wheel-scroll on it to zoom.
- **Dark / Light Mode** — Native support for both themes, respecting your system OS preferences or manual overrides.

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | Nuxt 3 (SPA, SSR disabled) |
| UI component library | PrimeVue 4 (Aura preset via `@primevue/themes`) |
| Styling & theming | App-owned CSS tokens in `assets/css/main.css` plus PrimeVue Aura semantic tokens from `assets/primevue-theme.ts` |
| Icons | PrimeIcons 7 (`primeicons`) for `pi pi-*` UI icons; Iconify + `@iconify-json/mdi` for diagram/canvas icons via `@iconify/vue` |
| State management | Pinia |
| Diagram engine | Vue Flow (`@vue-flow/core`) + `@vue-flow/controls` + `@vue-flow/background` + `@vue-flow/minimap` |
| Graph layout | Dagre |
| Data fetching | TanStack Vue Query |
| Utilities | VueUse |
| Image export | html-to-image |
| PDF export | jsPDF |
| Archive (VSDX) | JSZip |
| XML parsing | @xmldom/xmldom |
| AWS auth + storage | aws-amplify v6 |
| AWS AI | @aws-sdk/client-bedrock-runtime |
| Language | TypeScript 5 |

When auditing or refactoring styles, treat both token sources as valid. `assets/css/main.css` owns the app's layout and base-color variables and mirrors PrimeVue semantic tokens with fallback aliases so component styles keep resolving even before the runtime theme layer is applied.

---

## Azure Network Components

The simulator supports the following 27 user-managed Azure component types, plus one system-managed canvas entity that appears automatically on non-empty diagrams:

| Category | Components |
|---|---|
| Networking foundation | Virtual Network (VNet), Subnet, VNet Peering |
| Connectivity | VPN Gateway, Network Interface Card (NIC) |
| Security | NSG, ASG, Azure Firewall, Bastion |
| Routing | UDR (User-Defined Routes), NVA (Network Virtual Appliance) |
| Load balancing | Application Gateway, Load Balancer |
| IP & DNS | IP Address, DNS Zone |
| Compute | VM, VMSS, AKS, App Service, Azure Functions |
| Storage | Storage Account, Blob Storage, Managed Disk |
| Identity & secrets | Managed Identity, Key Vault |
| Endpoints | Service Endpoint, Private Endpoint |
| System-managed canvas entity | Public Internet |

---

## Sample Setups

Two built-in setup buttons are available in the empty canvas quick-start state:

- **Quick Sample**
  - Seeds a focused, production-style baseline topology (VNet, Subnets, NSGs, NICs, VMs, Public IP, Load Balancer, DNS Zone).
  - Includes starter tests (Internet connectivity checks, load-balancer validation, and DNS resolution).
- **Full Sample**
  - Starts from the Quick Sample baseline, then expands it into a full-feature showcase.
  - Adds the remaining supported Azure component types (ASG, UDR, VPN Gateway, Application Gateway, NVA, VMSS, AKS, App Service, Functions, Storage Account, Blob Storage, Managed Disk, Managed Identity, Key Vault, Service Endpoint, Private Endpoint, Firewall, Bastion, VNet Peering, plus a second VNet/Subnet for peering context).
  - Adds 14 tests covering all major component categories: Application Gateway load-balancing, private-endpoint connectivity, Bastion inbound access, Azure Firewall, Internal Load Balancer east-west, Internal App Gateway, Public DNS Zone resolution, AKS private API server, App Service → Key Vault, VMSS inbound, Functions → Storage, VPN Gateway access, Public App Service, and additional DNS resolution.

---

## Auto-Layout Pipeline (Simple View)

Each Auto-Layout run executes these steps in order:

1. **Prerequisite ordering (Kahn's Algorithm)**
  - A BFS-based topological pass repeatedly picks nodes with zero incoming dependencies.
  - This produces a deterministic dependency order (for example, load balancer before backend VM).
2. **Hierarchical placement (Sugiyama via Dagre)**
  - The graph is ranked left-to-right so traffic flow is easy to read from entry to backend systems.
  - A shared 32 px inter-node gap is applied during placement/reflow so edge arrowheads remain clearly visible between adjacent nodes.
3. **Semantic reflow passes** (in order):
  - **`reflowSubnetContainers`** — pack workloads inside Subnets.
  - **`reflowVnetContainers`** — pack Subnets inside VNets.
  - **`compactRootVnetSpacing`** — normalize spacing between multiple root VNets with deterministic minimum X/Y gaps to prevent overlap across repeated runs, including strict row-to-row Y normalization when a rerun drifts a row upward.
  - **`reflowOutsideVnetPolicies`** — place NSG/ASG/UDR above VNets.
  - **`reflowPublicFacingNodes`** — place root public-facing nodes in a dedicated lane above policy nodes.
  - **`enforceRootVnetTopBandClearance`** — push root VNets (and their descendants) below top lanes so VNets never overlap policy/public-facing rows.
  - **`reflowRootVnetManagedNodes`** — place root VNet-layer non-container nodes below VNet content to preserve layer ordering.
  - **`reflowRootInfrastructureNodes`** — place root private-layer nodes (Storage, Identity, etc.) in compact rows below the main diagram.
  - **`reflowVnetPeeringNodes`** — reposition only unparented VNet Peering nodes; parented nodes keep Local-VNet containment placement.
  - **`positionPublicInternetNodes`** — place the Public Internet node above everything.
  - **`normalizeAbsolutePositions`** — shift all positions so the diagram starts at the canvas origin.
4. **Orthogonal routing + edge side policy**
  - Edges render as right-angle paths.
  - Edge-side attachment is layer-aware across the four vertical bands: `System-Managed` -> `Public-Facing` -> `VNet` -> `Private`.
  - Higher -> lower layer: source exits from `Bottom`, target enters at `Top`.
  - Same layer OR ambiguous layer classification: source exits `Right`, target enters `Left`.
  - Lower -> higher layer: source exits from `Top`, target enters at `Bottom`.
  - Resolution is semantic-first by layer classification; same-layer and ambiguous cases intentionally stay horizontal.

### Layer Classification

The auto-layout algorithm classifies Azure components into four **semantic layers** to determine routing behavior and positioning:

| Layer | Purpose | Components |
|---|---|---|
| **System-Managed** | Internal canvas entity | Public Internet node (auto-injected) |
| **Public-Facing** | Internet edge; receives/exposes traffic outside | Public IP Address, VPN Gateway, Public DNS Zone, Bastion, Public Load Balancer, Public App Gateway, public App Service, Azure Functions |
| **VNet-Managed** | Network fabric; deployed inside or tightly integrated with VNet | VNet, Subnet, VNet Peering, NIC, NSG, ASG, Firewall, UDR, NVA, VM, VMSS, AKS, Internal Load Balancer, Internal App Gateway, Service Endpoint, Private Endpoint |
| **Private / Internal** | Backend PaaS resources; accessed privately | Storage Account, Blob Storage, Managed Disk, Key Vault, Managed Identity, Private DNS Zone |

**Config-Driven Layer Assignment:**

Some components can belong to different layers depending on their configuration:

| Component | Public-Facing | VNet-Managed | Private |
|---|---|---|---|
| **App Gateway** | `frontendType === 'Public'` | `frontendType === 'Internal'` | — |
| **Load Balancer** | `loadBalancerType === 'Public'` | `loadBalancerType === 'Internal'` | — |
| **App Service** | No VNet integration + No Private Endpoint | VNet-integrated or Private Endpoint enabled | — |
| **Azure Functions** | No VNet integration + No Private Endpoint | VNet-integrated or Private Endpoint enabled | — |
| **AKS** | (node pools always VNet-managed; API server can be public or private) | Primary classification | — |
| **DNS Zone** | `zoneType === 'Public'` | — | `zoneType === 'Private'` |

If cyclic dependencies exist, unresolved nodes are appended deterministically so Auto-Layout still completes.

---

## Developer Onboarding

### Prerequisites

- **Node.js** ≥ 18 LTS
- **npm** ≥ 9 (or `pnpm` / `yarn` — adjust commands accordingly)
- An AWS account with the services below provisioned (see [AWS Services Integration](#aws-services-integration))

### Installation

```bash
git clone <repo-url>
cd azure-virtual-network-simulator
npm install
```

The `postinstall` script runs `nuxt prepare` automatically to generate the `.nuxt` directory and TypeScript types.

### Environment Variables

Create a `.env` file in the project root. All variables are prefixed with `NUXT_PUBLIC_` and are exposed to the client bundle.

```dotenv
# AWS region for Cognito and S3
NUXT_PUBLIC_AWS_REGION=us-east-1

# Amazon Cognito
NUXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NUXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Amazon S3 – bucket for saved diagrams
NUXT_PUBLIC_S3_BUCKET=your-diagrams-bucket-name

# Amazon Bedrock region (can differ from the main region)
NUXT_PUBLIC_BEDROCK_REGION=us-east-1

# MongoDB Atlas App Services (HTTPS Endpoints) – user preference settings
NUXT_PUBLIC_MONGODB_ENDPOINT=https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1
NUXT_PUBLIC_MONGODB_API_KEY=your-atlas-app-services-api-key
NUXT_PUBLIC_MONGODB_DATABASE=vnet-simulator
NUXT_PUBLIC_MONGODB_COLLECTION=user_settings
```

> **Note:** Because all variables are `public`, they are embedded in the built JavaScript bundle. Do **not** place IAM secret keys or other sensitive credentials here. Bedrock calls rely on the end-user's Cognito identity credentials (see [Amazon Bedrock](#amazon-bedrock) below). The MongoDB API key should be scoped to the `user_settings` collection with read/write permissions only (see [MongoDB Atlas](#mongodb-atlas)).

### Running Locally

```bash
npm run dev
```

The development server starts at `http://localhost:3000` with hot-module replacement and Nuxt DevTools enabled.

### Building for Production

```bash
# Build the SPA bundle
npm run build

# Preview the production build locally
npm run preview

# Or generate a fully static output
npm run generate
```

---

## Deployment

This project is a client-side Nuxt SPA (`ssr: false`). For production hosting, use static deployment with CDN edge caching.

### Recommended Topology: Amplify Origin + CloudFront Front Door

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

4. Add all required `NUXT_PUBLIC_*` variables in Amplify environment variables.
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

### AWS-Native Cache Invalidation Glue

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

### Infrastructure as Code (Terraform)

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

For human operators, use short-term credentials (IAM Identity Center preferred), ensure account access via assigned permission set with scope for this Terraform stack, and refresh via `aws sso login` when expired. Full credential workflows and scope details are documented in `infra/README.md` under "3) Configure and verify AWS credentials".

4. Optional preflight checks provided by this repository:

- PowerShell: `./infra/scripts/check-prereqs.ps1 -Profile <profile> -Region <region>`
- Bash/Zsh: `./infra/scripts/check-prereqs.sh <profile> <region>`

Detailed prerequisite and apply instructions are documented in `infra/README.md`.

Keep these lifecycles decoupled: app releases continue through Amplify, while infra changes are applied through Terraform workflows.

### Environment Strategy

Use isolated AWS resources per environment (`dev`, `staging`, `production`) for Cognito, S3, Bedrock region config, and MongoDB endpoint/API key.

Important behavior for this app:

- All `NUXT_PUBLIC_*` values are embedded at build time.
- Runtime changes in Amplify or CloudFront do not change app config until you rebuild and redeploy.
- Do not put private credentials in `NUXT_PUBLIC_*`.

### Rollback

- **Application rollback (Amplify):** Redeploy a previous successful Amplify build from deployment history.
- **Edge freshness rollback step (CloudFront):** Trigger a fresh invalidation (`/*`) so edge locations stop serving stale content from the superseded release.

---

## AWS Services Integration

### Amazon Cognito

**Purpose:** User authentication — sign up, email confirmation, sign in, password reset, and password change.

**SDK:** `aws-amplify/auth` (Amplify v6)

**Configuration (`lib/aws.ts`):**

```ts
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.public.cognitoUserPoolId,
      userPoolClientId: config.public.cognitoClientId,
    },
  },
})
```

**Setup steps:**

1. Open the **AWS Console → Cognito → User Pools** and create a new user pool.
2. In the **Sign-in experience** tab, enable **Email** as a sign-in option.
3. In the **App clients** tab, create a public app client (no client secret) with the `USER_PASSWORD_AUTH` auth flow enabled.
4. Under **Messaging**, configure an email sender (Cognito default or SES) for the verification email.
5. Note the **User Pool ID** and **App Client ID** and add them to `.env`.

**Required IAM / resource-based permissions:** None on the caller side — the app uses unauthenticated sign-up / sign-in flows. If you add an Identity Pool for Bedrock / S3 access, attach the appropriate IAM roles to the authenticated identity (see sections below).

---

### Amazon S3

**Purpose:** Per-user persistence of diagram state (JSON) and canvas thumbnails (PNG). Each object is stored under `users/{userId}/diagrams/{setupId}.json` and `users/{userId}/thumbnails/{setupId}.png` with `private` access level (scoped to the authenticated Cognito identity).

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

**Setup steps:**

1. **Create an S3 bucket** in your chosen region. Block all public access.
2. **Create a Cognito Identity Pool** linked to the User Pool created above (see Cognito section).
3. **Create an IAM role** for authenticated identities with the following inline policy (replace `BUCKET_NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::BUCKET_NAME/users/${cognito-identity.amazonaws.com:sub}/*"
      ]
    }
  ]
}
```

4. Attach the IAM role to the **Authenticated role** of the Identity Pool.
5. Add an **S3 CORS configuration** to allow requests from your dev and production origins:

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

6. Add the bucket name to `.env` as `NUXT_PUBLIC_S3_BUCKET`.

---

### Amazon Bedrock

**Purpose:** AI-generated networking challenges. The app calls `anthropic.claude-3-haiku-20240307-v1:0` via the Bedrock Runtime API to produce a structured `Challenge` JSON object tailored to the selected difficulty and the components already present in the diagram.

**SDK:** `@aws-sdk/client-bedrock-runtime`

**Model used:** `anthropic.claude-3-haiku-20240307-v1:0`

**Setup steps:**

1. **Request model access** — in the AWS Console, go to **Amazon Bedrock → Model access** and request access for **Anthropic Claude 3 Haiku**. Access is usually granted within a few minutes.
2. **Grant IAM permissions** — the Cognito authenticated IAM role (created in the S3 section) must also include:

```json
{
  "Effect": "Allow",
  "Action": "bedrock:InvokeModel",
  "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
}
```

Replace `us-east-1` with the value of `NUXT_PUBLIC_BEDROCK_REGION` if different.

3. Set `NUXT_PUBLIC_BEDROCK_REGION` in `.env` to the region where you have Bedrock access (Bedrock availability varies by region).

> **Fallback:** If the Bedrock call fails (e.g., the user is not authenticated or the model is unavailable), the challenges store falls back to a locally generated challenge so the app remains functional without AWS credentials.

---

### MongoDB Atlas

**Purpose:** Per-user persistence of application preference settings (theme, dark mode, region defaults, UI toggles, etc.). Settings are stored in MongoDB Atlas via the App Services HTTPS Endpoints (Data API) — no MongoDB driver is required in the browser. A 1.5-second debounce is applied so that rapid setting changes result in a single document upsert. When a user is not signed in, settings fall back to `localStorage`.

**Client:** Browser `fetch()` — no additional npm packages required.

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

1. **Create a MongoDB Atlas cluster** at [cloud.mongodb.com](https://cloud.mongodb.com). A free M0 tier cluster is sufficient.
2. **Create a database and collection** named `vnet-simulator` / `user_settings` (or override with your env vars).
3. **Create an Atlas App Services application**:
   - Go to **App Services** → **Create a new App** → link it to your Atlas cluster.
4. **Enable HTTPS Endpoints (Data API)**:
   - In the App Services app, navigate to **HTTPS Endpoints** → **Enable the Data API**.
   - Note the **App ID** — this forms the base URL: `https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1`.
5. **Create an API Key**:
   - In App Services → **App Users** → **API Keys** → **Create API Key**.
   - Assign it the `readWriteAnyDatabase` (or a custom) role scoped only to `vnet-simulator.user_settings`.
6. **Configure collection rules** (recommended):
   - In **Rules**, restrict the `user_settings` collection so that a user can only read/write documents where `userId` matches the authenticated identity.
7. Add `NUXT_PUBLIC_MONGODB_ENDPOINT`, `NUXT_PUBLIC_MONGODB_API_KEY`, `NUXT_PUBLIC_MONGODB_DATABASE`, and `NUXT_PUBLIC_MONGODB_COLLECTION` to `.env`.

> **Security note:** The API key is embedded in the client bundle. Restrict it at the Atlas Rules level so it cannot read or write documents for other users. For stronger protection consider replacing the API key with Cognito JWT tokens configured as a Custom JWT provider in Atlas App Services.

---

## Project Structure

```
├── app.vue                  # Root component – configures AWS, loads settings & auth
├── nuxt.config.ts           # Nuxt configuration, runtime config, PrimeVue setup
├── assets/
│   ├── primevue-theme.ts    # PrimeVue Aura theme config (preset + darkModeSelector)
│   └── css/                 # Global and diagram-specific styles
├── components/
│   ├── diagram/             # Canvas, custom nodes, and edge components (Vue Flow, including connection-test animation mode)
│   ├── forms/               # Per-component property forms (one per NetworkComponentType)
│   ├── layout/              # AppHeader, LeftPanel, RightPanel, BottomToolbar
│   ├── modals/              # Auth, settings, saved setups, challenge, confirm dialogs
│   └── panels/              # ChallengePanel, TestFormModal
├── composables/             # Reusable logic (auth, diagram, export, import, S3, AI, settings)
├── lib/
│   ├── aws.ts               # Amplify bootstrap (Cognito + S3)
│   ├── bedrock.ts           # Bedrock client + challenge generation prompt
│   ├── s3.ts                # S3 upload/download helpers for diagrams & thumbnails
│   ├── dagre.ts             # Auto-layout integration
│   ├── drawio.ts            # draw.io XML import/export
│   └── vsdx.ts              # Visio VSDX import/export (via JSZip)
├── pages/index.vue          # Single page – renders the full application layout
├── stores/                  # Pinia stores (auth, diagram, challenges, savedSetups, settings, tests)
└── types/                   # TypeScript interfaces and enums
```

---

## Key Composables

| Composable | Responsibility |
|---|---|
| `useAuth` | Exposes auth state and actions from the auth Pinia store |
| `useDiagram` | CRUD operations for nodes plus programmatic management of system-rendered edges and the temporary animation-mode overlay |
| `useAI` | Triggers Bedrock challenge generation via the challenges store |
| `useS3` | Save, load, and delete diagram setups to/from S3 and local cache |
| `useExport` | Exports the canvas to PNG, SVG, PDF, draw.io, or VSDX |
| `useImport` | Imports diagrams from `.drawio`, `.xml`, or `.vsdx` files |
| `useLayout` | Wraps Dagre to auto-arrange nodes on demand (not triggered automatically on every node addition) |
| `useSettings` | Reads and writes user preferences via the settings store |
| `useTests` | Runs validation tests against the current diagram state; auto-runs are debounced (500 ms) and skip concurrent runs |

---

## Export & Import Formats

| Format | Extension | Direction |
|---|---|---|
| PNG image | `.png` | Export |
| SVG image | `.svg` | Export |
| PDF document | `.pdf` | Export |
| draw.io diagram | `.drawio` | Export & Import |
| Microsoft Visio | `.vsdx` | Export & Import |
| draw.io XML | `.xml` | Import |

---

## Challenge System

Challenges are AI-generated JSON objects that instruct the user to build a specific Azure network topology. They include:

- **Difficulty** — `BEGINNER` · `INTERMEDIATE` · `ADVANCED` · `EXPERT`
- **Tasks** — typed actions (`add_component`, `connect_components`, `configure_component`, `remove_component`) each worth a set number of points
- **Conditions** — required components, required connections, security requirements, and network requirements
- **Time limit** — a countdown timer tracked in seconds
- **Scoring** — points accumulated as tasks are completed; a congratulations modal fires when all tasks are done

The diagram store evaluates challenge completion automatically whenever the canvas state changes.

---

## Settings

User preferences are persisted to **MongoDB Atlas** when the user is authenticated and restored from MongoDB on every sign-in (remote settings always take precedence). `localStorage` is used as an immediate-write cache and as the sole persistence layer when the user is not signed in, ensuring preferences are available offline and before any network round-trip completes.

Available settings include:

| Setting | Default | Options |
|---|---|---|
| Theme | `ocean-blue` | Multiple PrimeVue presets |
| Dark mode | `system` | `system` / `light` / `dark` |
| Language | `en` | — |
| Auto-save interval | `30` s | Any positive integer |
| Default Azure region | `eastus` | Any Azure region string |
| Show minimap | `true` | toggle |
| Show grid | `true` | toggle |
| Snap to grid | `false` | toggle |
| Grid size | `20` px | Number |
| Animate edges | `true` | toggle |
| Compact nodes | `false` | toggle |
| Show tooltips | `true` | toggle |
