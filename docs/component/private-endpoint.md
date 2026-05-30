# Azure Private Endpoint Component

## Overview
Azure Private Endpoint provides private connectivity to Azure services through a private IP address inside a virtual network subnet. The simulator models the private endpoint as a VNet-managed resource and validates required wiring to subnet, target private-link resource, and optional private DNS integration.

## Data Model (`PrivateEndpointComponent` in `types/network.ts`)
- `type: NetworkComponentType.PRIVATE_ENDPOINT`
- `connectionName: string` - Required. Friendly name for the private endpoint connection.
- `privateLinkServiceId?: string` - Required by validator. Target private-link resource in the diagram.
- `groupIds?: string[]` - Required by validator. Service subresources (for example: `blob`, `file`, `vault`, `sites`).
- `subnetId?: string` - Required by validator. Subnet hosting the private endpoint NIC.
- `privateIpAddress?: string` - Optional static private IP. Must be IPv4 and fit subnet CIDR.
- `dnsZoneGroupId?: string` - Optional private DNS zone reference.

## Form Behavior (`NetworkICForm.vue`, Private Endpoint mode)
- **Fields:**
  - Connection Name (required)
  - Private IP Address (optional)
  - Subnet (required)
  - Target Resource / Private Link Service (required)
  - Sub-resource Group IDs (required, comma-separated)
  - Private DNS Zone Group (optional, private zones only)
- **Validation feedback:**
  - Inline error/warning messages for: `connectionName`, `privateIpAddress`, `subnetId`, `privateLinkServiceId`, `groupIds`, `dnsZoneGroupId`
  - Helper text clarifies group ID purpose and private DNS zone expectations

## Validator Rules (`validateNetworkIC()` in `lib/componentValidators.ts`)
- **Blocking errors:**
  - Missing `connectionName`
  - Missing `subnetId`
  - Missing `privateLinkServiceId`
  - Missing or empty `groupIds[]`
  - `subnetId` points to missing/non-`SUBNET` node
  - `privateLinkServiceId` points to missing node
  - `privateIpAddress` invalid IPv4 format
  - `privateIpAddress` outside selected subnet CIDR
- **Warnings (non-blocking):**
  - Selected subnet has `privateEndpointNetworkPolicies === 'Enabled'` (verify intended NSG/UDR behavior)
  - `privateIpAddress` uses reserved subnet address (network, gateway `.1`, broadcast)
  - `privateLinkServiceId` points to a type outside simulator-supported PE targets
  - `groupIds[]` value appears incompatible with selected target type
  - `dnsZoneGroupId` missing/non-`DNS_ZONE`/non-Private DNS zone

## Integration Logic
- **Supported target resource picker types (current simulator):**
  - `STORAGE_ACCOUNT`, `BLOB_STORAGE`, `KEY_VAULT`, `APP_SERVICE`, `FUNCTIONS`, `AKS`
- **DNS zone integration:**
  - `dnsZoneGroupId` can reference private DNS zones (`zoneType='Private'`)
- **Graph synthesis:**
  - Connectivity/test/challenge graph generation links PE to `privateLinkServiceId` and `dnsZoneGroupId`
- **Cross-component references:**
  - App Service and Functions `privateEndpointId` are validated as warning-level if missing or not pointing to `PRIVATE_ENDPOINT`
- **Layer classification:**
  - Always `VNet-Managed`

## Azure Alignment
- Aligns with core Microsoft Learn PE properties: name, subnet, private-link resource, target subresource (`groupIds`), and DNS considerations.
- Uses warning-level checks where Azure behavior is service- or environment-dependent.
- Connection approval workflow states are out of scope for v1.

## Out of Scope / Future Enhancements
- Connection approval lifecycle (`Approved`, `Pending`, `Rejected`, `Disconnected`)
- Manual/automatic approval-mode UI
- Private Link Service provider-side modeling and alias flow
- Full service-by-service subresource matrix and DNS auto-suggestions

## References
- [What is a private endpoint?](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-overview)
- [Quickstart: Create a private endpoint by using the Azure portal](https://docs.azure.cn/en-us/private-link/create-private-endpoint-portal)
