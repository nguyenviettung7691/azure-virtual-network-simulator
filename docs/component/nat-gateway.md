# Azure NAT Gateway Component Specification

## Overview
Azure NAT Gateway provides outbound internet connectivity for one or more subnets in a virtual network. It is a managed, scalable, and resilient SNAT service for private resources.

## Data Model
- `NatGatewayComponent` (`types/network.ts`)
  - `type: NetworkComponentType.NAT_GATEWAY`
  - `sku: 'Standard'` (required)
  - `publicIpIds?: string[]`
  - `publicIpPrefixIds?: string[]` (compatibility-only IDs; no dedicated prefix component type yet)
  - `subnetIds?: string[]`
  - `idleTimeoutInMinutes?: number` (4-120)
  - `availabilityZones?: string[]` (`'1' | '2' | '3'`)

## Form Behavior (`NatGatewayForm.vue`)
- Name (required, 1-80 characters, alphanumeric/hyphen, start/end alphanumeric)
- SKU (read-only `Standard`)
- Idle timeout (4-120)
- Availability zones (comma-separated IDs: `1,2,3`)
- Public IP Addresses (multi-select from diagram `IP_ADDRESS` nodes with `sku === 'Standard'`)
- Public IP Prefix IDs compatibility field (comma-separated text; unresolved IDs are warnings)
- Subnets (multi-select; max 16)
- Inline validation messages are shown per field.

## Validation Rules (`validateNatGateway()`)
- Error: missing/invalid name.
- Error: `sku` must be `Standard`.
- Error: `idleTimeoutInMinutes` must be 4-120.
- Error: zone value outside `1|2|3`.
- Warning: single-zone NAT (not zone-redundant).
- Error: total capacity references (`publicIpIds.length + publicIpPrefixIds.length`) > 16.
- Error: each `publicIpId` must exist, be `IP_ADDRESS`, and have `sku === 'Standard'`.
- Error: same public IP cannot be attached to another NAT Gateway.
- Warning: unresolved `publicIpPrefixIds` (compatibility-only).
- Error: `subnetIds` > 16.
- Error: each subnet must exist and be `SUBNET`.
- Error: subnet cannot be attached to a different NAT Gateway.

## Integration
- `NAT_GATEWAY` uses `nat-gateway-node` renderer.
- Palette metadata includes NAT description + aliases (`nat`, `nat gateway`, `egress`).
- Bidirectional sync is enforced in store normalization:
  - `NatGatewayComponent.subnetIds[]` and `SubnetComponent.natGatewayId` are reconciled.
  - Editing either side updates the other.
  - Removing NAT clears orphaned subnet references.

## Azure Alignment Notes
- Standard SKU only.
- Up to 16 IPv4 address capacity references in simulator semantics.
- Up to 16 subnet attachments per NAT Gateway.
- One NAT Gateway per subnet.
- Configurable TCP idle timeout 4-120.
- No dedicated Public IP Prefix component type in current simulator version.

## References
- What is Azure NAT Gateway: https://docs.azure.cn/en-us/nat-gateway/nat-overview
- NAT gateway resource: https://docs.azure.cn/en-us/nat-gateway/nat-gateway-resource
- Quickstart: Create a NAT gateway: https://docs.azure.cn/en-us/nat-gateway/quickstart-create-nat-gateway
