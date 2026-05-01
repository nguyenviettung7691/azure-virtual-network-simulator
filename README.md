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

- **Drag-and-drop canvas** — place and arrange 27 Azure networking components on an interactive Vue Flow canvas. When the diagram contains at least one user-added component, a single system-managed **Public Internet** node is also shown automatically. Attachment arrows are rendered automatically from component relationships; users do not manually draw, reconnect, or delete edges from the canvas UI.
- **Component forms** — single-click any user-managed component (when canvas is unlocked) to open its property edit form, or configure via the right side panel. The system-managed **Public Internet** node is read-only and does not open a form.
- **Network Summary panel** — the right-hand panel shows a live summary of the diagram. The Components section groups nodes by their component type, with a count badge (PrimeVue `Tag severity="info"`) on each group header. The Connectivity section renders a two-column table ("Source" / "Target") where each row is a connection; target cells span multiple rows (`rowspan`) when a target has more than one source; rows are visually grouped per target using alternating group backgrounds (`.conn-group-alt`) and a bold separator border between groups (`.conn-group-first`); the table also includes containment edges synthesised from `node.parentNode` so all topology relationships are visible. Both Source and Target cells display a small coloured component-type icon (with a tooltip showing the full type label) before the component name.
- **Load sample** — one-click button on the empty canvas state that loads a pre-built VNet diagram (1 VNet, 3 NSGs, 3 Subnets, 3 NICs, 4 VMs with realistic security rules, region "southeastasia" for VNet 1) plus 4 pre-configured connection tests; all existing tests are replaced so the panel always reflects the sample. The sample only adds attachment edges (for example NSG→Subnet/NIC and NIC→VM); containment is derived from component metadata and auto-layout, which expands the VNet to enclose all three Subnets, keeps subnet-hosted workloads inside their Subnet, keeps the main canvas in sync with the minimap for nested container bounds, and places the NSGs outside the VNet aligned to the Subnets or NICs they protect. Those rendered edges stay read-only in the canvas UI.
- **Reset diagram** — removes all components from the canvas; an optional "Also reset all network tests" checkbox in the confirm dialog lets you clear the test panel at the same time.
- **Delete All tests** — a "Delete All" button in the Network Tests panel removes every test at once after a confirm dialog. The panel uses a full-width "Add Test" block button and half-width "Run All" (green, `severity="success"`) / "Delete All" buttons on the row below; test status summary tags (Pass / Fail / Pending) are center-aligned. Each test card has a left-accent border; Row 1 shows the type icon and test name (with a separator border below); Row 2 shows the result status `<Tag>` (uppercase, left) and the per-test Run / Run animation / Edit / Delete action buttons (right, with Run animation shown for connection tests only). After a result is available, a compact inline flowchart appears below the result message showing the full physical traversal path: connection tests render every hop node ID resolved to its component name and icon (e.g. Internet → VNet → Subnet → SubnetNSG → NIC → NIC NSG → VM for a passing test); for a passing test the final target node is highlighted in green with a `mdi:check-circle` badge, while for a failing test the path stops at the blocking NSG, which is shown with a red `mdi:close-circle` badge; load-balance tests show source → LB → backend VMs; security tests show NSG count → Subnet count; DNS tests show DNS Client → zone name → resolved IP.
- **Connection flow animation** — any connection test can switch the canvas from the default **Infrastructure** view into **Animation** mode by using the per-test Run animation action. The selected test is rerun first, then the canvas renders only that directed traversal path as animated edges, including synthesized containment hops that are normally expressed via nesting rather than visible arrows. A moving paper-plane travels from source to target at a steady pace; after each hop resolves, the traversed node and edge keep pass / fail / warning styling, and the traveler disappears when the run completes. A fixed, top-centered **Exit animation** button returns the canvas to Infrastructure mode and restores the normal read-only edge view.
- **Auto layout** — on-demand Dagre-powered automatic graph layout with visual containment and attachment-aware grouping: the system-managed **Public Internet** node is positioned in a dedicated top row above the rest of the topology; Subnets stay inside their VNet and resize from their packed child bounds; subnet-hosted resources stay inside their Subnet; NIC-attached workloads are grouped beside their NIC instead of dropping underneath it; and policy resources such as NSGs, ASGs, and UDRs are positioned outside the VNet near the Subnets or NICs they protect, using staggered outside-VNet lanes when anchors are dense so edge overlap is reduced as a best effort. Reserved top clearance keeps child nodes away from the VNet and Subnet header text. Only attachment edges remain visible after layout, and those arrows are system-rendered and read-only; containment relationships are expressed by the nested node hierarchy instead of arrows.
- **Lock / Unlock interactions** — toggle canvas between read-only pan/zoom mode (Locked, highlighted button) and node-edit mode (Unlocked). In unlocked mode, users can drag/select nodes, hovering over a component name shows a pointer cursor, and clicking it opens the edit form. Edge creation and edge editing remain disabled in both modes.
- **Fit Content / Fit View** — two distinct viewport actions: Fit Content pans and zooms the viewport to show all nodes; Fit View resets the viewport to the default 1:1 zoom at the origin.
- **Export** — save diagrams as PNG, SVG, PDF, draw.io (`.drawio`), or Visio (`.vsdx`).
- **Import** — load existing diagrams from `.drawio`, `.xml`, or `.vsdx` files.
- **Saved setups** — authenticated users can persist diagrams and thumbnails to Amazon S3 and reload them at any time.
- **AI challenges** — Amazon Bedrock generates time-boxed networking challenges at four difficulty levels; the app evaluates your diagram against the challenge conditions in real time.
- **Dark / light mode** — respects the OS preference or can be overridden manually. Styling is driven by a shared token layer: app-owned CSS variables in `assets/css/main.css` cover layout, sizing, and base colors, while PrimeVue Aura provides semantic tokens for component surfaces and text.

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
