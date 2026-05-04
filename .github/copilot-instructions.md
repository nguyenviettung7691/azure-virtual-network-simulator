# Copilot Instructions - Azure Virtual Network Simulator

## Purpose

This repository is a Nuxt 3 SPA for designing and simulating Azure virtual network topologies.

Use this file as the primary coding guide for architectural constraints and high-risk implementation rules.

## Documentation Structure

This project maintains three complementary documentation files, each serving a distinct purpose:

| File | Purpose | Audience | Detail Level |
|---|---|---|---|
| **README.md** | Overall project document highlighting easy-to-scan main points, setup instructions, and deployment overview | Project stakeholders, new developers, quick reference | High-level summaries |
| **ARCHITECTURE.md** | Exhaustive fully detailed developer guide with complete specifications, algorithms, UI/UX rules, and implementation contracts | Contributors, maintainers, deep technical reference | Comprehensive technical specs |
| **copilot-instructions.md** | Guidance for GitHub Copilot prompt, critical rules, high-risk implementation constraints, and architectural guardrails | Copilot (AI coding agent), code generators, automation | Actionable constraints & rules |

**Navigation:** Use the Feature Reference table in ARCHITECTURE.md § 0 to map README features to their detailed specifications. When implementing changes, consult README for scope context, ARCHITECTURE for implementation rules, and copilot-instructions for risk mitigation guidance.

## Core Stack

- Framework: Nuxt 3 SPA (`ssr: false`)
- UI: PrimeVue 4 (Aura)
- State: Pinia
- Diagram engine: Vue Flow + Dagre
- Language: TypeScript (strict)
- Runtime/package manager: Node.js 18+ and npm

## High-Level Project Map

- `components/diagram/`: canvas, nodes, and edge renderers
- `components/forms/`: component edit forms
- `components/layout/`: app shell panels and toolbars
- `composables/`: thin wrappers over stores
- `stores/`: authoritative app state and business logic
- `lib/`: integrations (AWS, Bedrock, exports/imports, layout)
- `types/`: shared domain types

## Critical Architecture Rules

### Source of truth and lifecycle

- Pinia stores are the single source of truth; composables should stay thin.
- AWS is configured once in `app.vue` via `configureAWS()` from `lib/aws.ts`.
- Runtime config values are `NUXT_PUBLIC_*` and are public in the client bundle.

### Node and component model

- `types/network.ts` `AnyNetworkComponent` is the canonical union for all component types.
- The Public Internet node is system-managed: visible in non-empty diagrams, not palette-creatable, and has no form component.
- For user-managed types, keep the standard pattern aligned:
    - enum value in `NetworkComponentType`
    - interface in `types/network.ts`
    - node component in `components/diagram/nodes/`
    - form component in `components/forms/`

### Vue Flow synchronization

- Keep the `diagramStore.$onAction` sync bridge in `components/diagram/DiagramCanvas.vue`.
- External store mutations must continue syncing to Vue Flow internals (`setNodes`, `setEdges`, `fitView`/viewport reset).
- Do not remove `markRaw(...)` wrapping for `nodeTypes` and `edgeTypes`.

### Layout and containment

- `addNode()` must not call `autoLayout()` implicitly.
- Keep the staged auto-layout pipeline order in `stores/diagram.ts` deterministic.
- Preserve containment via `parentNode` (containment edges are not persisted after layout).
- Keep layer-aware edge-side normalization after layout.

### Required node-type mapping

- In `stores/diagram.ts`, keep `FIREWALL`, `BASTION`, `PRIVATE_ENDPOINT`, and `SERVICE_ENDPOINT` mapped to `'compute-node'`.
- Do not remap those types to `nsg-node`, `vpn-gateway-node`, or `network-ic-node`.

## Tests and Animation Rules

### Internet test identity

- `INTERNET_SOURCE_ID = '__internet__'` is both:
    - the special internet test source id
    - the persisted id of the system-managed Public Internet node

### Auto-run behavior

- Test auto-run is triggered by explicit load/import events (`diagramLoadId` changes), not by generic node/edge count changes.
- App-native `.drawio` imports may defer that one auto-run cycle until the post-import reset-tests prompt is resolved; keep the trigger tied to the import/load event rather than broad structural watchers.
- Keep debounce and concurrency guards around automatic test execution.

### Animation mode

- Animation mode is an ephemeral overlay state, not persisted infrastructure state.
- Keep the current behavior where animation paths come from test results and are rendered through overlay edges/node states.

## UI/Rendering Constraints (High Impact)

- Keep edge rendering on smoothstep paths (`NetworkEdge.vue` and `AnimationEdge.vue`).
- Keep animation keyframes global in `assets/css/diagram.css` (not scoped).
- Keep manual edge creation/editing disabled at Vue Flow level.
- Keep single-click-to-edit behavior for user-managed nodes while unlocked; Public Internet stays non-editable.
- Preserve tablet-responsive toolbar behavior (`<= 1024px`) for `components/layout/AppHeader.vue` and `components/layout/BottomToolbar.vue`: top toolbar remains compact with horizontal access to component groups, bottom toolbar remains single-row with horizontal scrolling (no forced multi-row wrap).

### Network Summary Hover Performance

- **Debounced hover state:** Network Summary group header hovers are debounced at 16ms (one frame at 60fps) in `components/layout/RightPanel.vue` to reduce store update frequency and prevent excessive node re-renders.
- **Memoized node decoration:** Canvas node identification highlighting in `components/diagram/DiagramCanvas.vue` is memoized based on highlight node IDs to avoid re-decorating nodes when the highlight set hasn't changed.
- **Cache invalidation:** The memoization cache is cleared when entering/exiting animation mode or when node count changes.
- These optimizations ensure smooth hover interactions even on large diagrams with hundreds of nodes.

## Modal/Theme/Icon Constraints

- Keep custom confirm component name `ConfirmActionDialog`; do not rename it to `ConfirmDialog`.
- PrimeVue theme must stay configured via `importTheme` (not runtime-serialized preset config).
- PrimeVue Button `icon` prop accepts only `pi pi-*`; use button `#icon` slot for Iconify icons.

## Known Type-Check Status

- `npm run build` is the validation gate.
- Pre-existing `vue-tsc --noEmit` issues exist in:
    - `lib/drawio.ts`
    - `lib/s3.ts`
    - `stores/savedSetups.ts`
    - `types/diagram.ts`
- Do not introduce new type errors in files you modify.

## Deployment Rules (Contributor Contract)

### Canonical architecture

- CloudFront is the front door; Amplify Hosting remains the build/deploy origin.
- ACM + Route 53 provide custom-domain TLS/DNS.
- Cache invalidation path is required: EventBridge (Amplify deploy SUCCEED) -> Lambda -> CloudFront `CreateInvalidation` (`/*`).

### Build and runtime contract

- App remains SPA-only (`ssr: false`).
- Deployment build contract remains `npm ci` then `npm run generate`.
- Keep Amplify SPA rewrite fallback to `/index.html`.

### IaC scope

- Deployment edge/domain/eventing resources are Terraform-managed in `infra/`.
- Expected scope includes CloudFront, ACM, Route 53, EventBridge rule, Lambda invalidation, and IAM permissions.

### Prerequisite runbook expectations

- `infra/README.md` must document:
    - Terraform CLI installation/verification (`terraform version`)
    - AWS CLI v2 installation/verification (`aws --version`)
    - credentials verification (`aws sts get-caller-identity`)
    - short-term credential guidance (including `aws_session_token`)
    - IAM Identity Center prerequisites and `aws sso login` refresh flow
    - required permission scope for ACM/Route53/CloudFront/Lambda/EventBridge/IAM/CloudWatch Logs
    - optional preflight scripts (`infra/scripts/check-prereqs.ps1`, `infra/scripts/check-prereqs.sh`)

### Documentation sync requirement

- Any deployment-model change must update all three files in the same change:
    - `README.md`
    - `ARCHITECTURE.md`
    - `.github/copilot-instructions.md`

Keep these concepts aligned across all three:

- Amplify as origin with CloudFront front door
- EventBridge -> Lambda -> CloudFront invalidation
- Terraform ownership in `infra/`

## Build/Run Commands

```bash
npm install
npm run dev
npm run build
npm run generate
npm run preview
```

Notes:

- No `npm test` script is defined.
- No lint/format script is defined.

## Environment Setup

Copy `.env.example` to `.env` and provide valid `NUXT_PUBLIC_*` values.

## Quick Checklist for Copilot Changes

- Preserve system-managed Public Internet behavior.
- Keep store-driven Vue Flow sync and deterministic layout behavior.
- Do not reintroduce implicit auto-layout on node add.
- Preserve deployment architecture contract and docs synchronization rule.
