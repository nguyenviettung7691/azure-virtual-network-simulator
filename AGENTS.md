# Project Instructions - Azure Virtual Network Simulator

## Purpose

This repository is a Nuxt 3 SPA for designing and simulating Azure virtual network topologies.

Use this file as the primary coding guide for architectural constraints and high-risk implementation rules.

## Documentation Structure

This project maintains three complementary documentation files, each serving a distinct purpose:

| File | Purpose | Audience | Detail Level |
|---|---|---|---|
| **README.md** | Overall project document highlighting easy-to-scan main points, setup instructions, and deployment overview | Project stakeholders, new developers, quick reference | High-level summaries |
| **ARCHITECTURE.md** | Exhaustive fully detailed developer guide with complete specifications, algorithms, UI/UX rules, and implementation contracts | Contributors, maintainers, deep technical reference | Comprehensive technical specs |
| **AGENTS.md** | Guidance for Cursor prompt, critical rules, high-risk implementation constraints, and architectural guardrails | AI coding agent, code generators, automation | Actionable constraints & rules |

### Quick Context Map

Use this map first, then jump directly to the matching document:

| If you need... | Start here | Then verify in |
|---|---|---|
| Feature scope, user-facing behavior, setup/deploy overview | **README.md** | **ARCHITECTURE.md** |
| Exact implementation contracts, data models, algorithms, UI/UX behavior | **ARCHITECTURE.md** | **AGENTS.md** |
| High-risk guardrails and do/do-not-change constraints while coding | **AGENTS.md** | **ARCHITECTURE.md** |

### Task-Oriented Read Order

1. **Understand intent:** Read **README.md** for scope and expected behavior.
2. **Implement correctly:** Read **ARCHITECTURE.md** for detailed implementation contracts.
3. **Avoid regressions:** Apply guardrails from **AGENTS.md** before finalizing changes.

### Cross-Reference Rule

- Use the Feature Reference table in **ARCHITECTURE.md § 0** to map README-level features to detailed sections.
- If guidance appears to conflict: **ARCHITECTURE.md** defines the implementation contract, while **AGENTS.md** defines risk and safety guardrails to apply during implementation.

### Specific `/docs` References

Use these focused documents for domain-specific context:

- **docs/component/**: per-component architecture specifications (data models, property forms, validation rules, Azure alignment) linked from **ARCHITECTURE.md** § 2; consult the matching file when implementing or modifying a specific `NetworkComponentType`.
- **docs/developer-onboarding.md**: local setup workflow, developer prerequisites, and onboarding flow.
- **docs/aws-services-integration.md**: AWS integration behavior (Cognito/S3/Bedrock and related app integration boundaries).
- **docs/deployment.md**: deployment topology, operational flow, and deployment-related runbook details.

When a task touches a specific Azure component type, start with the matching file under **docs/component/** in addition to **ARCHITECTURE.md** § 2 and the component rules in this file. When a task touches AWS or deployment behavior, consult the matching `/docs` file in addition to **README.md**, **ARCHITECTURE.md**, and this file.

## Core Stack

- Framework: Nuxt 3 SPA (`ssr: false`)
- UI: PrimeVue 4 (Aura)
- Local state: Pinia
- Remote/server state: TanStack Vue Query
- Diagram engine: Vue Flow + Dagre
- Language: TypeScript (strict)
- Runtime/package manager: Node.js 18+ and npm

## High-Level Project Map

- `components/diagram/`: canvas, nodes, and edge renderers
- `components/forms/`: component edit forms
- `components/layout/`: app shell panels and toolbars
- `composables/`: thin wrappers plus Vue Query hooks/controllers for remote state
- `stores/`: authoritative local app state and business logic
- `lib/`: integrations (AWS, Bedrock, exports/imports, layout)
- `types/`: shared domain types

## Critical Architecture Rules

### Source of truth and lifecycle

- Pinia stores are the source of truth for local UI/infrastructure state; TanStack Vue Query owns remote/server state such as auth session bootstrap, MongoDB settings sync, and S3 saved setups.
- Query/mutation orchestration belongs in composables such as `useAuthQueries.ts`, `useSettingsQueries.ts`, and `useSavedSetupQueries.ts`; do not move external I/O back into stores unless the architecture explicitly changes.
- AWS is configured once in `app.vue` via `configureAWS()` from `lib/aws.ts`.
- `app.vue` is also the lifecycle root for mounting the current-user query and settings sync after the app warms local settings and is ready for remote access.
- Runtime config values are `NUXT_PUBLIC_*` and are public in the client bundle.

### Node and component model

- `types/network.ts` `AnyNetworkComponent` is the canonical union for all component types.
- `types/diagram.ts` `SavedSetup` is the canonical saved-setup shape and uses `diagram` plus optional `thumbnail`; `lib/s3.ts` must preserve compatibility when reading legacy records that still use `state`, `thumbnailUrl`, or raw diagram payloads.
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

### Application Security Group (ASG) Component Rules

**Data Model & Validation:**
- `AsgComponent` in `types/network.ts` includes minimal fields: `id`, `name`, `type`, `description`, `nicIds?: string[]`
- ASGs validate that all referenced NICs exist and are in the same VNet (error-level)
- Per-NIC ASG limit (max 20) is validated with warning severity
- ASG membership is bidirectional: NIC.asgIds[] and ASG.nicIds[] must stay synchronized

**Form Behavior (`AsgForm.vue`):**
- Name field (required text)
- Description field (optional textarea)
- Read-only VNet display (derived from first member NIC; shows "(No NICs assigned yet)" if empty)
- Read-only NIC count display with visual warning if empty
- No manual VNet selection (automatically determined by NIC membership)

**Azure Alignment:**
- ✓ All NICs in ASG must be in same VNet (enforced at validation time)
- ✓ Each NIC can belong to max 20 ASGs (warning if exceeded)
- ✓ NSG rules can reference ASGs as source/destination (validated in NSG rule validator)
- ✓ If ASG used as both source AND dest in same NSG rule, both must be same VNet (error)
- ✓ ASG is metadata container only (no IP addresses, no security rules directly)

**Future Enhancements (Out of Scope):**
- ASG per-subscription quotas (3,000 limit)
- Multi-region support
- Rules-based automatic membership
- Effective ASG rules computation

### Network Interface Card (NIC) Component Rules

### Azure Key Vault Component Rules

**Data Model & Validation:**
- `KeyVaultComponent` in `types/network.ts` includes: `id`, `name`, `type`, `sku`, `tenantId`, `enableSoftDelete`, `softDeleteRetentionDays`, `enablePurgeProtection`, `networkDefaultAction`, `allowTrustedMicrosoftServices`, `virtualNetworkRules`, `ipRules`, `accessPolicies`, `tags`, `createdAt`
- `KeyVaultAccessPolicy` includes: `tenantId`, `objectId`, `permissions` (keys, secrets, certificates arrays)
- Name: required, 3–24 chars, alphanumeric/hyphen, must start/end with alphanumeric, no consecutive `--`
- SKU: required, 'Standard' or 'Premium'
- Soft Delete: if enabled, retention days required (7–90)
- Purge Protection: optional, recommended enabled; requires soft delete
- Network Default Action: 'Allow' keeps the public endpoint open; 'Deny' enables the firewall and requires selected networks, IP rules, or trusted-service bypass
- Virtual Network Rules: if set, all referenced subnets must exist, be SUBNET nodes, and stay within max 200 rules
- IP Rules: if set, must be public IPv4 / IPv4 CIDR only, max 1000, RFC1918 ranges rejected
- Access Policies: each must have tenantId, objectId, at least one permission; max 16; objectId unique per vault
- Warn if no access policies defined, if selected subnets lack `Microsoft.KeyVault` service endpoints, or if vault `tenantId` is missing/malformed

**Form Behavior (`IdentityForm.vue`, Key Vault mode):**
- Name (required, 3–24 chars, Azure naming rules)
- Tenant ID
- SKU selector (Standard, Premium)
- Soft Delete toggle (recommended enabled)
- Soft Delete Retention Days (shown if soft delete enabled, 7–90)
- Purge Protection toggle (recommended enabled)
- Network Default Action (Allow/Deny)
- Allow Trusted Microsoft Services toggle
- Virtual Network Rules (checkboxes for subnets in diagram)
- IP Rules (comma-separated public IPv4 / CIDRs)
- Access Policies (array editor: add/remove principal, set fixed Azure permission lists for keys/secrets/certificates)
- Helper text must state that Azure RBAC is the current recommended/default model for new vaults created with API version `2026-02-01`+, while simulator behavior remains access-policy based
- All fields validated per Azure constraints

**Integration Points:**
- **App Gateway:** structured fields `keyVaultId`, `keyVaultCertificateName`, `keyVaultCertificateVersion`, `keyVaultManagedIdentityId`; legacy `keyVaultCertificateId` is compatibility-only
- **App Service / Functions:** structured fields `keyVaultId`, `keyVaultSecretName`, `keyVaultSecretVersion`; legacy `keyVaultSecretUri` is compatibility-only
- **Managed Identity:** Used as principal in access policies for secure access
- **Subnet/NetworkIC:** Service endpoints can include Microsoft.KeyVault for private access
- Validation ensures referenced Key Vaults exist and are of correct type

**Azure Alignment:**
- ✓ Name, SKU, soft delete, purge protection, network rules, access policies enforced per Azure
- ✓ Integration with App Gateway, App Service, Functions, Managed Identity
- ✓ Private endpoint and RBAC not yet modeled (future enhancement)

**Do NOT:**
- Allow names outside Azure rules (1–24 chars, alphanumeric/hyphen, start/end with alphanumeric)
- Allow SKU other than Standard or Premium
- Allow soft delete retention outside 7–90 days
- Allow missing access policies (vault will be unusable)
- Allow invalid subnet or IP references in network rules
- Model private endpoint or RBAC (future enhancement)

**Future Enhancements (Out of Scope):**
- Per-object (key/secret/cert) management
- Private endpoint support
- Azure RBAC (role-based access control)
- Managed HSM (separate resource type)

### Azure Managed Identity Component Rules

**Data Model & Validation:**
- `ManagedIdentityComponent` in `types/network.ts` supports `identityType: 'SystemAssigned' | 'UserAssigned'`.
- New standalone managed identity nodes default to `UserAssigned` with `isolationScope: 'None'`.
- `UserAssigned` nodes are assignable resources and may be referenced from `userAssignedIdentityIds[]` on VM, VMSS, AKS, App Service, and Functions.
- `SystemAssigned` nodes are optional documentation/attachment records only; the source resource itself uses `enableManagedIdentity`.
- System-assigned documentation nodes validate that `assignedToId` references an identity-capable resource with `enableManagedIdentity: true`.
- `userAssignedIdentityIds[]` validation must reject non-managed-identity nodes and `SystemAssigned` managed identity nodes.
- Both system-assigned and user-assigned identities can be enabled on the same supported resource; do not add mutual-exclusion validation.

**Out of Scope:**
- Do not model RBAC role assignments, role definitions, or permission evaluation in v1.
- Do not compute effective access to Key Vault, Storage, SQL, or other target resources from managed identity metadata.

**Data Model & Validation:**
- `NetworkICComponent` in `types/network.ts` includes `dnsServers?: string[]` field (optional custom DNS servers)
- NICs validate that static private IP fits within parent subnet CIDR via `ipFitsInCidr()` helper in `componentValidators.ts`
- NICs validate against reserved subnet addresses (network address, gateway .1, broadcast) with warning severity
- DNS servers array is validated for valid IPv4 format (warning if invalid)
- ASG references are validated to exist in diagram (warning if missing)

**Form Behavior (`NetworkICForm.vue`):**
- NIC form field: `dnsServersStr` computed property parses/serializes comma-separated DNS IPs
- Validation errors for private IP CIDR mismatch are raised as errors (blocking save)
- Validation warnings for reserved IPs, invalid DNS format, and missing references are shown but non-blocking
- DNS servers field shows helper text: "Leave empty to inherit from VNet DNS settings"

**Azure Alignment:**
- NICs must have exactly one parent subnet (`subnetId` required)
- Static private IPs must fit within subnet CIDR; Azure reserves network, gateway, and broadcast addresses
- Custom DNS servers on NIC override VNet-level DNS settings
- NIC can attach to at most one VM (enforced by diagram structure)
- Subnet membership determines VNet association (not redundant via VM)
- NIC-level NSG overrides subnet-level NSG (most specific rule wins)

**Future Enhancements (Out of Scope):**
- Multiple IP configurations per NIC (secondary IPs with independent public IPs)
- IPv6 support (requires dual-stack subnet modeling)
- MAC address tracking (read-only after VM attachment)
- Primary/secondary NIC designation (affects outbound traffic routing)
- Effective NSG/route computation (combining subnet + NIC + UDR + BGP rules)

### Azure Service Endpoint Component Rules

**Canonical Model & Sync:**
- `SubnetComponent.serviceEndpoints[]` is authoritative for effective endpoint configuration.
- `ServiceEndpointComponent` nodes are synchronized mirrors for topology UX and backward compatibility.
- Reconciliation must run on diagram load and on Service Endpoint/Subnet add-update-remove flows.
- Reconciliation must merge legacy states that define endpoint intent in either representation.
- Keep one unique tuple per `(subnetId, service)` after normalization.
- Materialize missing Service Endpoint nodes from subnet endpoint entries and remove orphan Service Endpoint nodes not present in subnet endpoint lists.

**Data Model & Validation:**
- `ServiceEndpointComponent` includes: `id`, `name`, `type`, `service`, `subnetId?`, `locations?`, `createdAt`
- `service` required; normalize known service names to canonical casing.
- Unknown/custom service values are allowed with warning severity (non-blocking).
- `subnetId` required and must reference an existing `SUBNET` node.
- Region warning applies to `Microsoft.Sql` only when `locations[]` is supplied and subnet region is known.
- Do not apply same-region warning logic to `Microsoft.Storage.Global`.

**Integration Requirements:**
- Editing Service Endpoint nodes must update subnet `serviceEndpoints[]` via reconciliation.
- Editing subnet `serviceEndpoints[]` must update Service Endpoint nodes via reconciliation.
- Key Vault network rule checks must continue to rely on subnet `serviceEndpoints[]` for `Microsoft.KeyVault` presence.
- Keep Service Endpoint mapped to `compute-node` and `vnet` layer classification.

**Do NOT:**
- Reintroduce duplicate `SERVICE_ENDPOINT` validation paths.
- Treat Service Endpoint nodes as authoritative over subnet endpoint lists.
- Auto-remove unknown endpoint strings; preserve them and warn.

### Azure Private Endpoint Component Rules

**Data Model & Validation:**
- `PrivateEndpointComponent` in `types/network.ts` includes: `connectionName`, `privateLinkServiceId`, `groupIds`, `subnetId`, `privateIpAddress?`, `dnsZoneGroupId?`, `createdAt`
- Validator (`validateNetworkIC()` in `componentValidators.ts`) enforces:
  - ❌ Error: `connectionName` required
  - ❌ Error: `privateLinkServiceId` required
  - ❌ Error: `privateLinkServiceId` must reference an existing node
  - ⚠️ Warning: referenced target type outside simulator-supported private-link targets (`STORAGE_ACCOUNT`, `BLOB_STORAGE`, `KEY_VAULT`, `APP_SERVICE`, `FUNCTIONS`, `AKS`)
  - ❌ Error: `groupIds[]` required and must be non-empty
  - ⚠️ Warning: group IDs that do not match known subresources for the selected target type
  - ❌ Error: `subnetId` required, must exist, and must reference a `SUBNET` node
  - ❌ Error: `privateIpAddress` invalid IPv4 format (if provided)
  - ❌ Error: `privateIpAddress` outside subnet CIDR (if provided)
  - ⚠️ Warning: `privateIpAddress` is subnet reserved address (network, gateway `.1`, or broadcast)
  - ⚠️ Warning: selected subnet has `privateEndpointNetworkPolicies === 'Enabled'` (review intended NSG/UDR behavior)
  - ⚠️ Warning: `dnsZoneGroupId` missing reference, non-`DNS_ZONE` reference, or non-private DNS zone reference

**Form Behavior (`NetworkICForm.vue`, Private Endpoint mode):**
- Required fields marked in UI: Connection Name, Subnet, Target Resource (Private Link Service), Sub-resource Group IDs
- Inline error/warning feedback shown for all validated PE fields: `connectionName`, `privateIpAddress`, `subnetId`, `privateLinkServiceId`, `groupIds`, `dnsZoneGroupId`
- Sub-resource helper text explicitly describes Azure-style subresource names (for example: `blob`, `file`, `vault`, `sites`)
- DNS zone helper text indicates selected private DNS zone should follow target-service private-link DNS conventions
- DNS zone picker remains filtered to `DNS_ZONE` nodes where `zoneType === 'Private'`

**Integration Requirements:**
- App Service and Functions `privateEndpointId` references are warning-validated to:
  - exist
  - reference `PRIVATE_ENDPOINT` type (not just any node)
- Graph synthesis in `stores/tests.ts` and `stores/challenges.ts` must continue linking PE nodes to `privateLinkServiceId` and `dnsZoneGroupId`
- Layer classification remains VNet-managed for `PRIVATE_ENDPOINT`

**Do NOT:**
- Treat missing `connectionName`, `privateLinkServiceId`, `groupIds`, or `subnetId` as warnings; these are blocking errors
- Accept `subnetId` references to non-`SUBNET` component types
- Permit `dnsZoneGroupId` to be treated as authoritative if it points to non-private DNS zones without warning
- Revert App Service/Functions `privateEndpointId` checks back to existence-only validation

### Azure Virtual Machine (VM) Component Rules

**Data Model & Validation:**
- `VmComponent` in `types/network.ts` includes: `size`, `os`, `imagePublisher`, `imageOffer`, `imageSku`, `adminUsername`, `nicIds?`, `subnetId?`, `availabilityZone?`, `diskType?`
- VM `diskType` is legacy simplified OS disk metadata only (`Standard_LRS`, `StandardSSD_LRS`, `Premium_LRS`); do not expand it to the full managed disk model.
- VM networking is **NIC-authoritative**: attached NICs determine subnet/VNet context.
- Validator (`validateCompute()` in `componentValidators.ts`) enforces:
  - ❌ Error: `size` required
  - ❌ Error: `adminUsername` required
  - ❌ Error: `os` must be `Windows` or `Linux`
  - ❌ Error: at least one NIC must be attached (`nicIds` non-empty)
  - ❌ Error: every NIC reference must exist and be a `NETWORK_IC`
  - ❌ Error: every attached NIC must reference a subnet
  - ❌ Error: attached NICs must resolve to the same VNet
  - ❌ Error: if `subnetId` is set, it must match first attached NIC subnet
  - ❌ Error: `availabilityZone` must be `1`, `2`, or `3` when set
  - ❌ Error: `diskType` must be one of `Standard_LRS`, `StandardSSD_LRS`, `Premium_LRS` when set
  - ⚠️ Warning: image publisher/offer/SKU recommended for deployment realism

**Form Behavior (`ComputeForm.vue`):**
- VM form includes required fields: size, OS, admin username, and NIC attachments.
- NIC attachments use MultiSelect and are the source of truth for VM network placement.
- Subnet is displayed as derived/read-only from selected NICs.
- Availability zone options are only `1`, `2`, `3` (optional via clear/unset).

**Integration Rules:**
- `stores/tests.ts`: VM subnet resolution for path + subnet NSG checks must derive from NICs first.
- `lib/dagre.ts`: VM containment parent should resolve via NIC subnet when `subnetId` is absent.
- `stores/challenges.ts`: subnet-based requirement evaluation should resolve VM subnet via NIC first.

**Do NOT:**
- Reintroduce `No zone` sentinel or any non-Azure zone values.
- Treat `subnetId` as authoritative when NICs are attached.
- Allow VM creation without NIC attachment.
- Break backward compatibility paths that still carry legacy `subnetId` metadata.

### Azure Bastion (Bastion) Component Rules

**Data Model & Validation:**
- `BastionComponent` in `types/network.ts` includes all four SKUs: `'Developer' | 'Basic' | 'Standard' | 'Premium'`
- Fields with SKU-specific applicability:
  - `subnetId`: Required for Basic+; N/A for Developer
  - `publicIpId`: Required for Basic/Standard/Premium (unless `isPrivateOnly: true` on Premium); N/A for Developer
  - `scaleUnits`: Fixed 2 for Basic; configurable 2-50 for Standard/Premium; N/A for Developer
  - `enableTunneling`, `enableIpConnect`, `enableShareableLink`, `customInboundPorts`: Standard+ features only
  - `isPrivateOnly`, `enableSessionRecording`: Premium-only features
  - `availabilityZones`: Optional for all dedicated SKUs (Developer N/A)
- Validator (`validateBastion()` in `componentValidators.ts`) enforces all Azure constraints per SKU tier

**Form Behavior (`BastionForm.vue`):**
- SKU selector shows all 4 tiers with conditional rendering for Developer (info box) vs. Basic+ (full form)
- Developer SKU: Hides subnet, public IP, scale units, and all advanced/premium features
- Basic SKU: Shows subnet + public IP (required), scale units (read-only 2), hides advanced features
- Standard SKU: Shows subnet + public IP (required), scale units (editable 2-50), toggles for tunneling/IP Connect/shareable links, custom ports field
- Premium SKU: All Standard fields + private-only toggle + session recording toggle
- Availability Zones field (comma-separated text) shown for all dedicated SKUs
- Custom ports and availability zones use computed properties to parse/serialize comma-separated values

**Subnet Constraints (Basic+):**
- Subnet `subnetId` required for Basic, Standard, Premium (not Developer)
- Subnet must exist in diagram (error if missing)
- Subnet name should be "AzureBastionSubnet" (warning if not named correctly)
- Subnet size must be /26 or larger; /27 or smaller is error (enforced on deployment to Azure)
- Subnet must be dedicated to Bastion (cannot share with other resources; diagram model doesn't enforce, warning only)

**Public IP Constraints (except private-only):**
- Required for Basic/Standard/Premium when `isPrivateOnly` is false or not set
- N/A for Developer SKU
- Must exist in diagram (error if missing for Basic+)
- Public IP SKU must be Standard (warning if Basic)
- Public IP allocation method must be Static (warning if Dynamic)
- For Premium private-only deployment: public IP must not be set (error if present)

**Scale Units Constraints:**
- Developer: N/A (not shown, warn if set)
- Basic: Fixed at 2 instances (read-only in form, warn if set to other value)
- Standard: Configurable 2-50 instances (form shows InputNumber min 2 max 50)
- Premium: Configurable 2-50 instances (same as Standard)
- Each instance supports: 20 RDP + 40 SSH concurrent sessions

**Feature Availability Matrix:**
- **Developer:** No advanced features, no scaling, shared infrastructure
- **Basic+:** Native client support, file transfer, concurrent sessions
- **Standard:** All Basic+ features + tunneling, IP Connect, shareable links, custom ports, availability zones
- **Premium:** All Standard features + session recording, private-only deployment
- Tunneling/IP Connect/shareable links/custom ports: Warn if set on Basic or Developer
- Session Recording: Premium-only; error if set on Basic/Standard
- Private-only deployment: Premium-only; error if set on Basic/Standard/Developer

**Custom Inbound Ports (Standard+):**
- Array of port numbers (1-65535)
- Defaults to [3389, 22] if empty
- Form uses `customPortsStr` computed property to parse comma-separated input
- Validation: Warn if ports outside 1-65535 range

**Availability Zones:**
- Optional for all dedicated SKUs (Developer N/A)
- Array of zone identifiers (typically "1", "2", "3")
- Form uses `availabilityZonesStr` computed property for comma-separated input
- Validation: Warn if zones contain values other than 1, 2, 3
- Feature in preview; support limited to select regions (not enforced in v1)

**Private-Only Deployment (Premium Only):**
- `isPrivateOnly: true` disables public IP requirement
- When enabled: public IP field hidden in form, public IP must not be set (error if present)
- Requires ExpressRoute or VPN for end-to-end private connectivity
- Cannot connect via public IP when private-only enabled

**Azure Alignment:**
- ✓ All four SKUs with correct feature parity and deployment models
- ✓ AzureBastionSubnet naming and /26+ sizing enforced
- ✓ Public IP Standard SKU and Static allocation required
- ✓ Fixed 2 instances for Basic; configurable 2-50 for Standard/Premium
- ✓ Concurrent session capacity per instance (20 RDP + 40 SSH)
- ✓ Standard+ advanced features (tunneling, IP Connect, shareable links, custom ports)
- ✓ Premium-only features (session recording, private-only deployment)
- ✓ Virtual Network peering support (all dedicated SKUs)
- ✓ Availability Zones support (preview, limited regions)

**Key Integration Points:**
- Bastion layer classification: Always `public-facing` in `getComponentLayer()` ([stores/diagram.ts](stores/diagram.ts#L52-L90))
- Node rendering: Mapped to `compute-node` type in `getNodeTypeForComponent()` ([lib/export/nodeTypeMap.ts](lib/export/nodeTypeMap.ts))
- Challenge references: Bastion can be a challenge task component ([stores/challenges.ts](stores/challenges.ts#L900-L930))
- Sample diagrams: Bastion included in full sample with Standard SKU configuration ([components/diagram/DiagramCanvas.vue](components/diagram/DiagramCanvas.vue))

**Do NOT:**
- Remove SKU tier support or reduce to 2 SKUs (must support Developer, Basic, Standard, Premium)
- Allow subnet field for Developer SKU
- Allow public IP field for Developer SKU without error/warning
- Allow advanced features (tunneling, IP Connect, shareable links, custom ports) on Basic or Developer
- Allow Premium features (session recording, private-only) on Basic/Standard
- Skip subnet naming/sizing validation for Basic+
- Skip public IP SKU/allocation validation for Basic+
- Allow both private-only and public IP in Premium SKU

### Azure DNS Zone Component Rules

**Data Model & Validation:**
- `DnsZoneComponent` in `types/network.ts` includes: `zoneName`, `zoneType` ('Public'|'Private'), `vnetLinks?`, `recordSets?`, `metadata?`
- `DnsRecord` expanded to 14 types: A, AAAA, CNAME, MX, PTR, SRV, TXT, CAA, NS, SOA, SPF, DS, TLSA
- Validator (`validateDnsZone()` in `componentValidators.ts`) enforces:
  - ❌ Error: Zone name required and valid DNS format
  - ❌ Error: Private zone names must have 2+ labels (e.g., contoso.com; not "local")
  - ❌ Error (warning): TTL must be 1 to 2,147,483,647 seconds
  - ⚠️ Warning: Private zone with no VNet links
  - ⚠️ Warning: Referenced VNet doesn't exist
  - ⚠️ Warning: VNet link count ≥ 900/1000 (approaching limit)
  - ⚠️ Warning: CNAME record with >1 record for same name (cannot coexist with other records)
  - ⚠️ Warning: SOA record with >1 record for same name (single record only)
  - ⚠️ Warning: Record set count approaching zone limits (10,000 for Public at 9,000+; 25,000 for Private at 22,500+)
- `isValid` is calculated from `error`-severity entries only (warnings do not block save)

**Form Behavior (`DnsZoneForm.vue`):**
- Name (required text; user-friendly zone name)
- Zone Name (required text; valid domain name with format validation)
- Zone Type (required SelectButton: Public or Private)
- VNet Links (shown only for Private zones; checkboxes for VNET nodes; displays count with warning indicator)
- Record Sets section (optional array):
  - Record name field (@ for apex, * for wildcard, or subdomain)
  - Record type selector (all 14 Azure types: A, AAAA, CAA, CNAME, DS, MX, NS, PTR, SOA, SPF, SRV, TLSA, TXT)
  - TTL field (InputNumber with min=1, max=2,147,483,647)
  - Values field (comma-separated; e.g., "10.0.1.10, 10.0.1.11" for A record)
  - Delete button per record
  - Helper text: "Supported types: A, AAAA, CNAME, MX, PTR, SRV, TXT, CAA, NS, SOA, SPF, DS, TLSA. Use '@' or empty for apex. Use '*' for wildcard."
- Description (optional textarea)
- Validation errors shown inline; warnings non-blocking

**Azure Alignment:**
- ✓ All 14 DNS record types (A, AAAA, CAA, CNAME, DS, MX, NS, PTR, SOA, SPF, SRV, TLSA, TXT)
- ✓ TTL range 1 to 2,147,483,647 seconds per Azure spec
- ✓ Private zone label requirement (2+ labels; no single-label zones)
- ✓ CNAME/SOA single-record constraint (cannot coexist with other records of same name)
- ✓ Wildcard record support
- ✓ VNet link max 1,000 per private zone
- ✓ Record set limits (10,000 public, 25,000 private)
- ✓ Zone type config-driven layer classification (Public=public-facing, Private=private)
- ✓ Integration with Private Endpoint DNS Zone Groups (filters to private zones)
- ✓ Integration with DNS tests (zone selection for name resolution tests)

**Key Integration Points:**
- DNS Zone layer classification in `getComponentLayer()` ([stores/diagram.ts](stores/diagram.ts)):
  - Returns `public-facing` if `zoneType === 'Public'`
  - Returns `private` if `zoneType === 'Private'`
  - Layer drives edge visibility and rendering behavior
- Node rendering: Mapped to `dns-zone-node` in `getNodeTypeForComponent()` ([lib/export/nodeTypeMap.ts](lib/export/nodeTypeMap.ts))
  - Node displays zone name + zone type (e.g., "contoso.com (Public)")
- Private Endpoint DNS Zone Group selector: Filters DNS zones to `zoneType === 'Private'` in [components/forms/NetworkICForm.vue](components/forms/NetworkICForm.vue#L70-L120)
- DNS test form: Zone selector in [components/panels/TestFormModal.vue](components/panels/TestFormModal.vue#L30-L90) allows dns-type tests to reference zones

**Do NOT:**
- Support fewer than 14 record types; all Azure types must be available in selector
- Allow TTL outside 1 to 2,147,483,647 range
- Skip private zone label validation (2+ labels required)
- Allow CNAME/SOA multiple records without warning
- Skip VNet link count warnings (approaching 1,000 limit)
- Skip record set count warnings (approaching zone limits)
- Merge public and private zones into single type validation

**Future Enhancements (Out of Scope):**
- Auto-registration for private zones (requires VM lifecycle integration)
- Zone delegations / child zones (NS record delegation)
- DNSSEC signing and validation
- Alias records to Azure resources
- DNS Private Resolver integration (forwarding rules)
- Query logging and monitoring
- Per-record metadata/tags UI
- Automatic zone failover across regions

### Azure NAT Gateway Component Rules

**Data Model & Validation:**
- `NatGatewayComponent` includes: `sku`, `publicIpIds`, `publicIpPrefixIds`, `subnetIds`, `idleTimeoutInMinutes`, `availabilityZones`
- `sku` must be `Standard`
- Name required; 1-80 chars; alphanumeric/hyphen; start/end alphanumeric
- `idleTimeoutInMinutes` must be 4-120
- `availabilityZones` values must be `1`, `2`, or `3`; single-zone is warning
- Total capacity references (`publicIpIds.length + publicIpPrefixIds.length`) must be <= 16
- `publicIpIds` must reference existing `IP_ADDRESS` nodes with `sku: Standard`
- Public IP cannot be attached to multiple NAT gateways
- `subnetIds` max 16; each must reference existing `SUBNET` nodes
- A subnet cannot attach to multiple NAT gateways
- `publicIpPrefixIds` are compatibility IDs only; unresolved IDs are warnings

**Form Behavior (`NatGatewayForm.vue`):**
- Name (required)
- SKU (read-only `Standard`)
- Idle timeout (4-120)
- Availability zones (comma-separated)
- Public IPs multi-select from Standard public IP nodes
- Public IP Prefix IDs as compatibility text field
- Subnets multi-select (max 16)
- Inline error/warning rendering from validator

**Integration Requirements:**
- `NAT_GATEWAY` must map to `nat-gateway-node` in diagram rendering
- Palette metadata must include NAT description and aliases (`nat`, `nat gateway`, `egress`)
- Keep NAT/Subnet synchronization bidirectional:
  - `NatGatewayComponent.subnetIds[]`
  - `SubnetComponent.natGatewayId`
- Reconciliation must run during normalize/add/update/remove/load flows

**Out of Scope:**
- Dedicated Public IP Prefix component type
- SNAT-port simulation math and effective connection-capacity modeling

### Network Virtual Appliance (NVA) Component Rules

**Data Model & Validation:**
- `NvaComponent` in `types/network.ts` includes: `nvaRole`, `vmSize`, `publisher`, `offer`, `sku`, `version`, `haMode`, `availabilityZones`, `publicIpId`, `subnetId`, `enableIpForwarding`
- Validator (`validateNva()` in `componentValidators.ts`) enforces:
  - ❌ Error: `subnetId` required and must exist
  - ❌ Error: `publicIpId` must exist in diagram (if set)
  - ⚠️ Warning: `enableIpForwarding` should be `true` (IP forwarding is required for NVA routing; Azure drops packets otherwise)
  - ⚠️ Warning: `vmSize` should be specified
  - ⚠️ Warning: At least one of publisher/offer/SKU should be provided (warning only when all three are empty)
  - ⚠️ Warning: `availabilityZones` values must be `'1'`, `'2'`, or `'3'`
- `isValid` is calculated from `error`-severity entries only (warnings do not block save)

**Form Behavior (`NvaForm.vue`):**
- Name (required text), Description (optional textarea)
- NVA Role dropdown (Firewall/NGFW, SD-WAN, VPN Endpoint, Proxy/Web Filter, Other) — optional with clear
- VM Size (free text; warning border + text if empty)
- Publisher, Offer, Image SKU, Version (free text; warning on Publisher field when all three marketplace fields are empty)
- HA Mode dropdown (Single Instance, Active-Active, Active-Standby) — optional with clear
- Availability Zones (comma-separated text via `availabilityZonesStr` computed property: `string[]` ↔ string)
- Public IP select (optional; from `IP_ADDRESS` nodes; error if referenced node doesn't exist)
- Enable IP Forwarding toggle with dynamic caption: shows warning message when disabled, normal helper when enabled
- Subnet select (required; error if missing or non-existent)
- `getError(fieldName)` returns only `severity === 'error'` matches; `getWarning(fieldName)` returns only `severity === 'warning'` matches

**Azure Alignment:**
- ✓ IP forwarding requirement warned when disabled (critical: NVA drops routed traffic without it)
- ✓ Azure Marketplace image fields for actual deployment
- ✓ HA topology modes and Availability Zones as informational metadata
- ✓ Optional public IP for internet-facing NVA (external firewall, edge appliance)
- ✓ NVA layer classification: always `vnet` in `getComponentLayer()`
- ✓ UDR `nextHopType=VirtualAppliance` integration: NVA nodes appear in UDR next-hop dropdowns

**Key Integration Points:**
- NVA layer classification: Always `vnet` in `getComponentLayer()` ([stores/diagram.ts](stores/diagram.ts))
- Node rendering: Mapped to `nva-node` (NOT `compute-node`) in `getNodeType()` ([stores/diagram.ts](stores/diagram.ts)) and `getNodeTypeForComponent()` ([lib/export/nodeTypeMap.ts](lib/export/nodeTypeMap.ts))
- UDR integration: NVA nodes appear in `nextHopResourceId` dropdowns for `nextHopType=VirtualAppliance` in UDR form

**Do NOT:**
- Remove `enableIpForwarding` from `NvaComponent` (models Azure NIC IP forwarding at VM level for simulator simplicity)
- Add `nicIds[]` to `NvaComponent` for internal multi-NIC modeling (out of scope)
- Remap NVA to `compute-node` — NVA must use `nva-node`
- Remove NVA from the UDR `nextHopResourceId` dropdown
- Suppress the IP forwarding warning (it is a critical Azure deployment requirement)

**Future Enhancements (Out of Scope):**
- Virtual WAN Hub NVA (managed application, scale units, hub address space)
- BGP / Azure Route Server integration for NVA
- Gateway Load Balancer transparent NVA chaining
- Multi-NIC NVA topology with explicit NIC nodes
- HA failover automation (UDR + IP reassignment scripting)

### Azure Public IP Address (IpAddressComponent) Component Rules

**Data Model & Validation:**
- `IpAddressComponent` in `types/network.ts` includes: `ipAddress`, `allocationMethod` (Static | Dynamic), `sku` (Standard | Standard_v2), `tier` (Regional | Global), `ipVersion` (IPv4 | IPv6), `dnsLabel`, `availabilityZones`, `routingPreference`
- **CRITICAL**: Basic SKU **retired Sep 30, 2025** → Only Standard (v1) and Standard_v2 supported
- Validator (`validateIpAddress()` in `componentValidators.ts`) enforces:
  - ❌ Error: SKU must be 'Standard' or 'Standard_v2' (reject Basic; use Standard for all new deployments)
  - ❌ Error: Allocation method must be Static or Dynamic
  - ❌ Error: Tier must be Regional or Global if set
  - ❌ Error: Availability zones must contain only '1', '2', or '3'
  - ❌ Error: Routing Preference must not be set on Standard_v2 (Standard only feature)
  - ⚠️ Warning: Dynamic allocation may change IP upon resource stop/start
  - ⚠️ Warning: Fewer than 2 availability zones (not zone-redundant; lower reliability)
  - ⚠️ Warning: Standard_v2 without explicit zones (always zone-redundant by default; informational)
  - ⚠️ Warning: Standard v1 with zones (zones optional metadata; may not guarantee zone-redundancy)
  - ⚠️ Warning: Global tier with Standard_v2 (future support coming; confirm topology)
  - ⚠️ Warning: Cannot specify exact public IP (Azure assigns from pool; field is documentation only)
  - ⚠️ Warning: IP referenced by public LB/AppGateway/Bastion but SKU mismatches (must be Standard with Static allocation)
- `isValid` is calculated from `error`-severity entries only (warnings do not block save)

**Form Behavior** (`IpAddressForm.vue`):
- Name (required text)
- **SKU selector** (Standard, Standard_v2 only; no Basic option)
  - Helper text: "Basic SKU was retired September 30, 2025. Use Standard for all new deployments."
  - Error if SKU not specified
- **Tier selector** (Regional, Global) with clear option
  - Default: Regional (single-region deployments)
  - Global: Cross-region load balancer backends
  - Warning if Global with Standard_v2 (future support status)
- **Availability Zones** (comma-separated text input via `availabilityZonesStr` computed property: `string[]` ↔ string)
  - Visual warning indicator if < 2 zones
  - Helper text: "Comma-separated zone IDs for zone redundancy (Standard_v2 always zone-redundant)"
- **Routing Preference** (shown only for Standard v1; disabled for Standard_v2)
  - Options: Default (undefined), Internet (cost optimization), Microsoft (performance)
  - Helper text: "Optimize routing path for cost/latency (Standard only)"
- **Allocation Method** (Static, Dynamic) with warning if Dynamic selected
  - Helper text: "Static: persists across stop/start; Dynamic: may change on deallocate"
- **IP Version** (IPv4, IPv6) with default IPv4
- **IP Address** (optional documentation field)
  - Placeholder: "20.x.x.x (Azure assigns from pool)"
  - Helper text: "Azure assigns the public IP from available pool; this field is for documentation"
  - Validation errors shown inline if format invalid
- **DNS Label** (optional)
  - Helper text: "Maps to {label}.{region}.cloudapp.azure.com"
  - Validation errors shown inline if format invalid

**Azure Alignment:**
- ✓ SKU support (Standard v1, Standard_v2 only; Basic retired Sep 30, 2025)
- ✓ Allocation methods (Static: persists; Dynamic: may change)
- ✓ Zone redundancy (Standard_v2 always zone-redundant; Standard optional)
- ✓ Tier configuration (Regional standard; Global for cross-region LBs)
- ✓ Routing Preference (Internet/Microsoft for Standard only; not Standard_v2)
- ✓ IPv4/IPv6 support (separate resources per version)
- ✓ DNS label mapping to Azure-managed FQDN with region
- ✓ Cannot specify exact IP (Azure assigns from available pool)
- ✓ Public IP integration with LB, AppGateway, Bastion, Firewall, VPN Gateway, NVA

**Key Integration Points:**
- LoadBalancer: Public LBs reference `publicIpId` (or `frontendIpConfigs[].publicIpId`); must be Standard SKU with Static allocation
- AppGateway: Public frontends require `publicIpId` pointing to Standard SKU with Static allocation (validated in AppGateway form)
- Bastion: Public IP field (optional for private-only Premium; required for Basic/Standard/Premium otherwise); must be Standard_v2 for modern deployments
- Firewall: `publicIpIds[]` array; 1-250 public IPs supported depending on mode
- VPN Gateway: Public IP support for site-to-site and point-to-site scenarios
- NVA: Optional `publicIpId` for internet-facing appliances
- Node rendering: Mapped to `ip-address-node` type; displays "Public IP - {SKU} ({AllocationMethod})" and appends " - Global" if tier is Global

**Do NOT:**
- Support Basic SKU (retired Sep 30, 2025) — only Standard and Standard_v2
- Allow allocation method changes without validation
- Skip tier/zone validation (impacts architectural reliability)
- Allow routing preference on Standard_v2 (not supported)
- Skip integration checks for LB/AppGateway/Bastion (they have specific SKU + allocation requirements)
- Model private IPs as IP_ADDRESS component (private IPs are NIC properties)

**Future Enhancements (Out of Scope):**
- Domain Name Label Scope (preview; prevents DNS dangling name reuse)
- IPv4 Address Prefix support (for large-scale VM deployments)
- Dual-stack explicit unified IP modeling (IPv4 + IPv6 as single entity)

### Azure App Service & Azure Functions Component Rules

**Data Model & Validation:**

**App Service (`AppServiceComponent` in `types/network.ts`):**
- Tier options: Free, Shared, Basic, Standard, Premium, PremiumV2, PremiumV3, PremiumV4, Isolated, IsolatedV2 (all 9 modern tiers required)
- SKU field validation: tier-specific mapping (F1→Free, D1→Shared, B1/B2/B3→Basic, S1/S2/S3→Standard, P1/P1v2/P2v2/P3v2→Premium, P1v3/P2v3/P3v3→PremiumV3, P1v4/P2v4/P3v4→PremiumV4, I1/I2/I3→Isolated, I1v2/I2v2/I3v2→IsolatedV2)
- OS: Windows or Linux (affects available runtime stacks: Windows has .NET, Node, PHP, Java; Linux has .NET, Node, Python, Java, Ruby, Go, PHP)
- Runtime stack required fields: runtime stack string (e.g., "DOTNET|8.0", "NODE|20-lts", "PYTHON|3.11")
- Security fields: `minTlsVersion` (1.0, 1.1, 1.2, 1.3), `enableManagedIdentity` (system-assigned), `userAssignedIdentityIds[]` (can be used together with system-assigned; both supported)
- Networking: `vnetIntegrationSubnetId` (optional), `enablePrivateEndpoint` (optional), `privateEndpointId` (optional if enabled), `ipRestrictions[]` (optional IP allow-list)
- Authentication: `enableEasyAuth` (optional), `easyAuthProvider` (optional if enabled: AzureAD, Microsoft, Google, Facebook, X)
- Monitoring: `enableDiagnosticLogging`, `applicationInsightsResourceId`, `enableHealthCheck`, `healthCheckPath`
- Key Vault: structured `keyVaultId`, `keyVaultSecretName`, optional `keyVaultSecretVersion`; legacy `keyVaultSecretUri` remains compatibility-only
- Custom domain: `customDomain` (optional; not supported on Free/Shared tiers)
- HTTPS enforcement: `enableHttps` (optional; enables redirect HTTP→HTTPS)

**Functions (`FunctionsComponent` in `types/network.ts`):**
- Hosting model: `hostingOption` = FlexConsumption | Premium | Dedicated | ContainerApps | Consumption
- Plan SKU model: `planSku` by hosting option (`FC1`, `EP1-EP3`, dedicated App Service SKUs, `Y1` legacy)
- Legacy compatibility: existing `hostingPlanSku` and `tier` values are accepted and normalized
- OS metadata: `Windows | Linux` with Linux-only constraints for FlexConsumption and ContainerApps
- Runtime stack required: dotnet, node, python, java, powershell (enum-based, not free text)
- Runtime version required: version string (e.g., "8.0", "20", "3.11")
- Storage Account required: must reference existing STORAGE_ACCOUNT node; StorageV2 is the default path for new storage accounts and legacy BlobStorage remains compatibility-only
- Same security/networking/monitoring fields as App Service
- Key Vault integration for function secrets

**Form Behavior (`ComputeForm.vue`):**
- Tier selector: dropdown with all 9 tiers; shows tier categories (shared vs. dedicated vs. isolated)
- SKU selector: tier-specific dropdown; updates when tier changes; required field
- OS selector: Windows or Linux button group (required)
- Runtime Stack selector: OS-specific dropdown options (not free text); shows common stacks per OS
- VNet Integration Subnet: optional select from subnet nodes; nullable
- Private Endpoint: optional toggle; conditional endpoint ID field shown if enabled
- Custom Domain: optional text input; form shows tier warnings if Free/Shared
- Minimum TLS Version: optional dropdown (1.0, 1.1, 1.2, 1.3); default 1.2 recommended
- Managed Identity: system-assigned toggle + user-assigned MultiSelect (both can be enabled at the same time; matches Azure)
- Easy Auth: optional toggle + conditional provider selector
- Diagnostic Logging: optional toggle
- Application Insights: optional resource ID input
- Health Check: optional toggle + conditional path field
- Key Vault selector + secret name + optional secret version + read-only secret URI preview
- Functions-specific: Hosting Option dropdown, option-aware Plan SKU dropdown, OS selector, runtime stack enum dropdown, runtime version text, storage account required select

**Validation Rules (`validateAppService()`, `validateFunctions()`):**

App Service:
- ❌ Error: `tier` not in supported list
- ❌ Error: `sku` invalid or not matching selected tier
- ❌ Error: `os` not Windows or Linux
- ❌ Error: `minTlsVersion` not 1.0/1.1/1.2/1.3
- ❌ Error: `userAssignedIdentityIds[]` references a non-managed-identity node or a `SystemAssigned` managed identity node
- ⚠️ Warning: Runtime stack empty (deployment realism)
- ⚠️ Warning: TLS < 1.2 (deprecated, use 1.2+)
- ⚠️ Warning: Custom domain on Free/Shared tier (not supported)
- ⚠️ Warning: VNet integration on Free/Shared (not supported)
- ⚠️ Warning: Managed identity on Free/Shared (not meaningful on shared compute)
- ⚠️ Warning: VNet integration enabled but no subnet reference
- ⚠️ Warning: Private endpoint enabled but no endpoint ID
- ⚠️ Warning: Referenced Key Vault/App Insights resource doesn't exist
- ⚠️ Warning: Key Vault reference configured without managed identity
- ⚠️ Warning: Selected Key Vault is network-restricted but the app lacks matching VNet integration metadata
- ⚠️ Warning: Easy Auth enabled but no provider specified

Functions:
- ❌ Error: `hostingOption` not in supported list
- ❌ Error: `planSku` invalid for selected hosting option when required
- ❌ Error: `runtimeStack` not one of: dotnet, node, python, java, powershell
- ❌ Error: `runtimeVersion` empty
- ❌ Error: `storageAccountId` empty or referenced account doesn't exist
- ❌ Error: `userAssignedIdentityIds[]` references a non-managed-identity node or a `SystemAssigned` managed identity node
- ⚠️ Warning: Legacy Consumption hosting (use Flex Consumption for new serverless workloads)
- ⚠️ Warning: Linux Consumption retirement guidance
- ⚠️ Warning: Blob-only storage used for host storage
- ⚠️ Warning: Referenced Key Vault/App Insights resource doesn't exist
- ⚠️ Warning: Key Vault reference configured without managed identity
- ⚠️ Warning: Selected Key Vault is network-restricted but the app lacks matching VNet integration metadata

**Layer Classification (`getComponentLayer()` in `stores/diagram.ts`):**
- **Public-facing:** App Service/Functions with NO VNet integration AND NO private endpoint enabled (public app.azurewebsites.net domain)
- **Private:** App Service/Functions with VNet integration enabled (outbound to VNet resources, but still publicly accessible)
- **Private:** App Service/Functions with private endpoint enabled (inbound only from private networks)

**Key Integration Points:**
- Managed Identity: Can reference `UserAssigned` MANAGED_IDENTITY nodes; validator checks existence and rejects system-assigned documentation nodes in `userAssignedIdentityIds[]`
- Key Vault: structured Key Vault references connect App Service/Functions to KEY_VAULT nodes and derive the secret URI preview from the selected vault
- Application Insights: `applicationInsightsResourceId` validator warns if referenced resource missing
- VNet Integration: `vnetIntegrationSubnetId` must reference SUBNET node; validator checks
- Private Endpoints: `privateEndpointId` optional reference to PRIVATE_ENDPOINT node
- Storage (Functions): `storageAccountId` must reference STORAGE_ACCOUNT or BLOB_STORAGE node
- Sample diagram: Includes App Service with Standard tier, VNet integration, managed identity, Application Insights reference; Functions with Premium Plan tier, storage account, private endpoint

**Do NOT:**
- Support fewer than 9 tiers (Free, Shared, Basic, Standard, Premium, PremiumV2, PremiumV3, PremiumV4, IsolatedV2 all required)
- Allow SKU as free text (must be dropdown with tier-specific options)
- Merge runtime stack selection (OS-specific options are non-negotiable)
- Merge App Service plan modeling (per-app plan metadata is correct; separate plan entities out of scope v1)
- Remove managed identity fields (critical for passwordless auth); do NOT restrict to mutual exclusivity—both types can be enabled together
- Skip tier-specific constraints (Free/Shared no custom domain, no VNet integration, no managed identity)
- Remove TLS version minimum enforcement (security requirement)
- Allow private endpoint without public IP conflict validation
- Merge Functions storage account requirement (must exist in diagram)
- Support non-standard runtime stacks for Functions (must be enum: dotnet, node, python, java, powershell)
- Reintroduce tier-first Functions modeling as canonical behavior (hostingOption is canonical)

**Future Enhancements (Out of Scope):**
- App Service Environment (ASE) as separate component (use Isolated tier modeling for now)
- Deployment slots (staging environments; metadata feature only)
- Autoscaling rules with metric thresholds (model as metadata only)
- Traffic routing policies and geo-distribution
- Custom certificate upload (Key Vault integration replaces this)
- Hybrid Connections for on-premises resources
- App Service Domain integration
- Multi-region active-active replication
- Functions Premium plan networking improvements
- Durable Functions orchestration modeling

### Azure Load Balancer (LoadBalancer) Component Rules
- Durable Functions orchestration modeling

### Azure Storage Account & Blob Storage Component Rules

**Data Model & Validation:**
- `StorageAccountComponent` in `types/network.ts` includes: `accountKind` (StorageV2 | BlobStorage | BlockBlobStorage | FileStorage | Storage), `replication` (LRS | GRS | RAGRS | ZRS | GZRS | RAGZRS, type-dependent), `accessTier` (Hot | Cool | Archive, optional for StorageV2/BlobStorage only)
- Security fields: `enableHttpsOnly`, `minTlsVersion` (TLS1_0 | TLS1_1 | TLS1_2), `allowBlobPublicAccess`, `allowSharedKeyAccess` (default true; recommend false), `allowPublicEndpoint` (default true; recommend false)
- Networking: `networkDefaultAction` (Allow | Deny), `virtualNetworkRules` (subnet IDs, max 400), `ipRules` (CIDR/IPs, max 400)
- Data Protection: `enableSoftDelete` (optional, default false; recommend true), `softDeleteRetentionDays` (1-365, required when soft delete enabled)
- Validator (`validateStorage()` in `componentValidators.ts`) enforces:
  - ❌ Error: `accountKind` must be one of 5 supported types
  - ❌ Error: `replication` must match account kind constraints (e.g., BlockBlobStorage = LRS/ZRS only)
  - ❌ Error: If `enableSoftDelete: true`, then `softDeleteRetentionDays` must be 1-365
  - ⚠️ Warning: `accountKind` = Storage or BlobStorage (legacy; use StorageV2)
  - ⚠️ Warning: `enableHttpsOnly` false or not set (HTTPS required per security baseline)
  - ⚠️ Warning: `minTlsVersion` < TLS1_2 (deprecated; recommend 1.2+)
  - ⚠️ Warning: `allowSharedKeyAccess: true` (Azure recommends disabling; use RBAC instead)
  - ⚠️ Warning: `allowPublicEndpoint: true` AND `networkDefaultAction: 'Allow'` (publicly accessible)
  - ⚠️ Warning: `softDeleteRetentionDays` < 7 (Azure recommends 7+ days)
  - ⚠️ Warning: `enableSoftDelete: true` but `enableHttpsOnly` false or `minTlsVersion` < TLS1_2 (weak security for recovery)
- `isValid` calculated from error-severity entries only (warnings non-blocking)

**Form Behavior (`StorageForm.vue`):**
- Storage Type Selector (required): Storage Account (defaults StorageV2), Blob Storage (defaults BlobStorage), Managed Disk
- Account Kind Dropdown (required): All 5 kinds; warning if Storage or BlobStorage (legacy)
- Replication Dropdown (required): Dynamic tier-specific options per account kind
- Access Tier (shown only for StorageV2/BlobStorage): Hot/Cool/Archive SelectButton
- Min TLS Version (optional): TLS1_2, TLS1_1, TLS1_0; warning if < 1.2
- HTTPS Only Toggle (default enabled): Warning if disabled with soft delete enabled
- Network Section: networkDefaultAction, virtualNetworkRules (max 400), ipRules (max 400)
- **NEW Security Settings Section:** Shared Key Access Allowed (ToggleSwitch with warning), Public Endpoint Enabled (ToggleSwitch)
- **NEW Data Protection Section:** Soft Delete for Blobs (ToggleSwitch), Soft Delete Retention (InputNumber 1-365)

**Azure Alignment:**
- ✓ Account kinds with replication constraints; redundancy options (LRS 99.9%, ZRS 99.99%, GZRS 99.99%)
- ✓ Access tier selection for cost optimization; HTTPS-only and TLS 1.2+ security
- ✓ Soft delete for Reliability (1-365 day retention); network firewall rules
- ✓ Functions integration: `storageAccountId` validator warns if BlobStorage used (recommend StorageV2)

**Key Integration Points:**
- Functions `storageAccountId` must reference STORAGE_ACCOUNT; validator warns if Blob-only
- Virtual network rules integrate with subnet selection; ipRules validate CIDR/IP
- Storage reachability tests reference STORAGE_ACCOUNT nodes; layer: always `private`

**Do NOT:**
- Support account kinds outside documented 5; allow unsupported replication types per account kind
- Remove soft delete or relax retention validation; skip HTTPS/TLS validation when soft delete enabled
- Allow shared key access without warning; support versioning/point-in-time restore in v1
- Remove allowSharedKeyAccess/allowPublicEndpoint fields without migration path

**Future Enhancements (Out of Scope):**
- RBAC/Microsoft Entra ID, Versioning & Point-in-Time Restore, Lifecycle Rules, Blob Inventory, Customer-Managed Keys, Azure Backup, Private Endpoints, Immutability Policies (all defer to v2+)

### Azure Managed Disk Component Rules

**Data Model & Validation:**
- `ManagedDiskComponent` in `types/network.ts` includes all 5 disk types: `diskType` (Ultra | Premium_SSD_v2 | Premium_SSD | Standard_SSD | Standard_HDD), `redundancy` (LRS | ZRS with type-specific constraints), `diskRole` (OS | DATA), `diskSizeGb` (per-type range), optional `osType`, optional `attachedToVmId`, optional `iops`/`throughput` (for Ultra/Premium v2 only)
- **Size Constraints:** Ultra (4–65,536 GiB), Premium SSD v2 (1–65,536 GiB), others (4–32,767 GiB)
- **Redundancy Constraints:** Ultra = LRS only; Premium SSD v2 = LRS only; Premium SSD = LRS or ZRS; Standard SSD = LRS or ZRS; Standard HDD = LRS only
- **OS Disk Compatibility:** Premium SSD, Standard SSD, Standard HDD only (Ultra and Premium v2 are data disks only)
- **Deprecation:** Standard HDD as OS disk retiring September 8, 2028 (warning level)
- **Performance Configuration:** IOPS/throughput metadata only for Ultra (100-400,000 IOPS, 0.25 MB/s per IOPS) and Premium SSD v2 (3000-80,000 IOPS, 125-2,000 MB/s with 750 MB/s max at 3000 IOPS); ignored for other types with warning
- Validator (`validateStorage()` in `componentValidators.ts`) enforces:
  - ❌ Error: `diskType` must be one of 5 supported types
  - ❌ Error: `redundancy` must match disk type (e.g., Ultra + ZRS error)
  - ❌ Error: `diskRole` must be OS or DATA
  - ❌ Error: `diskSizeGb` must be a whole GiB value in range for selected type
  - ❌ Error: OS role with Ultra or Premium SSD v2 (cannot be OS disks)
  - ❌ Error: `attachedToVmId` must exist and reference a VM if set
  - ❌ Error: a VM can have only one modeled OS managed disk
  - ❌ Error: OS disk `osType`, when set, must match attached VM `os`
  - ⚠️ Warning: Standard HDD as OS disk (retiring Sept 8, 2028)
  - ⚠️ Warning: Data disk without VM attachment (tracking recommendation)
  - ⚠️ Warning: IOPS/throughput configured on non-configurable types (Premium SSD, Standard SSD, HDD)
  - ⚠️ Warning: IOPS/throughput values outside Azure limits per disk type
- `isValid` calculated from error-severity entries only (warnings non-blocking)

**Form Behavior (`StorageForm.vue` Managed Disk Section):**
- **Disk Type selector** (required): Dropdown with 5 options; updates redundancy/size limits dynamically; helper text warns about deprecation and regional availability
- **Disk Role selector** (required): SelectButton (OS | Data); determines OS type field visibility and OS disk constraints
- **Redundancy selector** (required): Dynamic dropdown per disk type (LRS only for Ultra/v2; LRS+ZRS for Premium/Standard SSD); helper text explains durability tiers
- **Disk Size (GB)** (required): InputNumber with dynamic min/max per selected type; helper text shows valid range
- **IOPS field** (optional, shown only for Ultra/Premium v2): InputNumber with dynamic range guidance
- **Throughput (MB/s) field** (optional, shown only for Ultra/Premium v2): InputNumber with dynamic max MB/s guidance
- **OS Type selector** (optional, shown only for OS disks): SelectButton (Windows/Linux); must match attached VM OS when set
- **Attached to VM selector** (optional): Dropdown from VM nodes; warning if data disk unattached
- Validation errors filtered by severity: only show error-severity messages in red; warnings in orange

**Azure Alignment:**
- ✓ All 5 disk types with correct IOPS/throughput limits and size ranges per Azure specs
- ✓ Redundancy constraints (LRS all, ZRS for Premium/Standard SSD only)
- ✓ Zone-redundant storage (12 9's durability vs 11 9's for LRS)
- ✓ Disk role distinction (OS vs Data with OS-only compatibility constraints)
- ✓ Standard HDD deprecation warning (Sept 8, 2028 retirement for OS disks)
- ✓ Performance configuration for Ultra (1000 IOPS/GiB baseline) and Premium SSD v2 (500 IOPS/GiB above 6 GiB baseline)
- ✓ Node display format: "{DiskType} - {Size}GB ({Redundancy}) ({Role})" (e.g., "Premium_SSD_v2 - 512 GB (LRS) (Data)")
- ✓ Layer classification: always private (backend storage, not public-facing)
- ✓ One modeled OS disk per VM; data disk attachment is single-VM metadata in v1

**Key Integration Points:**
- VM `diskType` remains legacy simplified OS disk metadata; full disk modeling belongs to `MANAGED_DISK`
- Managed disk reachability tests deferred to v2; v1 focuses on form/validation completeness
- StorageNode display updated to show disk type + redundancy + role
- ComponentFormModal defaults managed disk to Premium_SSD_v2, LRS, Data role, 128 GB
- Export/import roundtrip preserves all 5 disk types + redundancy without data loss
- Legacy `sku` field (old 4-value enum) normalizes on component load to new model

**Do NOT:**
- Support fewer than 5 disk types; all must be available (Ultra, Premium v2, Premium, Standard SSD, HDD)
- Remove redundancy field or merge back into single SKU field; redundancy is independent constraint
- Allow ZRS for Ultra or Premium SSD v2 (Azure does not support)
- Allow Ultra or Premium SSD v2 as OS disks (Azure data-only constraint)
- Skip Standard HDD deprecation warning (Sept 8, 2028 retirement approaching)
- Allow data disk attachment to multiple VMs (single-attachment constraint per Azure)
- Merge disk role back into osType (role distinction foundational to architecture)
- Remove IOPS/throughput configuration for Ultra/Premium v2 (feature completeness)
- Support performance config on non-configurable types (warning-level validation)

**Future Enhancements (Out of Scope):**
- Disk snapshots and images (backup/DR; deferred to v2)
- Encryption key management and customer-managed keys (security feature; deferred)
- Disk caching policies (performance tuning; deferred)
- Premium disk bursting and performance tiers (advanced feature; deferred)
- Shared disks (multi-VM attachment; deferred)
- Disk lifecycle management (automation feature; deferred)
- Regional zone-specific availability UI (deployment context only; metadata-only approach)

### Azure Load Balancer (LoadBalancer) Component Rules

**Data Model & Validation:**
- `LoadBalancerComponent` in `types/network.ts` supports **Standard and Gateway SKUs only** (Basic was retired September 30, 2025)
- Core fields: `sku` (Standard | Gateway), `tier` (Regional | Global), `loadBalancerType` (Public | Internal), `availabilityZones` (zone IDs for zone redundancy), `idleTimeoutInMinutes` (4-30 range)
- Frontend config: `frontendIpConfigs[]` array with `publicIpId` (Public LB) or `subnetId` (Internal LB)
- Backend pools: `backendPools[]` with `nicIds[]` for NIC members
- Load balancing rules: `loadBalancingRules[]` with protocol (Tcp/Udp/All), frontend/backend ports (1-65535), optional `probeId`, `enableFloatingIp`, `idleTimeoutInMinutes`
- Health probes: `healthProbes[]` with protocol (Http/Https/Tcp), port (1-65535), interval (5-300s), numberOfProbes (>=1), optional requestPath (required for HTTP/HTTPS)
- Validator (`validateLoadBalancer()` in `componentValidators.ts`) enforces:
  - ❌ Error: SKU must be Standard or Gateway (reject Basic per retirement)
  - ❌ Error: Idle timeout 4-30 minutes if set
  - ❌ Error: Availability zones must be '1', '2', or '3' if set
  - ❌ Error: Health probe interval 5-300 seconds, numberOfProbes >= 1
  - ❌ Error: Load balancing rule ports 1-65535, protocol one of Tcp/Udp/All
  - ❌ Error: Frontend/backend IP configs validated (public IP exists for Public LB, subnet exists for Internal LB)
  - ⚠️ Warning: Fewer than 2 availability zones (zone redundancy recommended for Well-Architected reliability)
  - ⚠️ Warning: HTTP/HTTPS health probes require requestPath
  - ⚠️ Warning: Public LB with non-Standard public IP (Azure requires Standard SKU)
  - ⚠️ Warning: Public LB with Dynamic IP allocation (Azure requires Static allocation)
  - ⚠️ Warning: Backend pool approaching 5,000 endpoint limit (Standard LB max per Azure)
- `isValid` calculated from error-severity entries only (warnings do not block save)

**Form Behavior (`LoadBalancerForm.vue`):**
- Name (required text)
- **SKU selector** (Standard, Gateway only; no Basic option)
  - Helper text: "Basic SKU was retired September 30, 2025. Use Standard for production workloads."
  - Error if SKU not specified
- **Type selector** (Public, Internal)
- **Tier selector** (Regional, Global)
  - Warning if Global selected with Gateway SKU (Global tier only for Standard)
- **Availability Zones** (comma-separated text input via `availabilityZonesStr` computed property: `string[]` ↔ string)
  - Visual warning indicator if < 2 zones
  - Helper text: "2+ zones recommended for zone redundancy and reliability (Well-Architected)"
- **Idle Timeout** (4-30 minutes InputNumber)
  - Default 4 minutes (Azure default)
  - Helper text: "TCP idle timeout before connection reset"
- **Frontend IP Configuration** (conditional based on loadBalancerType):
  - Public LB: Select Public IP address from IP_ADDRESS nodes (required); error if not set or node doesn't exist
  - Internal LB: Select Subnet from SUBNET nodes (required); optional Private IP address field (empty = Dynamic); optional Private IP field
- **Backend Pool Members** (checkboxes for NETWORK_IC nodes)
  - Helper text: "Select NICs to include in the default backend pool"
  - Shows count and warning if approaching 5,000 limit
- **Health Probes section** (add/remove buttons):
  - Name (text)
  - Protocol selector (Http, Https, Tcp)
  - Port (1-65535 InputNumber with min/max constraints)
  - Interval (5-300 seconds InputNumber)
  - Unhealthy threshold (InputNumber >= 1)
  - Request Path (text, shown only for HTTP/HTTPS, required with warning if empty)
  - Delete button per probe
  - Probe-level validation errors displayed inline
  - Helper text: "Health probes monitor backend instance health; interval 5-300s recommended"
- **Load Balancing Rules section** (add/remove buttons):
  - Name (text)
  - Protocol selector (Tcp, Udp, All)
  - Frontend Port (1-65535 InputNumber)
  - Backend Port (1-65535 InputNumber)
  - Floating IP checkbox (optional)
  - Delete button per rule
  - Rule-level validation errors displayed inline
  - Helper text: "Rules define how frontend ports map to backend pools; each rule should reference a health probe"
- **Description** (optional textarea)
- Validation errors filtered by severity: only show error-severity messages; hide warnings by default (can be shown via getWarning() if needed)

**Azure Alignment:**
- ✓ SKU support (Standard and Gateway only; Basic retired Sept 30, 2025)
- ✓ Tier configuration (Regional standard; Global for cross-region via Standard SKU only)
- ✓ Zone redundancy across availability zones (2+ AZs recommended per Well-Architected)
- ✓ Zone-aware frontend and backend IP configuration
- ✓ Idle timeout configuration (4-30 minutes per Azure range for TCP connection timeout)
- ✓ Health probe validation (5-300s intervals, 1+ probe threshold, protocol-specific requestPath requirement)
- ✓ Load balancing rules with TCP/UDP/All protocols, port mapping, optional floating IP
- ✓ Backend pool sizing awareness (max 5,000 endpoints per Standard LB per Azure limits)
- ✓ Frontend type config-driven layer classification (Public = public-facing, Internal = vnet)
- ✓ Public IP Standard SKU + Static allocation validation (Azure requirement)
- ✓ Internal LB subnet requirement and VNet association validation
- ✓ Well-Architected Reliability: zone redundancy warnings, health probe best practices
- ✓ Well-Architected Security: internal/public frontend topology, NSG recommendations in findings
- ✓ Well-Architected Cost: efficient rule consolidation (avoid redundant rules)
- ✓ Well-Architected Operational Excellence: monitoring via health probes and test findings

**Key Integration Points:**
- LoadBalancer layer classification in `getComponentLayer()` ([stores/diagram.ts](stores/diagram.ts#L78-L80)):
  - Returns `public-facing` if loadBalancerType === 'Public'
  - Returns `vnet` if loadBalancerType === 'Internal'
  - Layer drives edge visibility and rendering behavior in diagram
- Node rendering: Mapped to `load-balancer-node` in `getNodeTypeForComponent()` ([lib/export/nodeTypeMap.ts](lib/export/nodeTypeMap.ts))
  - Node displays SKU + loadBalancerType detail (e.g., "Standard - Public")
- Test findings integration in ([stores/tests.ts](stores/tests.ts#L432-L490)):
  - Warning: Public LB with no Public IP frontend
  - Critical: Standard LB attached to non-Standard public IP
  - Warning: Zone redundancy < 2 AZs
  - Warning: No health probes configured
  - Warning: No load balancing rules configured
  - Warning: Internal LB frontend/backend VNet mismatch
- Sample diagram: Public Load Balancer with Standard SKU, zone redundancy (2 AZs), health probe, and load balancing rule ([components/diagram/DiagramCanvas.vue](components/diagram/DiagramCanvas.vue#L685-L722))
- Export/import roundtrip: All fields including availabilityZones and idleTimeoutInMinutes preserved

**Do NOT:**
- Support Basic SKU (retired Sept 30, 2025); only Standard and Gateway
- Remove capacity field without coordination (capacity was never an Azure LB property; removed in this update)
- Allow capacity field in new Load Balancer components (not an Azure property)
- Skip health probe interval/threshold validation (5-300s and >=1 are Azure requirements)
- Skip load balancing rule protocol/port validation
- Allow public LB without public IP frontend (required by Azure)
- Allow non-Standard public IP on Standard LB (Azure requirement)
- Allow Dynamic IP allocation on public frontend (Azure requires Static)
- Skip backend pool sizing warnings for Standard LB (5,000 endpoint limit)
- Suppress zone redundancy warnings (critical for Well-Architected reliability)
- Remove zone redundancy recommendation for production workloads
- Skip frontend/backend reference validation (must exist in diagram)
- Remove idleTimeoutInMinutes field (part of Azure LB configuration)

**Future Enhancements (Out of Scope):**
- Outbound rules / SNAT configuration (NAT gateway integration)
- Session persistence / sticky sessions modeling
- Multi-frontend configuration UI (currently supports single frontend via computed property)
- Gateway Load Balancer NVA chaining details (transparent chaining)
- Cross-region global load balancing traffic distribution (metadata-only support for tier=Global)
- Admin state override for maintenance (health probe override mechanism)
- IPv6 / dual-stack support
- Standard LB with HA Ports (Layer 4 all-ports load balancing)
- Multiple backend pool support via UI (current form simplifies to single default pool)

### Azure Application Gateway (AppGateway) Component Rules

**Data Model & Validation:**
- `AppGatewayComponent` in `types/network.ts` includes v2-only fields: `sku` (Standard_v2 | WAF_v2), `capacity` (1-32), `minInstances` (1-125), `maxInstances` (1-125), `idleTimeoutInMinutes` (4-30), `enableHttp2`, `enableWaf`, `wafMode` (Detection | Prevention), `enableMutualAuthentication`, `frontendType` (Public | Internal), `frontendIpId`, `subnetId`, `availabilityZones`, `keyVaultId`, `keyVaultCertificateName`, `keyVaultCertificateVersion`, `keyVaultManagedIdentityId`, legacy `keyVaultCertificateId`, `backendPools`, `healthProbes`, `loadBalancingRules`
- Validator (`validateAppGateway()` in `componentValidators.ts`) enforces:
  - ❌ Error: SKU must be Standard_v2 or WAF_v2 (v1 SKUs deprecated April 28, 2026)
  - ❌ Error: Capacity 1-32 for fixed capacity mode
  - ❌ Error: minInstances/maxInstances each 1-125; if both set, min ≤ max
  - ❌ Error: idleTimeoutInMinutes 4-30 (v2 supports full range vs v1's 4-min fixed)
  - ❌ Error: Subnet required and must exist
  - ❌ Error: If frontendType=Public, frontendIpId required and must exist
  - ❌ Error: Availability zones must contain only valid zone IDs ('1', '2', '3')
  - ❌ Error: Health probe port/interval/numberOfProbes valid (uses shared validators)
  - ⚠️ Warning: WAF mode must be set if WAF enabled
  - ⚠️ Warning: Subnet size recommendation (/24 or larger for v2 with 125+ instances)
  - ⚠️ Warning: < 2 availability zones (zone redundancy best practice)
  - ⚠️ Warning: No availability zones specified (not zone-redundant)
  - ⚠️ Warning: Public frontend IP SKU not Standard or allocation not Static (Azure requirement)
  - ⚠️ Warning: Key Vault certificate recommended for TLS on public frontend
  - ❌ Error: Key Vault certificate integration requires a user-assigned managed identity
  - ⚠️ Warning: Selected Key Vault is network-restricted without trusted-service bypass or matching subnet access
- `isValid` is calculated from `error`-severity entries only (warnings do not block save)

**Form Behavior (`AppGatewayForm.vue`):**
- Name (required text)
- SKU selector (Standard_v2, WAF_v2 only; v1 SKUs removed per deprecation)
- Frontend Type selector (Public, Internal) — config-driven layer classification
- Capacity (fixed mode, 1-32 instances)
- **Autoscaling Section (Optional):**
  - Min Instances (1-125 with error highlighting)
  - Max Instances (1-125 with error highlighting; must be >= minInstances)
  - Helper text: "Autoscale up to 125 instances based on traffic"
- Idle Timeout (4-30 minutes InputNumber with helper text)
- **Availability Zones** (comma-separated text input via `availabilityZonesStr` computed property; parsed into `string[]`)
  - Shows zone redundancy indicator with warning if < 2 zones
  - Helper text: "Comma-separated zone IDs (1, 2, 3) for zone redundancy"
- Enable HTTP/2 toggle
- Enable WAF toggle
- WAF Mode selector (Detection, Prevention) — shown only if WAF enabled
- Enable Mutual Authentication (mTLS) toggle (v2 feature)
- **Subnet selector** (required; from SUBNET nodes)
  - Error if missing or non-existent
  - Warning if subnet not /24 or larger
- **Frontend Public IP selector** (required if frontendType=Public; from IP_ADDRESS nodes)
  - Error if missing or non-existent when Public frontend selected
  - Warning if IP SKU not Standard or allocation not Static
  - Helper text: "Must be Standard SKU with Static allocation"
- **Key Vault integration section**
  - Key Vault selector (KEY_VAULT nodes)
  - Certificate name input
  - Optional certificate version input
  - User-assigned managed identity selector
  - Read-only secret URI preview
  - Shows warning if public frontend and no cert set (security best practice)
- **Backend Pool Members** (checkboxes for NETWORK_IC, VM, VMSS, AKS, APP_SERVICE, FUNCTIONS nodes)
- `getError(fieldName)` returns only `severity === 'error'` matches
- `getWarning(fieldName)` returns only `severity === 'warning'` matches

**Azure Alignment:**
- ✓ v2 SKUs only (Standard_v2, WAF_v2); v1 (Standard, WAF) removed per April 28, 2026 retirement
- ✓ Autoscaling support (1-125 instances; scales in 3-5 minutes)
- ✓ Zone redundancy across availability zones (2+ AZs recommended)
- ✓ Zone-aware configuration for fault tolerance
- ✓ Idle timeout configuration (4-30 minutes; default 4)
- ✓ WAF integration with Detection/Prevention modes
- ✓ HTTP/2 and WebSocket support
- ✓ Mutual Authentication (mTLS) for end-to-end security
- ✓ Key Vault certificate integration for TLS storage and auto-rotation
- ✓ Health probe configuration (custom probes with interval 5-300s, numberOfProbes threshold)
- ✓ Load balancing rules with frontend/backend port mapping
- ✓ Frontend type config-driven layer classification (Public = public-facing, Internal = vnet)
- ✓ Public IP Standard SKU + Static allocation validation
- ✓ Subnet sizing recommendation (/24 supports 125 instances + 5 reserved addresses)
- ✓ Well-Architected Reliability: zone redundancy, health probes, idle timeout alignment
- ✓ Well-Architected Security: WAF, TLS termination with Key Vault, mTLS
- ✓ Well-Architected Performance: autoscaling, compute unit metrics, throughput per instance
- ✓ Well-Architected Cost: consumption-based pricing, stop instances when not in use

**Key Integration Points:**
- AppGateway layer classification in `getComponentLayer()` ([stores/diagram.ts](stores/diagram.ts#L74-L76)):
  - Returns `public-facing` if frontendType === 'Public'
  - Returns `vnet` if frontendType === 'Internal'
  - Layer drives edge visibility and rendering behavior
- Node rendering: Mapped to `app-gateway-node` in `getNodeTypeForComponent()` ([lib/export/nodeTypeMap.ts](lib/export/nodeTypeMap.ts#L12))
  - Node displays SKU + capacity detail
- UDR integration context: UDR validator notes App Gateway in VirtualNetworkGateway next hop context ([lib/componentValidators.ts](lib/componentValidators.ts#L485))
  - AppGateway subnet should NOT have UDRs (causes health probe failures) — added as Well-Architected warning
- Public IP validation: Frontend Public IP must be Standard SKU with Static allocation (enforced in form and validator)
- Sample diagrams: Two examples in full sample ([components/diagram/DiagramCanvas.vue](components/diagram/DiagramCanvas.vue#L930-L970), [components/diagram/DiagramCanvas.vue](components/diagram/DiagramCanvas.vue#L1245-L1259)):
  - Public WAF_v2 with autoscaling, zone redundancy, health probes, load balancing rules
  - Internal Standard_v2 with autoscaling, zone redundancy

**Do NOT:**
- Remove v2 SKU support or add v1 SKUs (Standard, WAF) — they are deprecated
- Allow capacity outside 1-32 range (fixed mode)
- Allow autoscaling bounds outside 1-125 range
- Allow idle timeout outside 4-30 minute range
- Remove zone redundancy recommendation (2+ AZs for Well-Architected reliability)
- Skip subnet size validation (/24 recommended)
- Skip public IP SKU/allocation validation (Azure requires Standard + Static)
- Skip health probe validation (interval 5-300s, numberOfProbes >= 1)
- Allow Public frontend without frontendIpId (required for Azure deployment)
- Remove mTLS toggle (v2 feature for enhanced security)
- Skip Key Vault certificate warnings (security best practice for TLS)
- Allow availabilityZones with invalid zone IDs (must be '1', '2', '3')

**Future Enhancements (Out of Scope):**
- TCP/TLS proxy capabilities (Layer 4 proxying, separate from Layer 7 routing)
- Private Link support (private connectivity from other VNets/regions/subscriptions)
- Private-only deployment (no public IP required, ExpressRoute/VPN only)
- Application Gateway for Containers (separate product for AKS Ingress, uses Gateway API)
- SNAT port optimization strategies
- Rewrite HTTP headers and URL paths (already supported in Azure; not modeled)
- Custom error pages (already supported in Azure; not modeled)
- Session affinity enhancements

### Azure Kubernetes Service (AKS) Component Rules

**Data Model & Validation:**
- `AksComponent` in `types/network.ts` includes comprehensive AKS configuration with system/user node pools, autoscaling, availability zones, OS selection, pricing tiers, and monitoring integration
- Kubernetes version validation enforces N-2 support window (e.g., 1.28-1.35 as of May 2026); invalid versions trigger error-level validation
- Node count validates 1-1000 range; system pool min 3 recommended (warning if < 3)
- Availability zones optional but recommended (2+ zones for 99.99% SLA vs 99.95% single zone)
- Network plugin validation: Azure CNI (azure/overlay) required for Windows nodes; Kubenet for simple Linux networking (warning for production use)
- All required field validators (K8s version, nodeCount, subnetId, networkPlugin, apiServerAccess) enforce error-level; Well-Architected recommendations use warning-level
- `isValid` calculated from error-severity entries only (warnings non-blocking)

**Form Behavior (`ComputeForm.vue`):**
- AKS section organized into collapsible logical groups: Basic Configuration → Cluster Networking → Node Pools (system + user) → Autoscaling → Availability & Resilience → Security & Policies → OS & Image → Monitoring & Operations → Advanced (collapsible)
- K8s version dropdown with supported versions (1.28-1.35) with N-2 indicator help text
- Pricing tier selector (Free/Standard/Premium) with info badges; Free tier warns "dev/test only (no SLA)"
- Network plugin dropdown with guidance "Azure CNI recommended for production; kubenet for simple Linux networking"
- API Server Access selector (Public/Private) with security note recommending Private
- Subnet selector (required) with error display if missing or non-existent
- System Node Pool fieldset: Size (InputNumber min 1), VM SKU (text), helper text "Min 3 nodes recommended for production reliability"
- User Node Pool fieldset: Initial Count, VM Size (both editable), helper text "Min 2-3 nodes for production"
- Autoscaling toggle + conditional Min/Max Nodes fields (1-1000 range, shows warning if enabled but min==max)
- Availability Zones input (comma-separated, parsed/serialized via `availabilityZonesStr` computed property) with warning indicator if < 2 zones
- RBAC toggle (display as enabled, required per Azure best practices); Private Cluster toggle (enabled by default, recommended)
- Network Policies toggle + conditional provider dropdown (azure/calico)
- API Server Authorized IP Ranges multi-line input (comma-separated CIDR blocks, optional)
- OS SKU dropdown (Ubuntu/AzureLinux/Windows2022) with helper "Default: Ubuntu 22.04 LTS"
- Monitoring toggle + conditional Monitoring Workspace ID field (optional, for Log Analytics integration)
- Managed Identity toggle (enabled by default, recommended)
- Advanced section (collapsible): Outbound Type, Load Balancer SKU, DNS Prefix, Service CIDR, DNS Service IP, Docker Bridge CIDR (all optional)

**Azure Alignment:**
- ✓ All four N-2 supported Kubernetes versions with validation range enforcement
- ✓ Three pricing tiers (Free, Standard, Premium) with correct SLA characteristics (Free no SLA, Standard/Premium with SLA)
- ✓ System node pool concept separate from user node pools (system required ≥3 nodes for Kubernetes control plane)
- ✓ Cluster autoscaler with min/max bounds (1-1000 per Azure scaling limits)
- ✓ Availability zones support for zone-redundant deployments (2+ zones → 99.99% SLA)
- ✓ Node pool VM sizing recommendations (min D2s_v3+ for production nodes)
- ✓ Network plugin constraints: Azure CNI mandatory for Windows nodes, Kubenet for Linux-only basic networking
- ✓ API server access modes (Public with IP-based lockdown, Private via vnet integration)
- ✓ Outbound traffic type configuration (loadBalancer, userDefinedRouting, managedNAT)
- ✓ OS SKU support (Ubuntu, AzureLinux, Windows2022 per Azure AKS supported images)
- ✓ RBAC always enabled (mandatory per Azure security requirement)
- ✓ Managed Identity integration (MSI recommended for workload authentication)
- ✓ Network policies for microsegmentation (Calico/Azure NPM options)
- ✓ Container Insights monitoring integration (Log Analytics workspace)
- ✓ Well-Architected Reliability: zone redundancy warnings, autoscaler recommendation, min node count guidance
- ✓ Well-Architected Security: private cluster recommendation, network policies recommendation, RBAC enforcement
- ✓ Well-Architected Cost: pricing tier selection, right-sizing node VMs, spot instance support (future)
- ✓ Well-Architected Operational Excellence: monitoring recommended, IaC-ready field export

**Validation Rules:**
- ❌ Error: `kubernetesVersion` must be one of supported versions (1.28-1.35 N-2 window)
- ❌ Error: `nodeCount` between 1-1000
- ❌ Error: `subnetId` required and must exist
- ❌ Error: `networkPlugin` must be 'azure', 'azure-overlay', or 'kubenet'
- ❌ Error: `apiServerAccess` must be 'Public' or 'Private'
- ❌ Error: `pricingTier` must be 'Free', 'Standard', or 'Premium' if set
- ❌ Error: If `enableClusterAutoscaler` true, minNodeCount ≤ maxNodeCount (both 1-1000)
- ⚠️ Warning: If nodeCount < 2 or systemNodePoolSize < 3 (reliability concern)
- ⚠️ Warning: If availabilityZones not set or < 2 (SLA 99.95% vs 99.99%)
- ⚠️ Warning: If apiServerAccess=Public (security risk; private recommended)
- ⚠️ Warning: If enableNetworkPolicy=false (security recommendation)
- ⚠️ Warning: If enableMonitoring=false (observability recommendation)
- ⚠️ Warning: If enableClusterAutoscaler=false (operational concern for production)
- ⚠️ Warning: If pricingTier=Free (no SLA, dev/test only)
- ⚠️ Warning: If kubernetesVersion not latest GA (security patches recommendation)
- ⚠️ Warning: If networkPlugin=kubenet (basic networking; Azure CNI recommended for production)

**Key Integration Points:**
- AKS layer classification in `getComponentLayer()` ([stores/diagram.ts](stores/diagram.ts)): Always `vnet` layer (deployed in subnet, VNet-scoped)
- Node rendering: Mapped to `compute-node` type (same as VM, VMSS, Bastion); display detail "N nodes - K8s vX.Y.Z"
- Backend pool compatibility: AKS node pools can theoretically be ingress targets for LoadBalancer (internal) or AppGateway (via pod ingress controller); not modeled in current form but valid Azure topology
- Subnet integration: AKS cluster nodes must have IP space in referenced subnet; subnet sizing recommendation: /24 or larger for scalability
- Test integration: Inbound reachability tests can reference AKS cluster as target (port 80 on ingress controller)
- Sample diagram: Full sample includes AKS cluster with Standard pricing, Private API server, Azure CNI, Private Cluster enabled, Network Policies enabled, System pool 3 nodes, User pool 2 nodes, zones 1,2,3, autoscaling enabled min 2 / max 5

**Do NOT:**
- Remove node pool architecture (system vs user distinction is mandatory)
- Allow Kubernetes versions outside N-2 support window (enforcement critical for security/support)
- Skip network plugin validation for OS compatibility (Windows + kubenet must error)
- Allow RBAC to be disabled (per Azure security best practices)
- Remove availability zones field or skip zone redundancy validation
- Treat pricing tier as cosmetic (impacts SLA and cost model)
- Skip autoscaling min/max bounds validation (1-1000 per Azure limits)
- Remove Well-Architected warning severity for recommendations (maintain as non-blocking guidance)
- Allow system node pool sizing below 1 or above 1000 (per Azure scaling limits)
- Merge system/user node pools into single concept (architectural correctness depends on separation)
- Support Kubernetes versions < 1.28 or > 1.35 without explicit update (N-2 policy requires maintenance)

**Future Enhancements (Out of Scope):**
- Multiple user node pools with distinct autoscaling policies (current: single user pool)
- Spot node pools for cost optimization (requires separate node pool management UI)
- Node auto-upgrade configuration (automatic K8s patch updates)
- Virtual network peering for private cluster API access from other VNets
- Advanced networking: IPv6 dual-stack support, custom CNI configurations
- Workload identity federation (direct pod authentication without secrets)
- AKS Automatic mode (managed, opinionated cluster configuration)
- Multi-region AKS deployments with disaster recovery
- Persistent volume / storage integration modeling (volumes are compute workload metadata)
- Container Registry integration (image pull via vnet endpoints, not modeled)
- Azure Policy compliance monitoring (policy assignments on cluster scope)

## Tests and Animation Rules

### Internet test identity

- `INTERNET_SOURCE_ID = '__internet__'` is both:
    - the special internet test source id
    - the persisted id of the system-managed Public Internet node

### Auto-run behavior

- Test auto-run is triggered by explicit load/import events (`diagramLoadId` changes), not by generic node/edge count changes.
- App-native `.drawio` imports may defer that one auto-run cycle until the post-import reset-tests prompt is resolved; keep the trigger tied to the import/load event rather than broad structural watchers.
- Keep debounce and concurrency guards around automatic test execution.

### Import scope

- Keep current import UX behavior where the bottom toolbar picker accepts `.drawio`.
- Preserve parser compatibility in `useImport.ts` for `.xml` when files are provided programmatically.

### Animation mode

- Animation mode is an ephemeral overlay state, not persisted infrastructure state.
- Keep the current behavior where animation paths come from test results and are rendered through overlay edges/node states.

## UI/Rendering Constraints (High Impact)

- Keep edge rendering on smoothstep paths (`NetworkEdge.vue` and `AnimationEdge.vue`).
- Keep animation keyframes global in `assets/css/diagram.css` (not scoped).
- Keep manual edge creation/editing disabled at Vue Flow level.
- Keep single-click-to-edit behavior for user-managed nodes while unlocked; Public Internet stays non-editable.
- Preserve tablet-responsive shell behavior (`<= 1024px`) for `components/layout/AppHeader.vue`, `components/layout/ComponentCommandPalette.vue`, and `components/layout/BottomToolbar.vue`: header keeps compact branding + account/setup actions while the command palette remains usable for grouped component insertion, and bottom toolbar remains single-row with horizontal scrolling (no forced multi-row wrap).

### Network Summary Hover Performance

- **Debounced hover state:** Network Summary group header hovers are debounced at 16ms (one frame at 60fps) in `components/layout/RightPanel.vue` to reduce store update frequency and prevent excessive node re-renders.
- **Memoized node decoration:** Canvas node identification highlighting in `components/diagram/DiagramCanvas.vue` is memoized based on highlight node IDs to avoid re-decorating nodes when the highlight set hasn't changed.
- **Cache invalidation:** The memoization cache is cleared when entering/exiting animation mode or when node count changes.
- These optimizations ensure smooth hover interactions even on large diagrams with hundreds of nodes.

## Modal/Theme/Icon Constraints

- Keep custom confirm component name `ConfirmActionDialog`; do not rename it to `ConfirmDialog`.
- PrimeVue theme must stay configured via `importTheme` (not runtime-serialized preset config).
- PrimeVue Button `icon` prop accepts only `pi pi-*`; use button `#icon` slot for Iconify icons.
- The command palette, Network Summary sidebar, and diagram nodes use locally bundled Azure Public Service SVG collections through `@nuxt/icon`; keep that collection limited to those surfaces unless the bundle strategy is revisited.

## Known Type-Check Status

- `npm run build` is the validation gate.
- Pre-existing `npx vue-tsc --noEmit` issues currently remain in areas including:
    - `components/diagram/DiagramCanvas.vue`
    - `components/diagram/edges/AnimationEdge.vue`
    - `components/forms/LoadBalancerForm.vue`
    - `components/modals/ComponentFormModal.vue`
    - `components/panels/TestFormModal.vue`
    - `composables/useExport.ts`
    - `lib/dagre.ts`
    - `lib/export/**`
    - `lib/s3.ts`
    - `stores/tests.ts`
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
    - `AGENTS.md`

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
- Keep TanStack Vue Query responsible for remote/server state flows (auth bootstrap, settings sync, saved setups) unless the architecture is intentionally being changed.
- Do not reintroduce implicit auto-layout on node add.
- Preserve deployment architecture contract and docs synchronization rule.

### Azure Virtual Machine Scale Sets (VMSS) Component Rules

**Data Model & Orchestration Modes:**
- `VmssComponent` in `types/network.ts` includes `orchestrationMode: 'Flexible' | 'Uniform'` (required, immutable)
- Flexible: up to 1,000 VMs, mixed SKUs, Spot + on-demand mix, 99.99% SLA with zones (recommended)
- Uniform: up to 600 (custom images) or 1,000 (platform images), identical instances, 99.95% SLA
- Orchestration mode cannot be changed after creation in Azure; simulator enforces immutability by making it read-only after first save

**Data Fields & Validation:**
- **Required**: `sku` (VM size), `os` (Windows | Linux), `capacity` (0-1000, allows empty scale set), `orchestrationMode`, `subnetId`
- **Optional but Recommended**: `imagePublisher`, `imageOffer`, `imageSku` (warning if all missing)
- **Optional**: `upgradePolicy` (default Automatic), `autoscaleEnabled`, `minCapacity`, `maxCapacity`, `availabilityZones`, `scaleInPolicy` (Flexible-only), `overprovision` (Uniform-only)
- **Capacity Range**: 0-1000 (allows deferred deployment with 0 instances; scales up later via autoscale or manual scaling)
- **Availability Zones**: Optional array of zone IDs (1, 2, 3); warning if < 2 zones (99.95% SLA vs 99.99%)
- **Autoscale Validation**: If enabled, min >= 0, max <= 1000, min <= max (error if min > max); warning if min == max (no scaling effect)

**Form Behavior (`ComputeForm.vue`):**
- Orchestration Mode selector (required SelectButton: Flexible, Uniform) with info box explaining mode immutability and key differences
- SKU (required text, error if empty)
- OS (required SelectButton: Windows, Linux)
- Image publisher/offer/SKU (recommended text; warning if missing)
- Initial Capacity (0-1000 InputNumber; error if outside range)
- Upgrade Policy (Automatic, Manual, Rolling; optional Select)
- Availability Zones (comma-separated input via `availabilityZonesStr` computed property; validates zones are 1, 2, 3)
- **Flexible-Only**: Scale-In Policy dropdown (FIFO, OldestVM, NewestVM) shown only when `orchestrationMode === 'Flexible'`
- **Uniform-Only**: Overprovision toggle (default true, warning about extra instance creation for reliability) shown only when `orchestrationMode === 'Uniform'`
- Autoscale section (toggle + conditional Min/Max Capacity fields with 0-1000 constraints)
- Subnet (required dropdown; error if missing or non-existent)

**Validation Rules (`componentValidators.ts` - validateCompute VMSS section):**
- ❌ Error: `sku` required and non-empty
- ❌ Error: `os` must be 'Windows' or 'Linux'
- ❌ Error: `orchestrationMode` must be 'Flexible' or 'Uniform'
- ❌ Error: `capacity` must be 0-1000 (allows zero for deferred deployment)
- ❌ Error: `subnetId` required and must exist
- ❌ Error: If autoscale enabled: min >= 0, max <= 1000, min <= max
- ⚠️ Warning: Image publisher/offer/SKU recommended for deployment realism (if any missing)
- ⚠️ Warning: Availability zones must contain only 1, 2, or 3
- ⚠️ Warning: < 2 availability zones (SLA drops to 99.95%; 2+ recommended for 99.99%)
- ⚠️ Warning: If autoscale enabled and min == max (autoscaling will not trigger)
- ⚠️ Warning: Overprovision=true (Uniform only; creates extra instances for deployment reliability)

**Azure Alignment:**
- ✓ Two orchestration modes with correct capacity limits (Flexible: 1,000; Uniform: 600-1,000 depending on image)
- ✓ Mode immutability enforced (simulator prevents mode change after creation)
- ✓ Required fields (SKU, OS) apply uniformly to all instances
- ✓ Capacity range 0-1,000 (matches Azure; allows empty scale set for deferred deployment)
- ✓ Upgrade policies Automatic (recommended), Manual, Rolling
- ✓ Autoscaling independent of upgrade policy; optional metrics/schedule-based scaling
- ✓ Availability zones support; 99.99% SLA with 2+ zones
- ✓ Scale-in policy selection (Flexible mode)
- ✓ Overprovision toggle (Uniform mode; default true for deployment reliability)
- ✓ Well-Architected Reliability: zone redundancy warnings, autoscale min/max bounds
- ✓ Well-Architected Security: NSG rules, UDR integration, network isolation via subnet
- ✓ Well-Architected Operational Excellence: upgrade policy guidance, health probe awareness

**Key Integration Points:**
- Node type: `compute-node` (in `stores/diagram.ts` getNodeType)
- Layer classification: `vnet` (deployed in subnet, always VNet-scoped)
- Backend pool membership: VMSS instances can be added to LoadBalancer and AppGateway backend pools
- Test integration: VMSS inbound reachability test (Internet → port 80) in full sample diagram
- Sample diagrams: VMSS instance in full multi-component sample with Flexible mode, zones, autoscale

**Do NOT:**
- Support fewer than two orchestration modes (both Flexible and Uniform required for Azure accuracy)
- Allow orchestration mode change after first save (Azure mode is immutable)
- Restrict capacity to >= 1 (Azure allows 0 for deferred deployment; must allow 0-1,000 range)
- Skip zone redundancy warnings (critical for SLA awareness)
- Remove scale-in policy or overprovision fields (core features of respective modes)
- Treat SKU or OS as optional (both are required in Azure)
- Mix or merge orchestration modes in validation logic (each mode has distinct behavior and limits)

**Future Enhancements (Out of Scope):**
- Spot instance priority and eviction policy (Flexible supports Spot + on-demand mix)
- Public IP per instance configuration (Flexible supports per-instance public IPs)
- Instance protection capability (prevent specific instances from scale-in)
- Health probe reference and Application Health Extension configuration
- Automatic OS image upgrades via Azure Compute Gallery
- Per-instance fault domain assignment (Flexible advanced feature)
- Multiple NICs and custom IP configurations per instance (Flexible only)

## Tests and Animation Rules
