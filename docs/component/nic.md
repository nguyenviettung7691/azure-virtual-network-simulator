## Azure Network Interface Card (NIC) Component Specification

**Overview:**  
A Network Interface Card (NIC) is the primary mechanism by which Azure VMs and other compute resources connect to subnets within a virtual network. NICs enable VMs to communicate with other VMs, internet, and on-premises resources through assigned IP addresses, security filtering (NSGs), and application security groups. Each NIC must be attached to exactly one subnet and can be optionally attached to a VM. Azure VMs require at least one NIC (primary) and can support multiple NICs depending on VM size.

**Data Model** (`NetworkICComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | NIC name (must be unique within resource group; suggested pattern: `"{vmName}-nic-{index}"`) |
| `type` | `NETWORK_IC` | ✓ | Enum value |
| `description` | string | — | Optional free-form text |
| `subnetId` | string | ✓ | Parent subnet reference (determines VNet membership) |
| `privateIpAddress` | string | — | Private IPv4 address assigned to NIC (must fit within subnet CIDR if static) |
| `privateIpAllocationMethod` | 'Static' \| 'Dynamic' | ✓ | Default: `'Dynamic'`. Azure DHCP auto-assigns from subnet if Dynamic; user-specified if Static |
| `publicIpId` | string | — | Optional reference to Public IP Address component (associated to NIC's primary IP config) |
| `nsgId` | string | — | Optional Network Security Group reference (filtered at NIC level, overrides subnet NSG) |
| `asgIds` | string[] | — | Optional array of Application Security Group IDs (same VNet, same location) |
| `dnsServers` | string[] | — | Optional custom DNS server IPs; if omitted, inherits from parent VNet or uses Azure default (168.63.129.16) |
| `enableIpForwarding` | boolean | — | Default: `false`. When true, NIC can receive and forward traffic not destined to its own IP (required for NVAs/routers) |
| `enableAcceleratedNetworking` | boolean | — | Default: `false`. When true, uses SR-IOV for lower latency and reduced jitter (requires compatible VM size and image) |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |
| `parentId` | string | — | (Inherited from NetworkComponent; not used for NICs) |

**Azure Alignment & Constraints:**

| Constraint | Azure Requirement | Implementation |
|---|---|---|
| **Subnet Attachment Required** | NIC must belong to exactly one subnet | ✓ `subnetId` required; validation enforces existence |
| **Private IP Validation** | Static private IP must fit within subnet's CIDR; Dynamic IP auto-assigned from subnet range | ✓ Validation: if Static, IP must be in subnet address space |
| **Subnet CIDR Fit** | Private IP (if Static) must not conflict with reserved addresses (network, broadcast, gateway) | ✓ Warning: Reserved IPs are network address, gateway address (.1), and broadcast (.255) |
| **Public IP Association** | Public IP (if assigned) is associated to NIC's primary IP configuration | ✓ Via `publicIpId` reference to IP_ADDRESS component |
| **NSG Scope** | NSG at NIC level overrides subnet-level NSG for that NIC's traffic | ✓ `nsgId` field; validated to exist |
| **ASG Scope** | NICs can belong to multiple ASGs within same VNet and location | ✓ `asgIds[]` array; validated against diagram ASG nodes |
| **DNS Inheritance** | If custom DNS not set on NIC, inherits from VNet (or Azure default) | ✓ Optional `dnsServers[]`; if empty, inherits from parent VNet |
| **IP Forwarding** | Requires application support (e.g., NVA, routing appliance) to actually forward traffic | ✓ Toggle field; informational in simulator (forwarding not simulated) |
| **Accelerated Networking** | Requires compatible VM size (e.g., D/E series) and supported OS image; not all regions/SKUs support | ✓ Toggle field; informational in simulator (performance not simulated) |
| **MAC Address** | Assigned by Azure only after NIC attaches to VM and VM starts; read-only; changes only if private IP changes | ℹ️ Not modeled in simulator (MAC assignment not simulated) |
| **VM Attachment** | NIC can be attached to at most one VM at a time; VM must have at least one NIC | ✓ Inferred via bidirectional references: `VmComponent.nicIds[]` and reverse lookup |
| **No Duplicate NICs on VM** | Cannot attach same NIC to a single VM multiple times (NIC appears once in VM's nicIds array) | ✓ Enforced by diagram structure and validation |

**Form Fields & Validation:**

1. **Name** (required text)
   - Placeholder: `"my-nic"` or `"vm1-nic-0"`
   - **Validation Rules:**
     - Required, non-empty
     - Suggested pattern: start with letter, alphanumeric + hyphens (Azure naming convention)

2. **Component Type** (read-only dropdown)
   - Options: Network Interface | Service Endpoint | Private Endpoint
   - Default: Network Interface
   - **Behavior:** Multiplexed form shows different field sets based on type selection
   - **Constraint:** Changing type between NIC/Service Endpoint/Private Endpoint triggers form reflow

3. **Subnet** (required dropdown, NIC-only)
   - Options: Dynamically populated from all SUBNET nodes in diagram
   - **Validation Rules:**
     - Required; must select one subnet
     - ❌ Error if subnet does not exist in diagram
     - ⚠️ Warning if no subnet options available (no subnets in diagram)

4. **Private IP Address** (optional text, NIC-only)
   - Placeholder: `"10.0.1.10"`
   - **Visibility:** Shown regardless of allocation method; text field accepts any IP-like input
   - **Validation Rules:**
     - If allocation method is Static:
       - ❌ Error if not in valid IPv4 format (basic regex: `^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$`)
       - ❌ Error if IP does not fit within selected subnet's CIDR range
       - ⚠️ Warning if IP conflicts with reserved addresses (network address, gateway .1, broadcast .255)
     - If allocation method is Dynamic:
       - Optional (user can leave blank or ignore)
       - If provided, treated as informational (Azure will auto-assign on attachment)

5. **Allocation Method** (required toggle, NIC-only)
   - Options: Dynamic | Static
   - Default: Dynamic
   - **Behavior:** Toggles between Dynamic (Azure DHCP) and Static (user-specified IP)
   - **Helper text:** "Dynamic: Auto-assigned from subnet range. Static: User-specified IP (must be valid and within subnet CIDR)"

6. **Public IP Address** (optional dropdown, NIC-only)
   - Options: Dynamically populated from all IP_ADDRESS nodes in diagram (or "None")
   - **Validation Rules:**
     - Optional (can be empty / "None")
     - ⚠️ Warning if selected Public IP does not exist in diagram

7. **Network Security Group (NSG)** (optional dropdown, NIC-only)
   - Options: Dynamically populated from all NSG nodes in diagram (or "None")
   - **Validation Rules:**
     - Optional (can be empty / "None")
     - ⚠️ Warning if selected NSG does not exist in diagram
   - **NSG Evaluation & Precedence:** See § 2.3 Azure Network Security Group (NSG) Component Specification for complete NSG rules model. **Inbound traffic:** Subnet NSG evaluated first (if attached to subnet), then NIC NSG (if attached to NIC). **Outbound traffic:** NIC NSG evaluated first (if attached), then Subnet NSG. If both exist and both have matching rules, the most restrictive (Deny) rule applies. NIC-level NSG can override subnet-level NSG by explicitly allowing traffic that subnet NSG denies.

8. **Application Security Groups (ASGs)** (optional multi-select checkboxes, NIC-only)
   - Options: Dynamically populated from all ASG nodes in diagram
   - **Visibility:** If no ASGs exist in diagram, show helper text: "No ASG components in the diagram yet."
   - **Validation Rules:**
     - Optional (can select zero or more ASGs)
     - ⚠️ Warning if selected ASG does not exist in diagram
     - **Constraint:** All ASGs must be in same VNet as the NIC (enforced by subnet membership)

9. **DNS Servers** (optional comma-separated text, NIC-only)
   - Placeholder: `"8.8.8.8, 8.8.4.4"` or `"1.1.1.1"`
   - **Visibility:** Optional field; if empty, NIC inherits DNS from parent VNet or uses Azure default
   - **Validation Rules:**
     - Optional (can be empty)
     - If provided, each entry must be valid IPv4 format
     - ⚠️ Warning if invalid IP format detected
     - **Helper text:** "Leave empty to inherit from VNet DNS settings. Custom entries override VNet settings."

10. **IP Forwarding** (optional toggle, NIC-only)
    - Default: `false`
    - **Label:** "Enable IP Forwarding"
    - **Helper text:** "Allow this NIC to receive traffic not destined to its IP address. Required for NVAs/routers."
    - **Behavior:** Informational in simulator; actual IP forwarding requires application support

11. **Accelerated Networking** (optional toggle, NIC-only)
    - Default: `false`
    - **Label:** "Enable Accelerated Networking"
    - **Helper text:** "Use SR-IOV for reduced latency. Requires compatible VM size and OS image."
    - **Behavior:** Informational in simulator; actual performance benefit not modeled

**Validation Logic** (`validateNetworkIC()` in `lib/componentValidators.ts`):

```typescript
function validateNetworkIC(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // NIC-specific validation
  if (data.type === NetworkComponentType.NETWORK_IC) {
    // 1. Subnet must exist
    if (!data.subnetId) {
      addError(errors, 'subnetId', 'Subnet is required')
    } else if (!nodeExists(data.subnetId, nodes)) {
      addError(errors, 'subnetId', 'Referenced subnet does not exist', 'warning')
    } else {
      // 2. Private IP validation (if Static)
      if (data.privateIpAllocationMethod === 'Static' && data.privateIpAddress) {
        const subnet = nodes.find(n => n.id === data.subnetId)?.data
        if (subnet?.addressPrefix) {
          if (!isValidIpAddress(data.privateIpAddress)) {
            addError(errors, 'privateIpAddress', 'Private IP must be a valid IPv4 address format')
          } else if (!ipFitsInCidr(data.privateIpAddress, subnet.addressPrefix)) {
            addError(errors, 'privateIpAddress', 
              `Private IP ${data.privateIpAddress} does not fit within subnet CIDR ${subnet.addressPrefix}`)
          } else if (isReservedAddress(data.privateIpAddress, subnet.addressPrefix)) {
            addError(errors, 'privateIpAddress',
              `Private IP ${data.privateIpAddress} conflicts with reserved subnet addresses (network, gateway, broadcast)`, 'warning')
          }
        }
      }
    }

    // 3. Public IP validation (if present)
    if (data.publicIpId && !nodeExists(data.publicIpId, nodes)) {
      addError(errors, 'publicIpId', 'Referenced public IP does not exist', 'warning')
    }

    // 4. NSG validation (if present)
    if (data.nsgId && !nodeExists(data.nsgId, nodes)) {
      addError(errors, 'nsgId', 'Referenced NSG does not exist', 'warning')
    }

    // 5. ASG validation (if present)
    if (data.asgIds && Array.isArray(data.asgIds)) {
      for (const asgId of data.asgIds) {
        if (!nodeExists(asgId, nodes)) {
          addError(errors, 'asgIds', `Referenced ASG ${asgId} does not exist`, 'warning')
        }
      }
    }

    // 6. DNS servers validation (if present)
    if (data.dnsServers && Array.isArray(data.dnsServers)) {
      for (const dnsIp of data.dnsServers) {
        if (!isValidIpAddress(dnsIp)) {
          addError(errors, 'dnsServers', `DNS server "${dnsIp}" is not a valid IPv4 address`, 'warning')
        }
      }
    }
  }

  // Service Endpoint validation
  if (data.type === NetworkComponentType.SERVICE_ENDPOINT) {
    // ... existing Service Endpoint logic
  }

  // Private Endpoint validation
  if (data.type === NetworkComponentType.PRIVATE_ENDPOINT) {
    // ... existing Private Endpoint logic
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}
```

**Default Values (Form Initialization):**

When creating a new NIC via the UI, the form initializes with:

```typescript
{
  type: NetworkComponentType.NETWORK_IC,
  name: '',
  description: '',
  tags: {},
  createdAt: new Date().toISOString(),
  id: `NIC-${Date.now()}`,
  subnetId: undefined,                        // User selects
  privateIpAddress: undefined,                // Auto-assigned if Dynamic
  privateIpAllocationMethod: 'Dynamic',       // Azure default
  publicIpId: undefined,                      // Optional
  nsgId: undefined,                           // Optional
  asgIds: [],                                 // Optional
  dnsServers: [],                             // Inherits from VNet
  enableIpForwarding: false,                  // Disabled by default (requires app support)
  enableAcceleratedNetworking: false,         // Disabled by default (requires compatible VM)
}
```

**Integration with Other Components:**

- **Parent Subnet:** NIC's `subnetId` determines subnet membership and VNet association. Validation enforces subnet existence. Subnet's NSG (if present) provides default security filtering unless overridden by NIC-level NSG.
- **Virtual Machines:** VMs reference NICs via `nicIds[]` array. Each NIC can be attached to at most one VM. VM must have at least one NIC (primary). VM membership determines NIC's effective vnet/subnet for outbound traffic routing.
- **Public IP Address:** If NIC has `publicIpId`, the public IP component provides outbound/inbound NAT capability. Public IP can be dissociated from NIC without affecting private IP.
- **NSG (Network Security Group):** NIC-level NSG (if `nsgId` set) provides inbound/outbound filtering that overrides subnet-level NSG for this NIC specifically. Both subnet and NIC NSGs apply (most restrictive rule wins).
- **ASG (Application Security Group):** NICs can belong to multiple ASGs within same VNet for rule-based security group management. ASGs simplify large-scale rule creation (e.g., "all web servers in ASG-web").
- **VNet Peering:** NICs in peered VNets can communicate directly if `allowVirtualNetworkAccess=true` on peering (no additional configuration needed).
- **Service Endpoints / Private Endpoints:** NICs can access Azure services through Service Endpoints (subnet-level) or Private Endpoints (private link to service).

**Auto-Layout Positioning:**

- **Layer:** `'subnet'` (within parent subnet, which is within VNet)
- **Containment:** NICs are contained within parent subnet via `subnetId` reference (parent subnet uses `reflowSubnetContainers()` to pack NICs and workloads)
- **Horizontal Layout:** NICs are laid out horizontally beside workloads (VMs, VMSS, AKS) to prevent vertical stacking and maintain readability
- **Attachment to VM:** When a NIC is attached to a VM (both exist in diagram), positioning is managed by the VM's layout logic; the NIC visually associates with its parent VM node
- **Unattached NICs:** NICs without VM attachment are positioned loosely within their parent subnet

**Future Enhancements (Not Currently Implemented):**

The following features align with Azure's actual NIC model but are scoped out of the current simulator:

1. **Multiple IP Configurations (Secondary IPs):** Azure supports primary + secondary IP configurations per NIC. Each config has independent public IP (optional) and inbound NAT rules. Simulator currently models single IP; multi-config support would enable complex scenarios like multiple hostnames on one NIC.
2. **IPv6 Support:** NICs can support IPv6 alongside IPv4 (dual-stack) if subnet has IPv6 address space. Simulator is IPv4-only; IPv6 addition requires subnet-level IPv6 CIDR validation and secondary IP config support.
3. **MAC Address Tracking:** Azure assigns MAC address after NIC attaches to running VM (read-only). Simulator could model MAC as read-only field derived from attachment state.
4. **Primary/Secondary NIC Designation:** VMs with multiple NICs have one primary (outbound traffic default) and secondary (optional) NICs. Simulator treats all NICs equally; designating primary/secondary would refine outbound traffic routing in tests.
5. **Effective NSG Rules:** Azure combines subnet NSG + NIC NSG + system defaults into "effective rules". Simulator could show effective rule computation in audit findings.
6. **Effective Routes:** Similar to effective NSG rules, simulator could compute effective routes by combining UDRs + peering routes + BGP routes for connectivity analysis.

**Key Invariants:**

- NIC must belong to exactly one subnet (and thereby one VNet)
- If static private IP specified, must fit within subnet's CIDR and avoid reserved addresses
- NIC can be attached to at most one VM (bidirectional reference via `VmComponent.nicIds[]`)
- NSG at NIC level overrides subnet NSG (most specific wins)
- ASGs must be within same VNet as the NIC
- Public IP is optional and can be changed/removed without affecting NIC
- DNS servers (if custom) override VNet DNS for this NIC
- IP Forwarding and Accelerated Networking are informational settings (behavior not simulated)
