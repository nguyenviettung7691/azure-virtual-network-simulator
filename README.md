# Azure Virtual Network Simulator

An interactive, browser-based topology designer and simulator for Azure Virtual Network architectures. Build, visualise, and validate Azure network diagrams using a drag-and-drop canvas, then challenge yourself with AI-generated networking tasks.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Azure Network Components](#azure-network-components)
- [Developer Onboarding](docs/developer-onboarding.md)
- [Deployment](docs/deployment.md)
- [AWS Services Integration](docs/aws-services-integration.md)
- [Project Structure](#project-structure)
- [Key Composables](#key-composables)
- [Export & Import Formats](#export--import-formats)
- [Challenge System](#challenge-system)
- [Settings](#settings)

---

## Features

**Canvas & Visualization**
- **Interactive Canvas** — Drag-and-drop interface with automatic system nodes (Public Internet) and attachment lines.
- **Smart Auto-Layout** — One-click hierarchical graph layout with deterministic left-to-right data flow.
- **High-Contrast Edges** — Theme-aware edge rendering for clarity.
- **Canvas Controls** — Lock/unlock, fit view, interactive minimap, and clear board.

**Configuration & Design**
- **Component Configuration** — Click-to-edit property forms for all Azure components.
- **Real-Time Network Summary** — Live dashboard with collapsible sections, type grouping, hover identification, and audit badges.
- **Quick Sample + Full Sample** — Pre-built starter topologies.

**Testing & Validation**
- **Network Testing** — Connection, load-balancing, and DNS test creation and execution.
- **Security & Performance Audits** — Continuous best-practice checks (NSG coverage, health probes, etc.).
- **Connection Flow Animations** — Visualize test paths with animated travelers and color-coded results.

**Data & Integration**
- **Import & Export** — Toolbar export/import supports `.drawio`, PNG, SVG, and PDF; parser/composable import also handles `.xml` payloads.
- **Cloud Saves** — S3-backed saved setups with metadata and thumbnail previews for authenticated users.
- **AI Challenges** — Bedrock-powered, time-boxed networking exercises.

**Accessibility**
- **Tablet-Responsive Toolbars** — Optimized for viewports <= 1024px.
- **Dark / Light Mode** — Theme support with system preference respect.

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | Nuxt 3 (SPA, SSR disabled) |
| UI component library | PrimeVue 4 (Aura preset via `@primevue/themes`) |
| Styling & theming | App-owned CSS tokens in `assets/css/main.css` plus PrimeVue Aura semantic tokens from `assets/primevue-theme.ts` |
| Icons | PrimeIcons 7 (`primeicons`) for `pi pi-*` UI icons; Iconify + `@iconify-json/mdi` for diagram/canvas icons via `@iconify/vue` |
| Local app state | Pinia |
| Remote / server state | TanStack Vue Query (`@tanstack/vue-query`) |
| Diagram engine | Vue Flow (`@vue-flow/core`) + `@vue-flow/controls` + `@vue-flow/background` + `@vue-flow/minimap` |
| Graph layout | Dagre |
| Utilities | VueUse |
| Image export | App-owned DOM-to-SVG serializer (`lib/export/domSnapshot.ts`) |
| PDF export | pdf-lib |
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
  - Adds 14 tests covering all major component categories: Application Gateway load-balancing, private-endpoint connectivity, Bastion inbound access, Azure Firewall, Internal Load Balancer east-west, Internal App Gateway, Public DNS Zone resolution, AKS private API server, App Service -> Key Vault, VMSS inbound, Functions -> Storage, VPN Gateway access, Public App Service, and additional DNS resolution.

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

Requires **Node.js >= 18 LTS** and **npm >= 9**, plus an AWS account with Cognito, S3, Bedrock, and MongoDB Atlas configured. After cloning, run `npm install` then copy `.env.example` to `.env` and fill in the `NUXT_PUBLIC_*` values. Start the dev server with `npm run dev`; generate a static build with `npm run generate`.

For full setup instructions, environment variable reference, and build commands, see [Developer Onboarding](docs/developer-onboarding.md).

---

## Deployment

This project is a client-side Nuxt SPA (`ssr: false`). The canonical topology uses **AWS Amplify** as the build/deploy origin with **CloudFront** as the custom-domain front door. Cache invalidation is automated via EventBridge -> Lambda -> CloudFront after each successful Amplify deployment. Infrastructure for the deployment edge (CloudFront, ACM, Route 53, EventBridge, Lambda) is Terraform-managed in `infra/`.

For full deployment instructions, Amplify build config, Terraform prerequisites, and rollback procedures, see [Deployment Guide](docs/deployment.md).

---

## AWS Services Integration

The app depends on four AWS-adjacent services. The Terraform stack in `infra/` provisions the deployment edge but does **not** provision these application-layer resources.

| Service | Purpose |
|---|---|
| **Amazon Cognito** | User authentication (sign up, sign in, password reset) |
| **Amazon S3** | Per-user persistence of saved diagram setups |
| **Amazon Bedrock** | AI-generated networking challenges (Nova 2 Lite via global cross-region inference) |
| **MongoDB Atlas** | User preference settings via AWS Lambda Function URL proxy |

For full console setup instructions for each service, see [AWS Services Integration](docs/aws-services-integration.md).

---

## Project Structure

```
|-- app.vue                  # Root component - configures AWS, boots auth query, mounts settings sync
|-- nuxt.config.ts           # Nuxt configuration, runtime config, PrimeVue setup
|-- assets/
|   |-- primevue-theme.ts    # PrimeVue Aura theme config (preset + darkModeSelector)
|   \-- css/                 # Global and diagram-specific styles
|-- components/
|   |-- diagram/             # Canvas, custom nodes, and edge components (Vue Flow, including connection-test animation mode)
|   |-- forms/               # Per-component property forms (one per NetworkComponentType)
|   |-- layout/              # AppHeader, LeftPanel, RightPanel, BottomToolbar
|   |-- modals/              # Auth, settings, saved setups, challenge, confirm dialogs
|   \-- panels/              # ChallengePanel, TestFormModal
|-- composables/             # Reusable logic plus Vue Query hooks/controllers (auth, settings, saved setups, export, import, AI)
|-- lib/
|   |-- aws.ts               # Amplify bootstrap (Cognito + S3)
|   |-- bedrock.ts           # Bedrock client + challenge generation prompt
|   |-- s3.ts                # S3 helpers for canonical saved setup records and thumbnails
|   |-- dagre.ts             # Auto-layout integration
|   |-- drawio.ts            # draw.io XML import/export
|   |-- layout.ts            # Node dimension constants (base widths, heights, min sizes)
|   |-- mongodb.ts           # MongoDB Atlas Lambda proxy helpers (read/upsert user settings via JWT-authenticated Function URL)
|   \-- export/              # Export pipeline (worker, raster, SVG, PDF helpers, format serializers)
|-- plugins/
|   \-- vue-query.ts         # Shared QueryClient + Vue Query plugin registration
|-- pages/index.vue          # Single page - renders the full application layout
|-- stores/                  # Pinia stores for diagram state and local UI/app state (remote state is query-driven)
\-- types/                   # TypeScript interfaces and enums
```

---

## Key Composables

| Composable | Responsibility |
|---|---|
| `useAuth` | Exposes Pinia auth state plus Vue Query-backed auth actions |
| `useAuthQueries` | Current-user query and auth mutations against Amplify Auth |
| `useDiagram` | CRUD operations for nodes plus programmatic management of system-rendered edges and the temporary animation-mode overlay |
| `useAI` | Triggers Bedrock challenge generation via the challenges store |
| `useS3` | Compatibility wrapper around query-backed saved setup save/load/delete operations |
| `useSavedSetupQueries` | Vue Query hooks for S3-backed saved setup list/save/delete |
| `useExport` | Exports the canvas to PNG, SVG, PDF, or draw.io |
| `useImport` | Imports diagram files; toolbar flow currently picks `.drawio`, while parser-level `importFromFile(...)` accepts `.drawio` and `.xml`; successful app-native `.drawio` imports can prompt to reset existing network tests after the diagram finishes rendering |
| `useLayout` | Wraps Dagre to auto-arrange nodes on demand (not triggered automatically on every node addition) |
| `useSettings` | Reads and writes local user preferences via the settings store |
| `useSettingsQueries` | Vue Query controller/hooks for MongoDB-backed settings load/save |
| `useTests` | Runs validation tests against the current diagram state; auto-runs are debounced (500 ms) and skip concurrent runs |

---

## Export & Import Formats

| Format | Extension | Direction |
|---|---|---|
| PNG image | `.png` | Export |
| SVG image | `.svg` | Export |
| PDF document | `.pdf` | Export |
| draw.io diagram | `.drawio` | Export & Import (toolbar UI) |
| draw.io XML payload | `.xml` | Import (parser/composable path) |

Export behavior details:

- Export toolbar buttons: `.drawio`, `PNG`, `PDF`, `SVG`.
- Default export filename format: `azure-vnet-YYYYMMDD-HHmmss`.
- Custom filename: provided via inline input in the Export toolbar; extension is normalized to the selected format.
- Progress behavior:
  - `PNG`, `PDF`, `SVG` show determinate progress updates based on export stages.
  - `.drawio` uses spinner-first progress and transitions to determinate mode for longer-running exports.
- Export lock behavior:
  - While any export is running, all export buttons are disabled until that export completes or fails.
- Rendering behavior:
  - `SVG` export uses an app-owned DOM-to-SVG serializer to capture an exact serialized snapshot of the live diagram canvas.
  - `PNG` and `PDF` render from diagram state via a canvas-based raster path (worker-first, with a main-thread fallback) to avoid `foreignObject`-dependent rasterization.
  - `.drawio` export serializes structured diagram state in a worker-side format helper instead of serializing the live DOM.
  - If worker conversion is unavailable, PNG/PDF fallback to the compatible main-thread path.
  - Save thumbnails reuse the same diagram-state raster pipeline so export and cloud-save previews stay visually aligned.
- Import behavior:
  - Import parser accepts `.drawio` and `.xml` and replaces the current diagram state after a successful parse.
  - Bottom toolbar file picker currently filters to `.drawio`.
  - Successful app-native `.drawio` imports wait for the imported diagram to finish rendering and fit into view before any follow-up test prompt is shown.
  - If network tests already exist, successful app-native `.drawio` imports ask whether those existing tests should also be reset.
  - Choosing to keep existing tests preserves them and reruns them against the imported diagram when auto-run is enabled.
- Known limitations (current PNG/PDF/thumbnail renderer):
  - Raster exports currently prioritize topology clarity and deterministic positioning over pixel-perfect parity with live node templates, iconography, and CSS-only visual effects.
- Round-trip compatibility:
  - `.drawio` export preserves component metadata for re-import into the simulator.

---

## Challenge System

Challenges are AI-generated JSON objects that instruct the user to build a specific Azure network topology. They include:

- **Difficulty** — `BEGINNER` | `INTERMEDIATE` | `ADVANCED` | `EXPERT`
- **Tasks** — typed actions (`add_component`, `connect_components`, `configure_component`, `remove_component`) each worth a set number of points
- **Conditions** — required components, required connections, security requirements, and network requirements
- **Time limit** — a countdown timer tracked in seconds
- **Scoring** — points accumulated as tasks are completed; a congratulations modal fires when all tasks are done

The diagram store evaluates challenge completion automatically whenever the canvas state changes.

---

## Settings

User preferences are persisted to **MongoDB Atlas** when the user is authenticated and restored through a Vue Query-driven sync pass after session bootstrap. The remote document always takes precedence once loaded and is written back through a 1.5-second debounced mutation. Persistence is handled via an **AWS Lambda Function URL proxy** — the browser sends its Cognito ID token, and the Lambda verifies it before executing the query, so MongoDB credentials never reach the client bundle. `localStorage` remains the immediate-write cache and the sole persistence layer when the user is not signed in, ensuring preferences are available offline and before any network round-trip completes.

Persisted settings currently include:

| Setting | Default | Options |
|---|---|---|
| Theme | `ocean-blue` | Multiple PrimeVue presets |
| Dark mode | `system` | `system` / `light` / `dark` |
| Language | `en` | — |
| Auto-save | `true` | toggle |
| Auto-save interval | `30` s | Any positive integer |
| Default Azure region | `eastus` | Any Azure region string |
| Default resource group | `my-rg` | Any resource group string |
| Show minimap | `true` | toggle |
| Show grid | `true` | toggle |
| Snap to grid | `false` | toggle |
| Grid size | `20` px | Number |
| Animate edges | `true` | toggle |
| Compact nodes | `false` | toggle |
| Show tooltips | `true` | toggle |
| Sidebar collapsed | `false` | toggle |
| Right panel collapsed | `false` | toggle |

The Account Settings modal exposes a subset of these directly; the rest are persisted for layout/session compatibility across launches and authenticated sync.
