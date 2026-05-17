## Azure Subnet Component

**Data Model** (`SubnetComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Must start with letter (Azure best practice) |
| `type` | `SUBNET` | ✓ | Enum value |
| `description` | string | — | Optional free-form text |
| `addressPrefix` | string | ✓ | IPv4 CIDR (e.g., 10.0.1.0/24); must be /29 or larger |
| `addressPrefixIPv6` | string | — | Optional IPv6 CIDR (e.g., 2001:db8:1::/64); must be /64 or larger for dual-stack support |
| `vnetId` | string | ✓ | Parent VNet reference (containment edge) |
| `nsgId` | string | — | Optional NSG reference (security filtering) |
| `routeTableId` | string | — | Optional UDR/Route Table reference (routing control) |
| `natGatewayId` | string | — | Reserved for future NAT Gateway support |
| `serviceEndpoints` | string[] | — | Optional list of service names (e.g., `["Microsoft.Storage", "Microsoft.KeyVault"]`); enables direct connectivity to Azure services |
| `delegations` | string[] | — | Optional list of service delegations (e.g., `["Microsoft.Web/serverFarms"]`); grants service permission to manage instances in subnet |
| `privateEndpointNetworkPolicies` | 'Enabled' \| 'Disabled' | — | Controls whether NSGs and UDRs apply to private endpoints (default: 'Enabled'); must be 'Enabled' if delegations are present |
| `privateSubnet` | boolean | — | When true, prevents default outbound access to internet (default: false) |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |
| `parentId` | string | — | (Inherited from NetworkComponent; not used for Subnets) |

**Form Fields & Validation:**

1. **Name** (required text)
   - Placeholder: `"my-subnet"`
   - **Validation Rules:**
     - Required, non-empty
     - ❌ Error if first character is not a letter (a-z, A-Z)
     - ✓ Can contain letters, numbers, hyphens, underscores after first character

2. **Address Prefix (IPv4)** (required text)
   - Placeholder: `"10.0.1.0/24"`
   - Hint: "Must be /29 or larger (minimum 8 IPs). Must fit within parent VNet."
   - **Validation Rules:**
     - Required, non-empty
     - ❌ Error if invalid CIDR format
     - ❌ Error if prefix larger than /29 (e.g., /30, /31, /32 rejected)
     - ❌ Error if CIDR does not fit within any parent VNet address space
     - ✓ Supports IPv4 only (e.g., 10.0.0.0/16)

3. **Address Prefix (IPv6)** (optional text)
   - Placeholder: `"2001:db8:1::/64"`
   - Hint: "Optional. For dual-stack support. Must be /64 or larger."
   - **Validation Rules:**
     - Optional; empty is valid
     - If provided, must be valid IPv6 CIDR format
     - ❌ Error if prefix larger than /64
     - ✓ Enables dual-stack IPv4+IPv6 subnets

4. **Parent VNet** (required dropdown)
   - Options: Dynamically populated from all VNET nodes in diagram
   - **Validation Rule:** Must select one VNet; no default

5. **Network Security Group (NSG)** (optional dropdown)
   - Options: Dynamically populated from all NSG nodes in diagram
   - Placeholder: "None"
   - ⚠️ Warning if specified NSG does not exist in diagram
   - **NSG Behavior:** See § 2.3 Azure Network Security Group (NSG) Component Specification for complete NSG rules model and evaluation order. Inbound traffic filtered by subnet NSG first, then NIC NSG (if NIC also has NSG). Outbound: NIC NSG first, then Subnet NSG.

6. **Route Table (UDR)** (optional dropdown)
   - Options: Dynamically populated from all UDR nodes in diagram
   - Placeholder: "None"
   - ⚠️ Warning if specified UDR does not exist in diagram
   - ⚠️ **Critical Constraint:** Each subnet can have at most 0 or 1 route table. If changing `routeTableId` from an existing route table to a different one, the subnet disconnects from the old table and connects to the new one. See § 2.4 Azure User-Defined Routes (UDR) Component Specification for complete UDR model, routing logic, and Azure constraints.
   - **UDR Behavior:** Routes in the associated UDR table override Azure's system routes using longest prefix match algorithm. Routes apply to all traffic leaving the subnet toward non-local destinations. If `disableBgpRoutePropagation=true`, dynamic BGP routes from VPN/ExpressRoute gateways are not added.

7. **NAT Gateway** (reserved field, currently disabled)
   - Displays: "NAT Gateway component not yet available"
   - Note: Reserved for future NAT Gateway support

8. **Service Endpoints** (optional comma-separated text)
   - Placeholder: `"Microsoft.Storage, Microsoft.KeyVault"`
   - Hint: "Enables direct connectivity to Azure services via private backbone"
   - **Validation Rules:**
     - Optional; empty is valid
     - Freeform text; no format validation in current implementation
     - Each endpoint name typically follows pattern: `Microsoft.ServiceName` or `Microsoft.ServiceName/ResourceType`

9. **Delegations** (optional comma-separated text)
   - Placeholder: `"Microsoft.Web/serverFarms"`
   - Hint: "Grants service permission to deploy and manage instances in this subnet"
   - **Validation Rules:**
     - Optional; empty is valid
     - Freeform text; no format validation in current implementation
     - ⚠️ Warning if delegations are present AND `privateEndpointNetworkPolicies === 'Disabled'` (Azure constraint: delegated subnets cannot have private endpoints)
     - Common examples: `Microsoft.Web/serverFarms` (App Service), `Microsoft.Databricks/workspaces`, `Microsoft.ContainerInstance/containerGroups`

10. **Private Endpoint Network Policies** (optional dropdown)
    - Options: `['Enabled', 'Disabled']`
    - Hint: "Disabled allows private endpoints. Cannot be Disabled if delegations are configured."
    - **Validation Rules:**
      - Optional; defaults to 'Enabled' if not set
      - ⚠️ Warning if set to 'Disabled' while delegations are present

11. **Private Subnet** (optional toggle/checkbox)
    - Label: "Prevent default outbound access"
    - Hint: "When enabled, resources in this subnet have no default outbound access to the internet."
    - **Validation Rule:** Optional; defaults to false (public outbound enabled)

**Validation Logic** (`validateSubnet()` in `lib/componentValidators.ts`):

```typescript
function validateSubnet(data: Partial<SubnetComponent>, nodes: DiagramNode[]): ValidationResult {
  // 1. Name: required, must start with letter
  // 2. Address Prefix (IPv4): required, valid CIDR, minimum /29 (8 IPs)
  // 3. Address Prefix (IPv6): if provided, valid CIDR, minimum /64
  // 4. Parent VNet: required, must exist in diagram
  // 5. Address space fit: IPv4 subnet CIDR must fit in at least one VNet address space
  // 6. NSG: if provided, must exist (warning if not)
  // 7. Route Table: if provided, must exist (warning if not)
  // 8. NAT Gateway: if provided, must exist (warning if not)
  // 9. Delegation-PE conflict: if delegations present AND PE policies disabled, warn
  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}
```

Helper validators:
- `validateSubnetName()` — checks first character is letter
- `validateSubnetCIDRSize()` — enforces /29 minimum for IPv4, /64 minimum for IPv6
- `validateSubnetInVNet()` — checks CIDR fits within parent VNet address spaces

**Integration with Other Components:**

- **Parent VNet:** Subnets must declare `vnetId` parent; validated to exist and CIDR must fit
- **Workloads (VMs, VMSS, AKS):** Deployed in Subnets; contained via `subnetId` reference
- **Network Interfaces (NICs):** Deployed in Subnets; reference via `subnetId`
- **NSGs:** Can be associated to Subnets via `nsgId`; traffic filtered at subnet ingress/egress
- **UDRs:** Can be associated to Subnets via `routeTableId`; custom routing rules applied
- **Service Endpoints:** Enable private connectivity to Azure services without traversing internet
- **Delegations:** Grant services permission to deploy in subnet (e.g., App Service, Databricks)
- **VPN Gateway / Bastion:** Reference Subnets within VNet for hybrid connectivity and bastion host placement

**Auto-Layout Positioning:**

- **Layer:** `'vnet'` (VNet-managed layer)
- **Containment:** Subnets nested inside parent VNet via `parentNode` reference
- **Minimum Size:** `SUBNET_MIN_WIDTH` = 200px, `SUBNET_MIN_HEIGHT` = 80px
- **Reflow:** `reflowSubnetContainers()` packs workloads (VMs, NICs) inside Subnet bounds; `reflowVnetContainers()` then packs all Subnets inside VNet

**Key Invariants:**

- Subnet name must start with letter for Azure compatibility
- IPv4 address prefix must be /29 or smaller (minimum 8 IPs); /30, /31, /32 rejected
- IPv6 address prefix (if present) must be /64 or smaller (Azure standard)
- Subnet CIDR must fit within parent VNet's address spaces (or validation fails)
- Subnet name must be unique within parent VNet (enforced by diagram uniqueness rule)
- Delegated subnets cannot have private endpoint network policies disabled (Azure constraint; warning issued)
- Both IPv4 and IPv6 address prefixes are optional, but at least IPv4 is required
