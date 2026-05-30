# Azure Service Endpoint Component

## Overview
Azure virtual network service endpoints extend subnet identity to supported Azure platform services so traffic stays on the Microsoft backbone while the service still uses its public endpoint model.

In this simulator, Service Endpoint is modeled with a visible node for topology clarity, while the authoritative configuration is `SubnetComponent.serviceEndpoints[]`.

## Data Model (`ServiceEndpointComponent` in `types/network.ts`)
- `type: NetworkComponentType.SERVICE_ENDPOINT`
- `service: string` (required, normalized; known values suggested)
- `subnetId?: string` (required for valid configuration; must reference a `SUBNET` node)
- `locations?: string[]` (optional metadata for service-specific region context, used for SQL same-region warning)

## Canonical Source and Sync Rules
- `SubnetComponent.serviceEndpoints[]` is the source of truth for effective service endpoint configuration.
- `SERVICE_ENDPOINT` nodes are synchronized mirrors for canvas UX and export readability.
- Reconciliation runs on diagram load and node add/update/remove to:
  - Merge legacy setups that define endpoints either on subnets or as Service Endpoint nodes.
  - Normalize known service names to canonical casing.
  - Preserve unknown/custom service strings.
  - Enforce uniqueness per `(subnetId, service)`.
  - Materialize missing Service Endpoint nodes from subnet endpoint lists.
  - Remove orphan Service Endpoint nodes that are not present in subnet endpoint lists.

## Form Behavior (`NetworkICForm.vue`, Service Endpoint mode)
- Name (required text)
- Service (editable select with known Azure services + custom values)
- Subnet (required select from subnet nodes)
- Helper text states:
  - Endpoints are configured per service and per subnet.
  - SQL endpoints should use same-region pairing.
  - Node values are mirrored to subnet Service Endpoints.

## Validation (`validateNetworkIC()` in `lib/componentValidators.ts`)
- Error: `service` is required.
- Warning: unknown `service` values are allowed but flagged for manual support confirmation.
- Error: `subnetId` is required, must exist, and must reference a `SUBNET` node.
- Warning: `Microsoft.Sql` with explicit `locations[]` warns when subnet region is not included.
- No duplicate Service Endpoint validation blocks; validation is single-path.

## Integration Points
- Subnet form (`SubnetForm.vue`) edits `serviceEndpoints[]` and mirrors to Service Endpoint nodes via store reconciliation.
- Service Endpoint node edits update subnet endpoint lists via store reconciliation.
- Key Vault validator checks subnet `serviceEndpoints[]` for `Microsoft.KeyVault` when subnet firewall rules are used.
- Node rendering/layer behavior remains unchanged:
  - mapped to `compute-node`
  - layer classified as `vnet`
  - subnet containment via `subnetId`

## Azure Alignment
- Matches Azure’s subnet-scoped endpoint model (service endpoint is enabled on subnets per service).
- Keeps service endpoint scope as network-plane access control signal, not private-link semantics.
- Preserves compatibility with existing diagrams that stored endpoint intent as nodes.

## Out of Scope
- Real-time Azure discovery of regional service endpoint availability
- Service endpoint policies behavior modeling and enforcement
- Private endpoint substitution guidance automation

## References
- https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoints-overview
- https://learn.microsoft.com/en-us/azure/virtual-network/tutorial-restrict-network-access-to-resources
- https://learn.microsoft.com/en-us/azure/virtual-network/vnet-integration-for-azure-services
- https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoint-policies-overview
