## Azure Virtual Network Peering (VNet Peering) Component Specification

- ⚠️ Warning: HTTPS-only and TLS 1.2+ are recommended

**Overview:**  
Azure Virtual Network Peering enables seamless connectivity between two Azure Virtual Networks, allowing resources in both VNets to communicate directly using private bandwidth over Microsoft's backbone network without traversing the public internet. Peering can be configured within the same region (local peering) or across regions (global peering), with optional gateway transit for on-premises connectivity.

**Data Model** (`VnetPeeringComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | User-defined peering name (e.g., "vnet1-to-vnet2") |
| `type` | `VNET_PEERING` | ✓ | Enum value |
| `description` | string | — | Optional free-form text |
| `localVnetId` | string | ✓ | ID of the "local" (initiating) VNet node |
| `remoteVnetId` | string | ✓ | ID of the "remote" (target) VNet node |
| `allowVirtualNetworkAccess` | boolean | — | Default: `true`. Allows resources to directly communicate (RFC 1918 traffic forwarded) |
| `allowForwardedTraffic` | boolean | — | Default: `true`. Allows traffic forwarded by UDRs or network appliances (service chaining) |
| `allowGatewayTransit` | boolean | — | Default: `false`. **⚠ Mutually exclusive with `useRemoteGateways`**. Allows this VNet's VPN gateway to be used by remote VNets (hub-spoke pattern) |
| `useRemoteGateways` | boolean | — | Default: `false`. **⚠ Mutually exclusive with `allowGatewayTransit`**. Uses the remote VNet's VPN gateway for on-premises connectivity |
| `peeringState` | 'Initiated' \| 'Connected' \| 'Disconnected' | — | Default: `'Initiated'`. Informational; reflects peering lifecycle status |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |
| `parentId` | string | — | (Set to `localVnetId` for containment layout) |

**Azure Alignment & Constraints:**

| Constraint | Azure Requirement | Implementation |
|---|---|---|
| **Self-Peering Prohibited** | Cannot peer a VNet with itself | ✓ Error: "Cannot peer a VNet with itself" |
| **Address Space Overlap** | Should warn if peered VNets have overlapping address spaces (not ideal, but allowed in test scenarios) | ✓ Warning: "Address space overlap detected: X.X.X.X/Y overlaps with remote VNet's A.A.A.A/B" |
| **Gateway Transit Mutual Exclusivity** | `allowGatewayTransit` and `useRemoteGateways` cannot both be true | ✓ Error: "Cannot enable both 'Allow Gateway Transit' and 'Use Remote Gateways' on the same peering" |
| **VNet Existence** | Both local and remote VNets must exist | ✓ Error if either VNet missing from diagram |
| **Access Enable** | `allowVirtualNetworkAccess` enables direct RFC 1918 communication (default: enabled) | ✓ Default: `true`; toggle in form |
| **Forwarded Traffic** | `allowForwardedTraffic` enables UDR-based service chaining (default: enabled) | ✓ Default: `true`; toggle in form |
| **No Duplicate Peering** | Same pair of VNets should not have multiple active peerings | ⚠️ Not enforced in current implementation (diagram allows multiple peerings between same pair) |
| **Peering State** | Can be 'Initiated', 'Connected', or 'Disconnected' | ✓ Read-only field; user can set for simulation purposes |

**Form Fields & Validation:**

1. **Name** (required text)
   - Placeholder: `"my-peering"`
   - **Validation Rules:**
     - Required, non-empty
     - No specific format constraints in Azure (but suggested pattern: `"{localVnetName}-to-{remoteVnetName}"`)

2. **Local VNet** (required dropdown)
   - Options: Dynamically populated from all VNET nodes in diagram
   - **Validation Rules:**
     - Required; must select one VNet
     - ❌ Error if VNet does not exist in diagram
     - ❌ Error if same as Remote VNet (self-peering prohibited)

3. **Remote VNet** (required dropdown)
   - Options: Dynamically populated from all VNET nodes in diagram
   - **Validation Rules:**
     - Required; must select one VNet
     - ❌ Error if VNet does not exist in diagram
     - ❌ Error if same as Local VNet (self-peering prohibited)
     - ⚠️ Warning if Remote VNet address space overlaps with Local VNet

4. **Peering State** (read-only text field)
   - Display options: `"Initiated" | "Connected" | "Disconnected"`
   - Helper text: "Initiated | Connected | Disconnected"
   - **Behavior:** User can manually set state for simulation/testing purposes; reflects peering lifecycle

5. **Allow VNet Access** (toggle switch)
   - Default: `true`
   - Label: "Allow VNet Access"
   - Helper text: "Allows resources in peered VNets to directly communicate"
   - **Behavior:** When enabled (default), RFC 1918 traffic between peered VNets is forwarded by Azure fabric

6. **Allow Forwarded Traffic** (toggle switch)
   - Default: `true`
   - Label: "Allow Forwarded Traffic"
   - Helper text: "Allows traffic forwarded via UDRs or network appliances"
   - **Behavior:** When enabled (default), enables service chaining through UDRs that point to network appliances in peered VNets

7. **Allow Gateway Transit** (toggle switch)
   - Default: `false`
   - Label: "Allow Gateway Transit"
   - Helper text (when off): "Allows this VNet's gateway to be used by remote VNets (hub pattern)"
   - Warning text (when on): "⚠ Cannot be enabled together with 'Use Remote Gateways'"
   - **Behavior:** When enabled, this VNet's VPN gateway or ExpressRoute gateway can be used by peered VNets for on-premises connectivity (hub-and-spoke topology). **Mutually exclusive with `useRemoteGateways`.**

8. **Use Remote Gateways** (toggle switch)
   - Default: `false`
   - Label: "Use Remote Gateways"
   - Helper text (when off): "Uses the remote VNet's gateway for on-premises connectivity"
   - Warning text (when on): "⚠ Cannot be enabled together with 'Allow Gateway Transit'"
   - **Behavior:** When enabled, this VNet uses the remote VNet's VPN gateway or ExpressRoute gateway to reach on-premises networks. **Mutually exclusive with `allowGatewayTransit`.**
   - **Hub-Spoke Pattern:** In a hub-and-spoke topology, the hub VNet enables `allowGatewayTransit=true`, while each spoke VNet enables `useRemoteGateways=true` to share the hub's gateway.

**Validation Logic** (`validateVnetPeering()` in `lib/componentValidators.ts`):

```typescript
function validateVnetPeering(data: Partial<VnetPeeringComponent>, nodes: DiagramNode[]): ValidationResult {
  const errors: FieldError[] = []

  // 1. Both VNet IDs required and must exist
  if (!data.localVnetId) addError(errors, 'localVnetId', 'Local VNet is required')
  else if (!nodeExists(data.localVnetId, nodes)) addError(errors, 'localVnetId', 'Local VNet does not exist in diagram')

  if (!data.remoteVnetId) addError(errors, 'remoteVnetId', 'Remote VNet is required')
  else if (!nodeExists(data.remoteVnetId, nodes)) addError(errors, 'remoteVnetId', 'Remote VNet does not exist in diagram')

  // 2. Cannot peer with self
  if (data.localVnetId && data.remoteVnetId && data.localVnetId === data.remoteVnetId) {
    addError(errors, 'remoteVnetId', 'Cannot peer a VNet with itself')
  }

  // 3. Gateway transit mutual exclusivity: both cannot be true
  if (data.allowGatewayTransit && data.useRemoteGateways) {
    addError(errors, 'allowGatewayTransit', 
      'Cannot enable both "Allow Gateway Transit" and "Use Remote Gateways" on the same peering. Enable only one option.')
  }

  // 4. Address space overlap warning (non-blocking)
  if (data.localVnetId && data.remoteVnetId && data.localVnetId !== data.remoteVnetId) {
    const localVnet = nodes.find(n => n.id === data.localVnetId)?.data
    const remoteVnet = nodes.find(n => n.id === data.remoteVnetId)?.data
    if (localVnet?.addressSpace && remoteVnet?.addressSpace) {
      for (const localCidr of localVnet.addressSpace) {
        for (const remoteCidr of remoteVnet.addressSpace) {
          if (cidrOverlaps(localCidr, remoteCidr)) {
            addError(errors, 'remoteVnetId', 
              `Address space overlap detected: ${localCidr} overlaps with remote VNet's ${remoteCidr}. Peered VNets should have non-overlapping address spaces.`, 
              'warning')
            break
          }
        }
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}
```

**Default Values (Form Initialization):**

When creating a new VNet Peering via the UI, the form initializes with:

```typescript
{
  type: NetworkComponentType.VNET_PEERING,
  name: '',
  description: '',
  tags: {},
  createdAt: new Date().toISOString(),
  id: `VNET_PEERING-${Date.now()}`,
  allowVirtualNetworkAccess: true,      // Azure default: enabled
  allowForwardedTraffic: true,          // Azure default: enabled for service chaining
  allowGatewayTransit: false,           // Opt-in for hub-spoke pattern
  useRemoteGateways: false,             // Opt-in for spoke VNets
  peeringState: 'Initiated',            // Initial state
}
```

**Integration with Other Components:**

- **VNets:** Both `localVnetId` and `remoteVnetId` must reference valid VNET nodes in diagram. Validation fails if either is missing.
- **UDRs / Service Chaining:** When `allowForwardedTraffic=true`, UDRs can point to network appliances in peered VNets as next hop IP addresses, enabling service chaining across peering.
- **VPN Gateway / ExpressRoute:** Gateway transit enables spoke VNets to reach on-premises networks through the hub's gateway:
  - Hub VNet: `allowGatewayTransit=true` (allows gateway sharing)
  - Spoke VNets: `useRemoteGateways=true` (uses hub's gateway)
- **Network Interfaces / VMs:** NICs in peered VNets can communicate directly via the peering (no additional configuration needed if `allowVirtualNetworkAccess=true`).
- **NSGs / Security:** NSGs in peered VNets can be configured to allow or deny traffic between peered address spaces via inbound/outbound rules.

**Auto-Layout Positioning:**

- **Layer:** `'vnet'` (VNet-managed layer)
- **Containment:** Peering node is contained within `localVnetId` (uses `parentNode = localVnetId` in layout).
- **Fallback Positioning:** If peering node loses parentage (edge case), `reflowVnetPeeringNodes()` positions the peering visually midway between the two peered VNets, horizontally centered between VNet right edge and remote VNet left edge.
- **Visual Indicator:** Displayed as a connection icon/badge showing peering state (`Initiated`, `Connected`, `Disconnected`)

**Peering Patterns:**

1. **Full Mesh (All-to-All):**
   - Multiple peerings connect every VNet to every other VNet
   - Each pair has bidirectional peering (local-to-remote and remote-to-local)
   - Example: 3 VNets → 6 peering connections (3 × 2)

2. **Hub-and-Spoke:**
   - Central hub VNet peers with multiple spoke VNets
   - Hub: `allowGatewayTransit=true`, `useRemoteGateways=false`
   - Spokes: `allowGatewayTransit=false`, `useRemoteGateways=true`
   - Enables all spokes to share the hub's VPN gateway for on-premises connectivity

3. **Transitive Connectivity (via Service Chaining):**
   - VNet-A peers with VNet-B; VNet-B peers with VNet-C
   - VNet-A traffic to VNet-C requires UDRs pointing to appliances in VNet-B
   - Enabled by `allowForwardedTraffic=true` on both peerings

**Key Invariants:**

- Peering is directional at the data level (local/remote distinction) but bidirectional at the functional level (traffic flows both ways once established)
- Cannot peer a VNet with itself
- Cannot have both `allowGatewayTransit` and `useRemoteGateways` enabled simultaneously (Azure constraint)
- Address space overlaps are discouraged but allowed in simulator for testing purposes (warning issued)
- Peering state is informational and user-managed in simulator (not auto-connected like in actual Azure)
