# Copilot Instructions — Azure Virtual Network Simulator

## What This Repository Does

A browser-based, single-page application (SPA) that lets users visually design, simulate, and validate Azure Virtual Network architectures. Users drag-and-drop 27 Azure networking component types onto a canvas, connect them, configure properties via side-panel forms, and optionally receive AI-generated networking challenges scored in real time. Diagrams can be exported as PNG, SVG, PDF, draw.io (`.drawio`), or Visio (`.vsdx`) and saved per-user to Amazon S3.

**Trust these instructions first. Only search the codebase if something here seems incomplete or incorrect.**

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | **Nuxt 3** (SSR disabled — pure SPA via `ssr: false` in `nuxt.config.ts`) |
| UI | **PrimeVue 4** (Aura preset from `@primevue/themes`, dark mode via `.dark-mode` class) |
| Icons | **PrimeIcons 7** (`primeicons`) for `pi pi-*` UI icons in PrimeVue buttons/components; **Iconify** (`@iconify/vue` + `@iconify-json/mdi`) for diagram & canvas icons via `<Icon icon="mdi:*" />`. PrimeVue `Button`'s `icon` prop only accepts `pi pi-*` CSS class strings — use the `#icon` slot with `<Icon>` for Iconify icons in buttons |
| State | **Pinia** stores (`stores/`) |
| Diagram engine | **Vue Flow** (`@vue-flow/core`, `@vue-flow/controls`, `@vue-flow/background`, `@vue-flow/minimap`) |
| Graph layout | **Dagre** (`lib/dagre.ts`) |
| Auth | **AWS Amplify v6** (`aws-amplify/auth`) → Amazon Cognito |
| Storage | **AWS Amplify v6** (`aws-amplify/storage`) → Amazon S3 |
| AI | **`@aws-sdk/client-bedrock-runtime`** → Amazon Bedrock |
| User settings | **MongoDB Atlas App Services** (HTTPS Endpoints / Data API) via browser `fetch()` |
| Language | **TypeScript 5** (strict mode, `skipLibCheck: true`) |
| Runtime | **Node.js ≥ 18 LTS** (tested on v24) |
| Package manager | **npm** (v9+, `package-lock.json` committed — do not use pnpm or yarn) |

---

## Repository Layout

```
azure-virtual-network-simulator/
├── app.vue                   # Root component — configures AWS, loads settings/auth on mount
├── nuxt.config.ts            # Nuxt config: ssr:false, PrimeVue, Pinia, CSS, runtimeConfig
├── tsconfig.json             # Extends .nuxt/tsconfig.json; strict:true, skipLibCheck:true
├── package.json              # Scripts: dev, build, generate, preview, postinstall
├── .env.example              # Required env var template (copy to .env)
├── pages/
│   └── index.vue             # Single page — renders AppHeader, LeftPanel, DiagramCanvas, RightPanel, BottomToolbar + all modals
├── components/
│   ├── diagram/
│   │   ├── DiagramCanvas.vue # Vue Flow canvas with node/edge types, minimap, controls, empty-state quick-start (Add VNet + Load sample buttons)
│   │   ├── edges/NetworkEdge.vue
│   │   └── nodes/            # One Vue component per NetworkComponentType (e.g. VNetNode.vue)
│   ├── forms/                # One form component per NetworkComponentType (e.g. VNetForm.vue)
│   ├── layout/               # AppHeader, LeftPanel, RightPanel, BottomToolbar
│   ├── modals/               # Auth, ComponentForm, SavedSetups, Challenge, Confirm, Congratulations
│   └── panels/               # ChallengePanel, TestFormModal
├── composables/              # Thin wrappers: useDiagram, useAI, useAuth, useExport, useImport, useLayout, useS3, useSettings, useTests
├── stores/                   # Pinia stores: diagram, auth, challenges, savedSetups, settings, tests
├── lib/
│   ├── aws.ts                # Amplify.configure() — called once in app.vue onMounted
│   ├── bedrock.ts            # Amazon Bedrock streaming invocation
│   ├── dagre.ts              # applyDagreLayout(nodes, edges) helper
│   ├── drawio.ts             # draw.io export/import
│   ├── mongodb.ts            # MongoDB Atlas App Services helpers: getUserSettings, saveUserSettings
│   ├── s3.ts                 # S3 upload/download helpers
│   └── vsdx.ts               # Visio export/import (JSZip + xmldom)
├── types/
│   ├── diagram.ts            # DiagramNode, DiagramEdge, DiagramState, SavedSetup
│   ├── network.ts            # NetworkComponentType enum + one interface per component type
│   ├── challenge.ts          # Challenge, ChallengeTask, ChallengeDifficulty
│   ├── settings.ts           # AppSettings
│   └── test.ts               # Test types
└── assets/
    ├── primevue-theme.ts     # PrimeVue Aura theme wrapper — imported by nuxt.config.ts via importTheme
    └── css/
        ├── main.css          # Global styles, CSS variables, dark mode
        └── diagram.css       # Vue Flow canvas overrides
```

### Key Architectural Patterns

- **All 27 component types** are defined as a discriminated union `AnyNetworkComponent` exported from `types/network.ts`. Every new component type needs: an entry in `NetworkComponentType` enum, an interface in `types/network.ts`, a node component in `components/diagram/nodes/`, and a form component in `components/forms/`.
- **Pinia stores** are the single source of truth. Composables in `composables/` are thin facades over store actions.
- **AWS is configured once** in `app.vue` `onMounted` by calling `configureAWS()` from `lib/aws.ts`. All AWS env vars use the `NUXT_PUBLIC_` prefix and are embedded in the client bundle.
- **`DiagramEdge` extends the Vue Flow `Edge` union type**, which hits TypeScript's depth limit. The workaround already in the codebase is a `// @ts-ignore` on the node-push line in `stores/diagram.ts`. Do not remove it.
- **Known pre-existing `vue-tsc` errors** exist in `lib/drawio.ts`, `lib/s3.ts`, `lib/vsdx.ts`, and `stores/savedSetups.ts` (type mismatches against Vue Flow's generic types). These do not block `npm run build` because Nuxt/Vite does not enforce `vue-tsc` at build time.
- **`addNode()` does NOT call `autoLayout()`**. Auto-layout is only triggered explicitly (toolbar button, `useLayout.applyAutoLayout()`). Do not re-add an implicit `autoLayout()` call inside `addNode()` — it caused O(N²) Dagre garbage accumulation and heap OOM under normal use.
- **Empty canvas quick-start** has two buttons: "Add VNet" (opens the component modal for `NetworkComponentType.VNET`) and "Load sample" (calls `loadSampleDiagram()` defined inline in `DiagramCanvas.vue`). `loadSampleDiagram()` calls `testsStore.clearAllTests()` first so any stale tests are removed, then builds a fixed 14-node diagram (1 VNet with region `southeastasia`, 3 NSGs with Allow/Deny port-80 rules, 3 Subnets, 3 NICs, 4 VMs) via `diagramStore.addNode()` and `diagramStore.addEdge()` calls with hardcoded `sample-*` IDs, then adds 4 pre-built Internet→VM connection tests and triggers `diagramStore.autoLayout()` via `nextTick`. The sample only creates **attachment** edges (NSG→Subnet/NIC and NIC→VM); containment edges are intentionally omitted because containment is expressed via `parentNode` after auto-layout. All logic lives in `DiagramCanvas.vue`.
- **Vue Flow programmatic sync via `$onAction`**. Vue Flow's `v-model:nodes` / `v-model:edges` do not reliably propagate external Pinia state mutations (reset, auto-layout position changes, bulk load) back into Vue Flow's internal stores. The fix is a `diagramStore.$onAction` subscriber registered in `DiagramCanvas.vue` `onMounted` that calls `setNodes()`, `setEdges()`, and/or `fitView()` after `resetDiagram`, `autoLayout`, and `loadDiagram` actions complete. For `resetDiagram` the subscriber also calls `setViewport({ x: 0, y: 0, zoom: 1 })` after clearing nodes/edges. Do not remove or bypass this subscriber.
- **Auto-layout uses `parentNode` for visual containment**. `lib/dagre.ts` runs Dagre with a compound graph and assigns `parentNode` (and relative positions) for a full containment hierarchy: Subnets are children of their VNet; subnet-hosted resources (NICs, VMs, VMSS, AKS, NVA, APP_SERVICE, FUNCTIONS, VPN_GATEWAY, APP_GATEWAY, BASTION, PRIVATE_ENDPOINT, and SERVICE_ENDPOINT) are children of their Subnet; VNet-attached policy resources such as NSGs/ASGs/UDRs/Firewall are parented to the VNet based on their attached subnets/NICs. Two reverse-lookup maps (`subnetToVnet` and `nicToSubnet`) are built before graph setup for that resolution. After `dagre.layout()`, semantic reflow passes re-pack each Subnet and VNet so contained resources stay visually inside their parent, NIC-linked resources render beside their NIC, and policy nodes sit above the subnet(s) they attach to. VNetNode.vue and SubnetNode.vue use `height` (not `minHeight`) so the inner div fills the full computed size. The `autoLayout()` store action **removes containment edges** post-layout — it builds a `parentMap` from the new nodes and filters any edge where `parentMap.get(source) === target` or vice versa, since the relationship is already expressed visually. Topological sort ensures parents precede children (Vue Flow requirement). `extent: undefined` — children are not locked inside parents. **Cross-cluster edges are filtered** in the `edges.forEach` block with `if (sourceParent !== targetParent) return` — dagre's compound-graph ranker cannot traverse cluster boundaries and would otherwise throw `"Cannot set properties of undefined (setting 'rank')"`. The `autoLayout()` store action is also wrapped in try/catch.
- **`INTERNET_SOURCE_ID = '__internet__'`** is exported from `types/test.ts` and acts as a special `sourceId` for connection tests. When detected, `simulateConnectionTest` in `stores/tests.ts` branches to `simulateInternetConnectionTest`, which resolves NSGs from the target VM's NIC(s) and Subnet and evaluates Inbound rules (first matching Deny → fail, first matching Allow → pass, no match → fail with default-deny message). The test form (`TestFormModal.vue`) prepends "Public Internet" to the source dropdown **only for connection and load-balance test types**. `simulateConnectionTest` has a defensive guard that returns a clear error if `sourceId` or `targetId` is empty/undefined (before any node lookups) — the form validates both fields before submitting so this guard acts as a backstop.
- **Lock Interactions**: `setInteractive(false)` disables `nodesDraggable`, `nodesConnectable`, and `elementsSelectable`. The `onNodeClick` handler in `DiagramCanvas.vue` guards on `isInteractive.value`; when locked it returns immediately. When **unlocked**, single-click on any node calls `openEditComponentModal` (replaces old double-click-only behavior). `paneMoveable` is not affected — users can always pan the viewport. **Visual state**: The lock `<ControlButton>` receives the `control-locked` CSS class when `!isInteractive` — this applies a primary-color background to visually highlight the locked state. The canvas wrapper `<div>` receives the `is-interactive` class when unlocked — `diagram.css` uses `.diagram-canvas-wrapper.is-interactive .generic-node-name, .node-name { cursor: pointer }` so hovering over any node's name label shows a pointer cursor in interactive mode (`generic-node-name` for compact-card nodes, `node-name` for container nodes VNetNode and SubnetNode).
- **Fit Content vs Fit View**: The bottom-left Controls "Fit Content" button calls Vue Flow's `fitView()` (adjusts zoom+pan to show all nodes). The top-right canvas toolbar "Fit View" button calls `setViewport({ x: 0, y: 0, zoom: 1 })` (resets to 1:1 zoom at origin without moving nodes).
- **Test form source/target type filtering**. `TestFormModal.vue` uses `SOURCE_TYPES_BY_TEST` and `TARGET_TYPES_BY_TEST` maps to restrict which component types appear in the source and target dropdowns for each test type. Connection tests allow compute/network components as source and any addressable endpoint as target; load-balance tests restrict target to `LOAD_BALANCER`/`APP_GATEWAY`; security and DNS tests have no source field. "Public Internet" (`INTERNET_SOURCE_ID`) is prepended to the source dropdown for connection and load-balance tests only. Switching test type automatically resets the source/target selections. Submit validates that both source and target are selected for connection and load-balance tests.
- **Auto-run test watchers must stay debounced and guarded**. Both `LeftPanel.vue` and `useTests.ts` watch diagram changes to trigger `runAllTests()`. Both use a 500 ms debounce and an `isRunning` guard to prevent concurrent run accumulation. Do not remove these safeguards.
- **Network Tests panel button layout**: The "Add Test" button is full-width (block style, `width: 100%`). Beneath it, "Run All" and "Delete All" sit side-by-side in a `.action-row` flex container, each with `flex: 1` (`half-btn` class). The three summary tags (Pass / Fail / Pending) in `.test-summary` are center-aligned via `justify-content: center`. Each `.test-item` card has `border-left: 3px solid var(--primary-color)` for visual separation and a subtle hover box-shadow.
- **Network Summary panel grouped views**: `RightPanel.vue` uses two computed properties — `groupedComponents` (groups `diagramStore.nodes` by `data.type`, returns `{ type, nodes }[]`) and `groupedConnections` (groups `diagramStore.edges` by `target`, returns `{ targetId, targetName, edges }[]`). The Components AccordionPanel renders a `.component-group` card per type, each with a `.group-header` (type icon + label + count badge) and a list of component names. The Connectivity AccordionPanel renders a `.conn-table` — a two-column HTML table with "Target" and "Source" column headers; the target cell spans multiple rows (`rowspan`) when a target has more than one source, using `groupedConnections` with a nested `v-for` in a `<template>` block. The target cell (`.conn-target-cell`) has a right border and muted background to visually separate it from source cells (`.conn-source-cell`).
- **`bedrockClient` and `_saveTimer` expose HMR cleanup hooks**. Both module-level singletons register `import.meta.hot.dispose()` handlers to null out references on hot-reload, preventing leaked AWS SDK HTTP connection pools and stale timer callbacks from holding store references across HMR cycles.
- **`markRaw` is required for nodeTypes and edgeTypes**. The `nodeTypes` and `edgeTypes` objects in `DiagramCanvas.vue` must wrap every component value with `markRaw()` (imported from `'vue'`). Without this, Vue makes the component objects reactive, causing `[Vue warn]: Vue received a Component that was made a reactive object` warnings on every render. The pattern is: `'vnet-node': markRaw(VNetNode) as any`.
- **ConfirmActionDialog** (`components/modals/ConfirmActionDialog.vue`) is the project's custom confirm dialog wired to `diagramStore.confirmDialogMessage` and `diagramStore.executeConfirmedAction()`. It is registered in `pages/index.vue` as `<ConfirmActionDialog />`. Do NOT rename it back to `ConfirmDialog` — Nuxt 3 auto-import would resolve that name to PrimeVue 4's own `ConfirmDialog` (which requires a separate `ConfirmationService`), silently replacing the custom component and breaking the Reset, Import, and AI Challenge confirm flows. **Optional checkbox**: `confirmAction(message, action, checkboxLabel?)` accepts an optional third argument. When provided, `ConfirmActionDialog` renders a PrimeVue `Checkbox` bound to `diagramStore.confirmDialogCheckboxChecked`; `executeConfirmedAction()` passes `confirmDialogCheckboxChecked` as the first argument to the action callback. The Reset toolbar button uses this to offer "Also reset all network tests". The callback signature is `(checkboxChecked?: boolean) => void`. The Network Tests panel has a "Delete All" button that calls `confirmAction` with no checkbox label and triggers `testsStore.clearAllTests()`; `clearAllTests()` is a store action defined in `stores/tests.ts` that sets `tests` to `[]`.
- **PrimeVue theme configuration** uses `importTheme` in `nuxt.config.ts` (not `options.theme.preset`). The Aura preset object contains JavaScript functions that are silently stripped by JSON serialization through `runtimeConfig`, so the preset must be imported at build time via `assets/primevue-theme.ts`. The `@primevue/themes` package must remain in `dependencies`.
- **Icon systems**: PrimeIcons (`primeicons` package, `primeicons/primeicons.css`) provides `pi pi-*` CSS font icons used in PrimeVue `Button` `icon` prop. Iconify (`@iconify/vue`) provides SVG-based MDI icons via `<Icon icon="mdi:*" />` — these must NOT be passed to the PrimeVue `Button` `icon` prop (use the `#icon` slot instead). Both CSS files (`primeicons/primeicons.css` and `@vue-flow/controls/dist/style.css`) are included in the `css` array in `nuxt.config.ts`.

---

## Environment Setup

1. Copy `.env.example` to `.env` and fill in real AWS values (required even for local dev if auth/S3/Bedrock features are tested).
2. All variables are `NUXT_PUBLIC_*` — they are public client-side config, not secrets.

```dotenv
NUXT_PUBLIC_AWS_REGION=us-east-1
NUXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NUXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NUXT_PUBLIC_S3_BUCKET=your-diagrams-bucket-name
NUXT_PUBLIC_BEDROCK_REGION=us-east-1
NUXT_PUBLIC_MONGODB_ENDPOINT=https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1
NUXT_PUBLIC_MONGODB_API_KEY=your-atlas-app-services-api-key
NUXT_PUBLIC_MONGODB_DATABASE=vnet-simulator
NUXT_PUBLIC_MONGODB_COLLECTION=user_settings
```

---

## Build & Validation Commands

Always run `npm install` before building after any dependency change. The `postinstall` script runs `nuxt prepare` automatically to generate `.nuxt/` and TypeScript types.

```bash
# Install dependencies (also runs nuxt prepare via postinstall)
npm install

# Development server — http://localhost:3000 with HMR
npm run dev

# Production build — outputs to .output/
npm run build

# Static SPA generation — outputs to .output/public/ (deploy to any CDN)
npm run generate

# Preview production build locally
npm run preview
```

### Build Notes

- **`npm run build` is the authoritative validation step.** It succeeds even when `vue-tsc` reports errors because Nuxt uses Vite (not `tsc`) for compilation.
- **`npm run generate` also succeeds** and produces a fully static SPA. SSR is disabled (`ssr: false`), so HTML content is not server-rendered — this is expected and not an error.
- The build prints a `[DEP0155] DeprecationWarning` about trailing slash pattern mappings from `@vue/shared`. This is a **harmless warning** from a transitive dependency, not a build failure.
- Build time: approximately 5–10 seconds for client + server bundles.
- There is **no test suite** (`npm test` is not defined).
- There is **no ESLint or Prettier configuration** — no lint script exists.
- Type-checking with `npx vue-tsc --noEmit` **will report errors** in `lib/drawio.ts`, `lib/s3.ts`, `lib/vsdx.ts`, `stores/savedSetups.ts`, and `types/diagram.ts`. These are pre-existing and do not block the build. Do not introduce new `vue-tsc` errors in files you modify.

### CI / GitHub Actions

No GitHub Actions workflows exist in this repository. There is no automated CI pipeline. The sole validation gate is `npm run build` completing without error.

---

## Adding a New Azure Component Type

1. Add a value to `NetworkComponentType` enum in `types/network.ts`.
2. Add a corresponding interface extending `NetworkComponent` in `types/network.ts`, and include it in the `AnyNetworkComponent` union.
3. Create `components/diagram/nodes/<TypeName>Node.vue`.
4. Create `components/forms/<TypeName>Form.vue`.
5. Register the node type in `components/diagram/DiagramCanvas.vue` (`nodeTypes` map).
6. Add the component to the `LeftPanel` or `BottomToolbar` palette.
7. Add sizing helpers in `stores/diagram.ts` (`getNodeWidth`, `getNodeHeight`, `getNodeType`).
