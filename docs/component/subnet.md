## Azure Subnet Component

### Data Model (`SubnetComponent` in `types/network.ts`)
- `id`, `name`, `type: SUBNET`, `createdAt`
- `addressPrefix` (required IPv4 CIDR, minimum /29)
- `addressPrefixIPv6` (optional IPv6 CIDR, minimum /64)
- `vnetId` (required parent VNet)
- Optional references: `nsgId`, `routeTableId`, `natGatewayId`
- Optional arrays: `serviceEndpoints[]`, `delegations[]`
- Optional flags: `privateEndpointNetworkPolicies`, `privateSubnet`

### Form Fields
1. Name (required)
2. Address Prefix IPv4 (required)
3. Address Prefix IPv6 (optional)
4. Parent VNet (required)
5. NSG (optional)
6. Route Table (optional)
7. NAT Gateway (optional)
8. Service Endpoints (optional comma-separated)
9. Delegations (optional comma-separated)
10. Private Endpoint Network Policies (optional)
11. Private Subnet toggle (optional)

### Validation (`validateSubnet()`)
- Error: name missing/invalid.
- Error: invalid IPv4 CIDR or CIDR too small.
- Error: invalid IPv6 CIDR when provided.
- Error: missing/invalid VNet and subnet range outside parent VNet.
- Warning: unknown `nsgId`, `routeTableId`, or `natGatewayId`.
- Warning: delegation and private endpoint policy conflicts.

### NAT Gateway Integration
- `natGatewayId` is active (not reserved).
- Subnet can be attached to at most one NAT Gateway.
- Store reconciliation keeps both sides consistent:
  - `SubnetComponent.natGatewayId`
  - `NatGatewayComponent.subnetIds[]`
- Editing either Subnet or NAT Gateway updates the other side.
- Removing NAT Gateway clears stale subnet NAT references.

### Related Component Interactions
- NSG: subnet-level filtering.
- UDR: subnet-level routing override.
- Service Endpoints: authoritative on subnet and mirrored to Service Endpoint nodes.
- Compute/NIC placement: subnet is a containment/routing anchor for workloads.
