## Azure VPN Gateway Component Specification

**Overview:**  
Azure VPN Gateway is a specialized virtual network gateway used to send encrypted traffic between an Azure virtual network and on-premises locations (site-to-site), remote users (point-to-site), or other Azure virtual networks (VNet-to-VNet). The simulator models the gateway configuration layer, including SKU selection, redundancy mode, BGP settings, and subnet placement.

**Data Model** (`VpnGatewayComponent` in `types/network.ts`):

```typescript
export interface VpnGatewayComponent extends NetworkComponent {
  type: NetworkComponentType.VPN_GATEWAY
  sku: 'Basic' | 'VpnGw1' | 'VpnGw2' | 'VpnGw3' | 'VpnGw4' | 'VpnGw5' | 'VpnGw1AZ' | 'VpnGw2AZ' | 'VpnGw3AZ' | 'VpnGw4AZ' | 'VpnGw5AZ'
  vpnType: 'PolicyBased' | 'RouteBased'
  vpnGatewayGeneration?: 'Generation1' | 'Generation2' // Optional; inferred from SKU if omitted
  enableBgp?: boolean
  activeActive?: boolean
  availabilityZones?: string[] // e.g., ['1', '2', '3'] for zone-redundant deployment
  bgpSettings?: {
    asn?: number // Border Gateway Protocol ASN
    bgpPeeringAddress?: string // BGP peering address
    bgpPeeringAddressForIPv6?: string // BGP peering address for IPv6
  }
  gatewayIpId?: string // Reference to Public IP Address component
  subnetId?: string // Reference to GatewaySubnet (required special subnet)
}
```

**Azure Best Practices Alignment:**

| Constraint | Implementation | Validation |
|---|---|---|
| **SKU Selection** | Two generations (Gen1, Gen2) with optional AZ (Availability Zone) variants. Gen2 recommended for new deployments. | Form organizes SKU options by generation; Gen2 highlighted as current standard. |
| **Non-AZ Deprecation** | Non-AZ SKUs (VpnGw1-5) retiring Sep 30, 2026. AZ variants (VpnGw*AZ) recommended for production. | Form warns: "Non-AZ SKU retiring Sep 30, 2026. Prefer VpnGw*AZ SKUs." Network Summary shows deprecation finding. |
| **Basic SKU No SLA** | Basic SKU lacks formal SLA and has lower throughput (100 Mbps max). Use VpnGw1 or higher for production. | Form warns: "Basic SKU has no SLA; use VpnGw1 or higher for production." Network Summary shows error. |
| **GatewaySubnet Naming** | Azure requires a dedicated Subnet named exactly "GatewaySubnet" with minimum /27 CIDR. | Validator enforces: if subnetId references a subnet not named "GatewaySubnet", error raised. Form caption and helper text guide user. |
| **Active-Active & BGP** | Active-active (redundant) gateways should enable BGP for dynamic routing. Each instance in active-active pair requires unique BGP APIPA address. | If `activeActive=true` but no BGP ASN configured, warning issued. Form's BGP Settings section appears when `enableBgp=true`. |
| **Public IP SKU** | Gateway requires a Public IP address; Standard SKU recommended. Basic Public IP addresses deprecated (migration Jan-Apr 2026). | Form caption notes: "Standard SKU recommended (Basic SKU deprecating)." Network Summary warns if gateway references Basic public IP. |
| **Zone Redundancy** | AZ-capable SKUs (VpnGw*AZ) support zone-redundant deployment across 3 zones for 99.99% availability. | Availability Zones field visible only when AZ-capable SKU selected (e.g., VpnGw1AZ). Multi-select allows zones 1, 2, 3. |
| **VPN Type Support** | RouteBased (modern, supports S2S, P2S, VNet-to-VNet) vs PolicyBased (legacy, S2S only). RouteBased preferred. | Form offers both; no enforcement (for legacy compatibility). |

**Form Fields & Validation:**

1. **Name** (required text)
   - Placeholder: `"my-vpn-gw"`
   - **Validation Rule:** Required, non-empty; follows resource naming rules

2. **SKU** (required dropdown)
   - Options organized in two groups:
     - **Generation 1:** Basic, VpnGw1, VpnGw2, VpnGw3, VpnGw1AZ, VpnGw2AZ, VpnGw3AZ
     - **Generation 2:** VpnGw2, VpnGw3, VpnGw4, VpnGw5, VpnGw2AZ, VpnGw3AZ, VpnGw4AZ, VpnGw5AZ
   - **Deprecation Notice** (warning):
     - If non-AZ SKU selected: "Non-AZ SKU retiring Sep 30, 2026. Prefer VpnGw1AZ-5AZ for new deployments."
     - If Basic SKU selected: "Basic SKU has no SLA. Use VpnGw1 or higher for production."
   - **Validation Rule:** Must select one SKU; cannot be empty

3. **VPN Type** (required toggle: RouteBased / PolicyBased)
   - **Validation Rule:** Must select one type

4. **Gateway Generation** (informational, read-only)
   - Shows inferred generation from SKU (e.g., "Generation 1" for Basic/VpnGw1-3, "Generation 2" for VpnGw2-5)
   - Automatically updated when SKU changes

5. **Enable BGP** (optional boolean toggle)
   - When enabled, BGP Settings section appears below
   - Used for dynamic routing (RouteBased gateways only)

6. **Active-Active Mode** (optional boolean toggle)
   - Enables redundant gateway instances in different availability zones
   - **Validation Warning:** If enabled but BGP ASN not configured, warn: "BGP recommended for active-active mode"

7. **Availability Zones** (optional multi-select)
   - **Visibility:** Only shown when AZ-capable SKU selected (SKU ends with 'AZ')
   - Options: Zone 1, Zone 2, Zone 3
   - Allows selection of multiple zones for zone-redundant deployment
   - **Validation Rule:** Optional; if left empty on AZ SKU, gateway deploys in single zone (zone choice made by Azure)

8. **BGP Settings** (optional, collapsible when `enableBgp=true`)
   - **BGP ASN** (optional number): Autonomous System Number (e.g., 65000)
   - **BGP Peering Address** (optional text): IPv4 address for BGP (e.g., 10.0.1.30)
   - **BGP Peering Address (IPv6)** (optional text): IPv6 address for BGP (dual-stack support)
   - **Visibility:** Section only visible when `enableBgp=true`
   - **Validation Rule:** If provided, BGP addresses must be valid IP addresses; no enforcement of CIDR containment (informational)

9. **Subnet** (required dropdown)
   - Placeholder: `"GatewaySubnet"`
   - Hint: "Must be a subnet named GatewaySubnet (/27 or larger recommended)."
   - **Validation Rules:**
     - Required, must reference a subnet node
     - Referenced subnet must have name exactly "GatewaySubnet" (error if not; validated in `validateVpnGateway()`)
     - If referenced subnet does not exist, error: "Referenced subnet does not exist"

10. **Gateway Public IP** (optional dropdown)
    - Placeholder: `"Select Public IP"`
    - Hint: "Standard SKU recommended (Basic SKU deprecating)."
    - **Validation Rules:**
      - Optional; if left empty, gateway has no public IP (informational only in simulator)
      - If provided, must reference a valid Public IP Address node
      - If referenced Public IP uses Basic SKU, Network Summary warning issued

**Validation Logic** (`validateVpnGateway()` in `lib/componentValidators.ts`):

```typescript
function validateVpnGateway(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet required
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Gateway subnet is required')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  } else {
    // Validate GatewaySubnet name
    const subnet = nodes.find((n: any) => n.id === data.subnetId)?.data
    if (subnet && subnet.name !== 'GatewaySubnet') {
      addError(errors, 'subnetId', `Azure requires subnet name 'GatewaySubnet', but got '${subnet.name}'`)
    }
  }

  // Basic SKU warning (no SLA)
  if (data.sku === 'Basic') {
    addError(errors, 'sku', 'Basic SKU has no SLA; use VpnGw1 or higher for production', 'warning')
  }

  // Non-AZ SKU deprecation warning (Sep 30, 2026 retirement)
  const nonAzSkus = ['VpnGw1', 'VpnGw2', 'VpnGw3', 'VpnGw4', 'VpnGw5']
  if (nonAzSkus.includes(data.sku)) {
    addError(errors, 'sku', 'Non-AZ SKU retiring Sep 30, 2026; prefer VpnGw1AZ-5AZ for new deployments', 'warning')
  }

  // Active-Active + BGP consistency check
  if (data.activeActive && !data.bgpSettings?.asn) {
    addError(errors, 'bgpSettings', 'BGP recommended for active-active mode; configure BGP ASN for high availability', 'warning')
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}
```

**Integration with Other Components:**

- **Subnets:** VPN Gateway requires a GatewaySubnet (named exactly "GatewaySubnet" per Azure requirement). This special subnet is dedicated to gateway resources; validated by name match in validator.
- **Public IP Addresses:** Gateway typically references one public IP (`gatewayIpId`); active-active gateways may have multiple public IPs (currently simulator models single reference). Public IP SKU deprecation (Basic → Standard) tracked in Network Summary.
- **Virtual Networks:** Gateway is implicitly scoped to the VNet containing its GatewaySubnet; no direct VNet reference needed (inferred via subnet parent).
- **UDR (User-Defined Routes):** Routes can specify `nextHopType: 'VirtualNetworkGateway'` to direct traffic through the VPN gateway toward on-premises (simulated via test paths).
- **VNet Peering:** VNet Peering supports gateway transit flags (`allowGatewayTransit`, `useRemoteGateways`) to enable spoke VNets to reach on-premises via hub's VPN gateway (hub-and-spoke topology). Gateway is not directly referenced in peering but enables the transit behavior.

**Auto-Layout Positioning:**

- **Layer:** Public-facing root nodes (placed above policy nodes)
- **Public-Facing Status:** VPN Gateway is always considered public-facing (connects to external networks or Azure regions)
- **Placement:** Positioned in top lane(s) by `reflowPublicFacingNodes()` during auto-layout
- **Containment:** VPN Gateway is not contained by VNets (appears outside, alongside other public-facing resources like Bastion, Public IPs, etc.)

**Key Invariants:**

- GatewaySubnet name is immutable and must be exactly "GatewaySubnet" (Azure requirement)
- SKU selection implicitly determines gateway generation (Gen1 vs Gen2); `vpnGatewayGeneration` is optional (auto-inferred if omitted)
- Active-Active mode is only valid with AZ-capable SKUs (VpnGw*AZ); non-AZ SKUs implicitly active-passive
- Basic SKU lacks SLA; should not be used in production (warning enforced via Network Summary)
- Non-AZ SKUs retiring Sep 30, 2026; customers should upgrade to AZ variants or newer SKUs
- BGP settings are informational; simulator does not execute BGP protocol or validate APIPA address assignments

**Network Summary Findings** (Right Panel diagnostics):

1. **Error:** "VPN Gateway uses Basic SKU which has no SLA. Upgrade to VpnGw1 or higher."
   - Triggered when: `sku === 'Basic'`
   - Action: User should select a higher-tier SKU

2. **Warning:** "VPN Gateway uses non-AZ SKU retiring Sep 30, 2026. Plan upgrade to VpnGw*AZ."
   - Triggered when: SKU is VpnGw1-5 (non-AZ variant)
   - Action: Plan migration to AZ-enabled SKUs before retirement

3. **Warning:** "VPN Gateway uses Basic public IP. Requires migration to Standard SKU (Jan-Apr 2026)."
   - Triggered when: `gatewayIpId` references a Public IP with Basic SKU
   - Action: Migrate public IP to Standard SKU as part of Azure's Basic IP deprecation timeline
