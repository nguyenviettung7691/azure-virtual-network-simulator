# Copilot Instructions — Azure Virtual Network Simulator

## What This Repository Does

A browser-based, single-page application (SPA) that lets users visually design, simulate, and validate Azure Virtual Network architectures. Users drag-and-drop 27 Azure networking component types onto a canvas, and non-empty diagrams also show a single system-managed **Public Internet** node. Users configure properties via side-panel forms, and can optionally receive AI-generated networking challenges scored in real time. Diagrams can be exported as PNG, SVG, PDF, draw.io (`.drawio`), or Visio (`.vsdx`) and saved per-user to Amazon S3.

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
│   │   ├── DiagramCanvas.vue # Vue Flow canvas with node/edge types, minimap, controls, empty-state quick-start, and connection-test animation mode
│   │   ├── edges/AnimationEdge.vue
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

- **All 27 user-managed component types plus the system-managed Public Internet node** are defined in the discriminated union `AnyNetworkComponent` exported from `types/network.ts`. User-managed types follow the normal pattern: an entry in `NetworkComponentType`, an interface in `types/network.ts`, a node component in `components/diagram/nodes/`, and a form component in `components/forms/`. The Public Internet node is the exception: it has an enum value, interface, icon/color/label metadata, and a node component, but it is **not** palette-creatable and does **not** have a form component.
- **Pinia stores** are the single source of truth. Composables in `composables/` are thin facades over store actions.
- **AWS is configured once** in `app.vue` `onMounted` by calling `configureAWS()` from `lib/aws.ts`. All AWS env vars use the `NUXT_PUBLIC_` prefix and are embedded in the client bundle.
- **`DiagramEdge` extends the Vue Flow `Edge` union type**, which hits TypeScript's depth limit. The workaround already in the codebase is a `// @ts-ignore` on the node-push line in `stores/diagram.ts`. Do not remove it.
- **Known pre-existing `vue-tsc` errors** exist in `lib/drawio.ts`, `lib/s3.ts`, `lib/vsdx.ts`, and `stores/savedSetups.ts` (type mismatches against Vue Flow's generic types). These do not block `npm run build` because Nuxt/Vite does not enforce `vue-tsc` at build time.
- **`addNode()` does NOT call `autoLayout()`**. Auto-layout is only triggered explicitly (toolbar button, `useLayout.applyAutoLayout()`). Do not re-add an implicit `autoLayout()` call inside `addNode()` — it caused O(N²) Dagre garbage accumulation and heap OOM under normal use.
- **Empty canvas quick-start** has three buttons: "Add VNet" (opens the component modal for `NetworkComponentType.VNET`), "Quick Sample" (calls `loadQuickSampleDiagram()`), and "Full Sample" (calls `loadFullSampleDiagram()`), both defined inline in `DiagramCanvas.vue`. `loadQuickSampleDiagram()` calls `testsStore.clearAllTests()` first so any stale tests are removed, then builds a fixed 17-node diagram: 1 VNet with region `southeastasia`, 3 NSGs with Allow/Deny port-80 rules plus explicit deny-all rules, 3 Subnets, 3 NICs with static private IPs, 4 VMs, 1 Standard Public IP, 1 Standard Public Load Balancer, and 1 Private DNS Zone linked to the VNet. It then adds 6 pre-built tests: 4 Internet→VM connection tests, 1 load-balance validation, and 1 DNS resolution test, before triggering `diagramStore.autoLayout()` via `nextTick`. `loadFullSampleDiagram()` must build on this baseline by adding the remaining supported component types across all three layers: **Public-facing layer** (Public IP, VPN Gateway, Public App Gateway, Public Load Balancer, Bastion, public App Service, public DNS Zone); **VNet-managed layer** (ASG, UDR, NVA, VMSS, AKS, Internal App Gateway, Internal Load Balancer, Service Endpoint, Private Endpoint, Firewall, VNet Peering); **Private layer** (Storage Account, Blob Storage, Managed Disk, Key Vault, Managed Identity, Private DNS Zone). Full Sample also adds extra tests that exercise public-to-backend, VNet, and private connectivity scenarios. Both sample loaders must create only **attachment** edges (NSG→Subnet/NIC, NIC→VM, PublicIP→LB/AppGW, LB/AppGW→backend, endpoint/policy attachments, DNS-zone links, etc.); containment edges remain intentionally omitted because containment is expressed via `parentNode` after auto-layout. Those attachment edges are system-managed and read-only in the canvas UI. The intended post-layout result remains: VNets/Subnets wrap contained workloads, policy nodes stay outside VNet lanes, public-facing nodes occupy a dedicated top lane, and private infrastructure nodes remain in bottom rows.
- **Vue Flow programmatic sync via `$onAction`**. Vue Flow's `v-model:nodes` / `v-model:edges` do not reliably propagate external Pinia state mutations (reset, auto-layout position changes, bulk load) back into Vue Flow's internal stores. The fix is a `diagramStore.$onAction` subscriber registered in `DiagramCanvas.vue` `onMounted` that calls `setNodes()`, `setEdges()`, and/or `fitView()` after `resetDiagram`, `autoLayout`, and `loadDiagram` actions complete. For `resetDiagram` the subscriber also calls `setViewport({ x: 0, y: 0, zoom: 1 })` after clearing nodes/edges. Do not remove or bypass this subscriber.
- **Auto-layout layer lane reflow.** After Dagre+Kahn, the pipeline order is: `reflowSubnetContainers` → `reflowVnetContainers` → `compactRootVnetSpacing` → `reflowOutsideVnetPolicies` → `reflowPublicFacingNodes` → `enforceRootVnetTopBandClearance` → `reflowRootVnetManagedNodes` → `reflowRootInfrastructureNodes` → `reflowVnetPeeringNodes` → `positionPublicInternetNodes` → `normalizeAbsolutePositions`. `compactRootVnetSpacing` must normalize root-VNet rows to deterministic minimum X/Y gaps on every run so manual re-layout cannot overlap VNets, and it must keep row-to-row Y spacing on a strict deterministic rhythm (including push-down correction when a rerun drifts a row upward). `reflowPublicFacingNodes` places root-level public-facing nodes in a dedicated lane above policy nodes using semantic classification (VPN Gateway, Bastion, IP Address, public DNS Zone, public App Gateway/Load Balancer, and public App Service/Functions). `reflowRootVnetManagedNodes` then places root-level VNet-layer non-container nodes below VNet content. `reflowRootInfrastructureNodes` places only root-level private-layer nodes (storage/identity/backing services) in compact bottom rows. `VNET_PEERING` uses Local-VNet containment (`parentNode = localVnetId`) and `reflowVnetPeeringNodes` now repositions only unparented peering nodes as fallback behavior when containment is not available. Do not add VNET_PEERING or public-facing types to `OUTSIDE_VNET_POLICY` — that set controls only policy-lane placement.
- **`getNodeType` in `stores/diagram.ts`** maps `NetworkComponentType` values to Vue Flow node-type strings. FIREWALL, BASTION, PRIVATE_ENDPOINT, and SERVICE_ENDPOINT all map to `'compute-node'`; `ComputeNode.vue` is fully generic and reads `data.type` to select the correct Azure icon/label/color via `getComponentIcon/Label/Color`. Do NOT map these types to `nsg-node`, `vpn-gateway-node`, or `network-ic-node` — doing so renders the wrong icon and label in the diagram canvas and Full Sample.
- **Auto-layout algorithm sequencing and edge-side policy.** Every `autoLayout()` run is a staged pipeline: (1) Kahn topological sort (BFS on zero in-degree nodes) runs first as the mathematical prerequisite ordering pass; it uses deterministic tie-breaking and appends unresolved cyclic nodes deterministically so layout always completes. (2) Dagre hierarchical layout (Sugiyama-style, `rankdir: 'LR'`) computes directional left-to-right placement. (3) Orthogonal routing is rendered through smoothstep edges, and store-level edge normalization enforces layer-aware side attachment across four vertical bands (`System-Managed` -> `Public-Facing` -> `VNet` -> `Private`) on persisted infrastructure edges after layout. **Layer classification** (via `getComponentLayer(type, data)` in `stores/diagram.ts`): Always Public-Facing: VPN_GATEWAY, BASTION, IP_ADDRESS, public DNS_ZONE; Always VNet: VNET, SUBNET, VNET_PEERING, NIC, NSG, ASG, FIREWALL, UDR, NVA, VM, VMSS, AKS, SERVICE_ENDPOINT, PRIVATE_ENDPOINT; Always Private: STORAGE_ACCOUNT, BLOB_STORAGE, MANAGED_DISK, KEY_VAULT, MANAGED_IDENTITY, private DNS_ZONE; Config-driven: APP_GATEWAY (frontendType: 'Public' | 'Internal'), LOAD_BALANCER (loadBalancerType: 'Public' | 'Internal'), APP_SERVICE/FUNCTIONS (VNet Integration or Private Endpoint presence), AKS (node pools in VNet, apiServerAccess: 'Public' | 'Private'). **Routing by layer relationship**: higher -> lower uses `sourcePosition: Position.Bottom` and `targetPosition: Position.Top` with `sourceHandle: 'bottom'` and `targetHandle: 'top'`; same-layer (and ambiguous layer cases) uses `sourcePosition: Position.Right` and `targetPosition: Position.Left` with `sourceHandle: undefined` and `targetHandle: undefined`; lower -> higher uses `sourcePosition: Position.Top` and `targetPosition: Position.Bottom` with `sourceHandle: 'top-source'` and `targetHandle: 'bottom-target'`. Containment hierarchy: Subnets are children of their VNet; VNet Peering is parented to its `localVnetId`; subnet-hosted resources (NICs, VMs, VMSS, AKS, NVA, APP_SERVICE, FUNCTIONS, VPN_GATEWAY, APP_GATEWAY, BASTION, PRIVATE_ENDPOINT, and SERVICE_ENDPOINT) are children of their Subnet; Firewall keeps its direct `vnetId` containment path. NSGs, ASGs, and UDRs are **not** parented to the VNet. Two reverse-lookup maps (`subnetToVnet` and `nicToSubnet`) are built before graph setup.
- **`INTERNET_SOURCE_ID = '__internet__'`** is exported from `types/test.ts` and acts as both the special `sourceId` for internet-originated tests and the persisted node id for the visible system-managed **Public Internet** node. When detected, `simulateConnectionTest` in `stores/tests.ts` branches to `simulateInternetConnectionTest`, which resolves NSGs from the target VM's NIC(s) and Subnet and evaluates Inbound rules (first matching Deny → fail, first matching Allow → pass, no match → fail with default-deny message). The test form (`TestFormModal.vue`) prepends "Public Internet" to the source dropdown **only for connection and load-balance test types** and filters the visible system-managed node out of the regular node option lists so the internet source is not duplicated. `simulateConnectionTest` has a defensive guard that returns a clear error if `sourceId` or `targetId` is empty/undefined (before any node lookups) — the form validates both fields before submitting so this guard acts as a backstop.

- **Connection-test Animation mode is a temporary rendered overlay, not persisted diagram state.** `stores/diagram.ts` owns `viewMode` (`'infrastructure' | 'animation'`) and an ephemeral `animationSession` used only for canvas rendering. `components/layout/LeftPanel.vue` shows a **Run animation** action for **connection, load-balance, and DNS tests**; clicking it reruns that test first via `testsStore.runTest(...)`, then drives animation as follows. **Connection tests**: calls `diagramStore.playConnectionAnimation(...)` with `result.path` directly. **Load-balance tests**: `buildLoadBalancingPath` returns `[sourceId, lbNodeId, vm1Id, vm2Id, ...]` with ALL backend VM IDs; `runAnimation()` splits this into two phases: Phase 1 animates `[sourceId, lbId]` sequentially via `playConnectionAnimation` at the default hop duration (`DEFAULT_ANIMATION_SEGMENT_MS`, currently 1600 ms/hop), then after a 200 ms pause Phase 2 calls `diagramStore.playParallelSegments({segments: [[lbId, vm1Id], [lbId, vm2Id], ...]})` which fires all travelers simultaneously — each LB→VM segment gets its own paper-plane at the same time; if the user exits during either phase the loop stops immediately. `playParallelSegments` is a store action in `stores/diagram.ts` that creates overlay edges for all segments with `travelerVisible: true` simultaneously, waits one `segmentDurationMs`, then marks all segments with the terminal state. **DNS tests**: the raw `result.path` may end with a resolved IP string (e.g. `'10.0.1.10'`) rather than a node ID; `runAnimation()` resolves each entry that is not a valid node ID by searching `node.data.privateIpAddress` / `node.data.ipAddress`, maps sentinel strings `'Internet'` and `'DNS Client'` through unchanged (handled downstream by `resolveAnimationPathNodeId`), drops unresolvable entries, and calls `playConnectionAnimation` with the filtered path. `DiagramCanvas.vue` swaps its rendered edges to `animationSession.overlayEdges`, decorates node wrapper classes from `animationSession.nodeStates`, forces the canvas into read-only interaction while animating, and shows a fixed, top-centered **Exit animation** button that calls `diagramStore.stopAnimation()`.
- **Edge rendering uses smoothstep paths.** Both `NetworkEdge.vue` (infrastructure mode) and `AnimationEdge.vue` (animation mode) use `getSmoothStepPath` from `@vue-flow/core` (with `borderRadius: 12`) instead of `getBezierPath`. This gives orthogonal right-angle paths with rounded corners, which reduces visual overlap with nodes. Infrastructure edges use a dedicated theme token (`--diagram-edge-color`) for high contrast: dark neutral in light mode and near-white in dark mode; edge labels and arrow markers use the same token. The sample diagram edge helper should not hardcode per-edge blue colors. The `@keyframes animationEdgePulse` (for AnimationEdge active state — marching dashes flowing along the path, `stroke-dashoffset: 0 → -20` at `0.5s linear infinite`) and `@keyframes dashdraw` (for NetworkEdge animated attachment edges) are defined globally in `assets/css/diagram.css`. These keyframes must stay global — not in `<style scoped>` — because they are referenced by inline `animation` style properties on SVG elements rendered inside child components.
- **Lock Interactions**: manual edge creation/editing is disabled at the Vue Flow level at all times (`nodesConnectable: false`, `edgesUpdatable: false`, `connectOnClick: false`). The lock toggle in `DiagramCanvas.vue` only enables/disables `nodesDraggable` and `elementsSelectable`. The `onNodeClick` handler guards on `isInteractive.value`; when locked it returns immediately. When **unlocked**, single-click on user-managed nodes calls `openEditComponentModal` (replaces old double-click-only behavior), while the system-managed **Public Internet** node can be selected but does not open a form. `paneMoveable` is not affected — users can always pan the viewport. Vue Flow handles remain mounted for geometry calculations but are hidden via shared CSS, because removing them from the DOM breaks edge anchoring. **Visual state**: The lock `<ControlButton>` receives the `control-locked` CSS class when `!isInteractive` — this applies a primary-color background to visually highlight the locked state. The canvas wrapper `<div>` receives the `is-interactive` class when unlocked — `diagram.css` uses `.diagram-canvas-wrapper.is-interactive .generic-node-name, .node-name { cursor: pointer }` so hovering over any node's name label shows a pointer cursor in interactive mode (`generic-node-name` for compact-card nodes, `node-name` for container nodes VNetNode and SubnetNode).
- **MiniMap interactions**: `<MiniMap>` in `DiagramCanvas.vue` is configured with `pannable` and `zoomable` (per Vue Flow docs). Users can drag on minimap to pan and use wheel-scroll on minimap to zoom the main viewport.
- **Fit Content vs Fit View**: The bottom-left Controls "Fit Content" button calls Vue Flow's `fitView()` (adjusts zoom+pan to show all nodes). The top-right canvas toolbar "Fit View" button calls `setViewport({ x: 0, y: 0, zoom: 1 })` (resets to 1:1 zoom at origin without moving nodes).
- **Test form source/target type filtering**. `TestFormModal.vue` uses `SOURCE_TYPES_BY_TEST` and `TARGET_TYPES_BY_TEST` maps to restrict which component types appear in the source and target dropdowns for each test type. Connection tests allow compute/network components as source and any addressable endpoint as target; load-balance tests restrict target to `LOAD_BALANCER`/`APP_GATEWAY`; DNS tests require a DNS Zone target and expose an optional hostname input for real record resolution. "Public Internet" (`INTERNET_SOURCE_ID`) is prepended to the source dropdown for connection and load-balance tests only. Switching test type automatically resets the source/target selections and clears connection-only / DNS-only fields such as `port` and `hostname`. The old `connectionCount` field is gone. Submit validates both source and target for connection and load-balance tests, and validates the DNS Zone for DNS tests.
- **Auto-run test watchers must stay debounced and guarded**. Both `LeftPanel.vue` and `useTests.ts` watch diagram changes to trigger `runAllTests()`. Both use a 500 ms debounce and an `isRunning` guard to prevent concurrent run accumulation. Do not remove these safeguards.
- **Test auto-run is triggered only by explicit load/import events, not by structural diagram changes.** `stores/diagram.ts` owns a `diagramLoadId: number` counter (initialized to `0`) that is incremented only in `loadDiagram` (handles saved-setup and file-import loads) and by the `notifyDiagramLoaded()` action (called at the end of sample loaders in `DiagramCanvas.vue` after auto-layout, including `loadQuickSampleDiagram()` and the extended `loadFullSampleDiagram()` flow). `composables/useTests.ts` watches `diagramStore.diagramLoadId` to trigger `runAllTests()` when the counter changes (and is non-zero). `LeftPanel.vue` does **not** have its own auto-run watcher. A separate debounced watcher on `[diagramStore.nodes.length, diagramStore.edges.length]` remains in `useTests.ts` **solely for challenge evaluation** (`challengesStore.evaluateCompletion(...)`), not for running tests. Do not re-add a watcher on `nodes.length`/`edges.length` to trigger `runAllTests()` — doing so causes spurious re-runs after auto-layout (which removes containment edges, changing edge count) and after exit-animation.
- **Network Tests panel button layout**: The "Add Test" button is full-width (block style, `width: 100%`). Beneath it, "Run All" (`severity="success"`) and "Delete All" (`severity="danger"`) sit side-by-side in a `.action-row` flex container, each with `flex: 1` (`half-btn` class). The summary tags are rendered in two centered rows in `.test-summary`: first row `Pass / Fail / Warning`, second row `Total`. Each `.test-item` card has `border-left: 3px solid var(--primary)`. The card has two rows: `.test-header-row` (type icon + test name, separated by a bottom border) and `.test-footer-row` (uppercase result `<Tag>` on the left, Run/Edit/Delete buttons on the right). Below the footer, `.result-message-wrap` shows the result message text, `.result-details` renders any detailed findings from `result.details`, and `.test-flowchart` (when a non-pending/running result exists) renders an icon+label inline flowchart with `overflow-x: auto` horizontal scroll. `getFlowPath(test: NetworkTest): FlowNode[]` drives the flowchart; `FlowNode` has `{ label, icon, blocked?, success?, warning? }`. For all test types (connection, loadbalance, dns), after mapping `result.path` via `resolveFlowItem`, the **last** node gets `blocked: true` on `fail`, `success: true` on `pass`, or `warning: true` on `warning`. A `blocked` last node renders a red `mdi:close-circle` badge (`.flow-blocked-badge`) and colours the main icon red (`.fni-blocked`); a `success` last node renders a green `mdi:check-circle` badge (`.flow-success-badge`) and green icon (`.fni-success`); a `warning` last node renders a yellow `mdi:alert-circle` badge (`.flow-warning-badge`) and yellow icon (`.fni-warning`, using `var(--yellow-500)`). This same last-node coloring applies to the fallback hardcoded paths when `result.path` is absent. Load-balance `result.path` is `[sourceId, lbNodeId, vm1Id, vm2Id, ...]` (all backend VM IDs); DNS `result.path` is `['DNS Client', zoneId, resolvedIpOrValue]`. `buildInternetTraversalPath(targetNode, blockingNsgId, nodes)` still builds the physical traversal path stored in `result.path` for internet connection tests: `['Internet', vnetId, subnetId, subnetNsgId?, nicId, nicNsgId?, targetId?]` — stops at `blockingNsgId` (inclusive) for fails, appends target for passes. Per-test Run button gets a green hover via `.run-test-btn:hover { color: var(--success) }`.
- **Network Summary panel grouped views**: `RightPanel.vue` uses `summaryNodes` to exclude the system-managed **Public Internet** node from the user-facing Components totals and grouped component cards, then derives `groupedComponents` from that filtered list. `groupedConnections` still groups real and synthesized containment edges by `target`, returning `{ targetId, targetName, edges }[]`; it synthesises virtual containment edges from `node.parentNode` because `autoLayout()` removes explicit containment edges from `diagramStore.edges` and expresses them via `parentNode` instead. At accordion level, only `components` is expanded by default (`:value="['components']"`); `connectivity`, `security`, and `performance` start collapsed. **Components AccordionPanel** renders a `.component-group` card per type, each with a `.group-header-clickable` header (type icon + label + count `<Tag>` + chevron icon) that toggles `collapsedComponentTypes` ref (a `Set<string>`); clicking the header collapses/expands the `.component-list` via `v-show`. Component groups default to collapsed on first render. **Connectivity AccordionPanel** renders a `.conn-groups` div container; each `.conn-group` is keyed by target — its `.conn-group-header` (chevron + target icon + name + source count badge) toggles `collapsedConnTargets` ref; the `.conn-sources` section (list of source rows) is shown/hidden via `v-show`. Connectivity groups also default to collapsed on first render. Both panels use `v-show` (not `v-if`) to preserve DOM state. The target source-count badge (`.conn-source-count`) uses a solid primary background with contrast text for readability. The **Security** AccordionPanel shows NSG/Firewall/ASG counts; each count `<Tag>` uses dynamic `:severity` via `getCountSeverity(types, findings)`: `'secondary'` if no nodes of that type exist; `'danger'` if any `critical` finding has a matching `relatedTypes`; `'warn'` if any `warning` finding matches; `'success'` otherwise. The **Performance** AccordionPanel does the same for LB/VPN/AG/Compute/Storage counts. `AuditFinding` type includes `relatedTypes?: NetworkComponentType[]` so `getCountSeverity` can filter relevant findings. Both `securityFindings` and `performanceFindings` computed properties tag every `findings.push()` call with the appropriate `relatedTypes`. Both audits run inline in `RightPanel.vue` using private helper functions (prefixed `audit*`) — these helpers mirror the logic from `stores/tests.ts` security checks but are standalone computed properties that react to `diagramStore.nodes` and `diagramStore.edges` without requiring a test to be run.
- **`bedrockClient` and `_saveTimer` expose HMR cleanup hooks**. Both module-level singletons register `import.meta.hot.dispose()` handlers to null out references on hot-reload, preventing leaked AWS SDK HTTP connection pools and stale timer callbacks from holding store references across HMR cycles.
- **`markRaw` is required for nodeTypes and edgeTypes**. The `nodeTypes` and `edgeTypes` objects in `DiagramCanvas.vue` must wrap every component value with `markRaw()` (imported from `'vue'`). Without this, Vue makes the component objects reactive, causing `[Vue warn]: Vue received a Component that was made a reactive object` warnings on every render. The pattern is: `'vnet-node': markRaw(VNetNode) as any`.
- **ConfirmActionDialog** (`components/modals/ConfirmActionDialog.vue`) is the project's custom confirm dialog wired to `diagramStore.confirmDialogMessage` and `diagramStore.executeConfirmedAction()`. It is registered in `pages/index.vue` as `<ConfirmActionDialog />`. Do NOT rename it back to `ConfirmDialog` — Nuxt 3 auto-import would resolve that name to PrimeVue 4's own `ConfirmDialog` (which requires a separate `ConfirmationService`), silently replacing the custom component and breaking the Reset, Import, and AI Challenge confirm flows. **Optional checkbox**: `confirmAction(message, action, checkboxLabel?)` accepts an optional third argument. When provided, `ConfirmActionDialog` renders a PrimeVue `Checkbox` bound to `diagramStore.confirmDialogCheckboxChecked`; `executeConfirmedAction()` passes `confirmDialogCheckboxChecked` as the first argument to the action callback. The Reset toolbar button uses this to offer "Also reset all network tests". The callback signature is `(checkboxChecked?: boolean) => void`. The Network Tests panel has a "Delete All" button that calls `confirmAction` with no checkbox label and triggers `testsStore.clearAllTests()`; `clearAllTests()` is a store action defined in `stores/tests.ts` that sets `tests` to `[]`.
- **PrimeVue theme configuration** uses `importTheme` in `nuxt.config.ts` (not `options.theme.preset`). The Aura preset object contains JavaScript functions that are silently stripped by JSON serialization through `runtimeConfig`, so the preset must be imported at build time via `assets/primevue-theme.ts`. The `@primevue/themes` package must remain in `dependencies`.
- **CSS variable ownership**: `assets/css/main.css` is the source of app-owned layout and base-color tokens (`--primary`, `--surface`, `--text`, `--header-height`, `--bottom-toolbar-height`, etc.). The app also uses PrimeVue Aura semantic tokens (`--surface-card`, `--surface-border`, `--surface-ground`, `--surface-section`, `--text-color`, `--text-color-secondary`, `--primary-color`, `--primary-color-text`, `--yellow-500`, `--green-500`, `--p-primary-color`, `--p-primary-hover-color`). Missing-token audits must treat those PrimeVue semantic tokens as valid because they are runtime-injected by the theme layer and mirrored by fallback aliases in `assets/css/main.css`. When a new global token is needed or an orphaned token is normalized, define it in `assets/css/main.css` rather than inventing a per-component variable.
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

## Deployment Strategy & Contributor Rules

### Hosting Defaults

- **Primary deployment target is AWS Amplify Hosting.**
- **Secondary/optional target is CloudFront + S3 static hosting.**
- Keep documentation aligned with this priority unless the user explicitly requests a platform change.

### Build & Artifact Contract

- This application is SPA-only (`ssr: false`). Do not enable SSR as part of routine deployment work.
- For static hosting deployment, use:
    - `npm ci`
    - `npm run generate`
    - deploy artifact from `.output/public`
- Preserve npm as the package manager for deployment guidance and scripts.

### Environment Variable Rules

- All app runtime config uses `NUXT_PUBLIC_*` variables.
- These variables are embedded into the client bundle at build time.
- If deployment config changes (region, pool ID, bucket, endpoint), rebuild and redeploy.
- Never treat `NUXT_PUBLIC_*` as secret storage; they are public by design.

### SPA Routing Requirements

- Any hosting target must enforce SPA fallback:
    - Amplify rewrite: `/<*> -> /index.html` (200 rewrite)
    - CloudFront alternative: custom error responses for 403/404 to `/index.html` with 200 response

### Documentation Synchronization Rule

- When deployment behavior changes, update all three files in the same change:
    - `README.md` (quick-start deployment guidance)
    - `ARCHITECTURE.md` (detailed deployment architecture and operational rules)
    - `.github/copilot-instructions.md` (authoritative contributor constraints)

---

## Adding a New Azure Component Type

1. Add a value to `NetworkComponentType` enum in `types/network.ts`.
2. Add a corresponding interface extending `NetworkComponent` in `types/network.ts`, and include it in the `AnyNetworkComponent` union.
3. Create `components/diagram/nodes/<TypeName>Node.vue`.
4. Create `components/forms/<TypeName>Form.vue` for user-managed components only. System-managed nodes such as **Public Internet** are the exception and should stay form-less.
5. Register the node type in `components/diagram/DiagramCanvas.vue` (`nodeTypes` map).
6. Add the component to the `LeftPanel` or `BottomToolbar` palette only if it is user-creatable.
7. Add sizing helpers in `stores/diagram.ts` (`getNodeWidth`, `getNodeHeight`, `getNodeType`) and any lifecycle normalization needed in the store when the node is system-managed.
