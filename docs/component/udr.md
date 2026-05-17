## Azure User-Defined Routes (UDR) Component Specification

**Overview:**  
User-Defined Routes (UDRs) enable custom control over network traffic flow within and outside Azure virtual networks. A UDR is a collection of custom routing rules (routes) associated with one or more subnets. Each route specifies a destination address prefix and the next hop for traffic matching that destination. UDRs override Azure's default system routes using the longest prefix match algorithm—the most specific matching route determines the traffic destination. A UDR table can contain up to 400 routes (standard limit; expandable to 1,000 via Azure Virtual Network Manager). Each subnet can have at most one route table associated, enabling consistent routing policies across all resources in that subnet.

**Core Routing Concepts:**

- **Route Selection:** Azure uses longest prefix match; if multiple routes match a destination, the most specific prefix wins.
- **Route Priority:** User-defined routes (UDRs) > BGP routes > System routes
- **Subnet Association:** Each subnet has 0 or 1 route table. Routes apply to all traffic leaving the subnet toward IPs outside the local subnet.
- **Statefulness:** Once traffic is routed via a UDR, return traffic follows Azure's routing logic; no explicit return route needed.
- **BGP Route Propagation:** Virtual Network Gateways automatically add BGP routes to route tables unless `disableBgpRoutePropagation=true`.
- **Special Prefix:** Route with `0.0.0.0/0` overrides default Internet route; all unmatched traffic sent to specified next hop instead of Internet.

**Data Model** (`UdrComponent` and `UdrRoute` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Route table name (recommended pattern: "{purpose}-route-table") |
| `type` | `UDR` | ✓ | Enum value |
| `description` | string | — | Optional component description |
| `routes` | `UdrRoute[]` | ✓ | Array of routing rules (0-400 or 0-1000 routes) |
| `subnetIds` | string[] | — | Optional array of Subnet IDs to which this route table is associated (for reference) |
| `disableBgpRoutePropagation` | boolean | — | Default: `false`. When `true`, dynamic BGP routes from gateways are not added to this table |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |

**UdrRoute Interface:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier within UDR |
| `name` | string | ✓ | Route name (e.g., "to-firewall", "to-on-premises") |
| `addressPrefix` | string | ✓ | Destination address (CIDR block like `10.0.0.0/8` or service tag like `Storage`, `AppService`, `AzureCloud`) |
| `nextHopType` | enum | ✓ | See next hop types below |
| `nextHopResourceId` | string | — | Reference to resource node (e.g., NVA ID) when using VirtualAppliance |
| `nextHopIpAddress` | string | — | Private IP address for VirtualAppliance next hop (must have direct connectivity, no gateway in path) |

**Supported Next Hop Types:**

| Next Hop Type | Purpose | Requirements | Common Use Case |
|---|---|---|---|
| **Virtual Network Gateway** | Routes via VPN Gateway or ExpressRoute Gateway | Gateway must exist in VNet; traffic routed to on-premises | Hybrid connectivity (on-premises networks) |
| **Virtual Network (VnetLocal)** | Routes within the VNet | Auto-system-generated for VNet subnets | System-managed local routing |
| **Internet** | Routes to the internet | Destination reaches public internet | Default internet egress |
| **Virtual Appliance** | Routes via NVA/Firewall | Next hop IP or resource ID; NIC must have IP forwarding enabled | Traffic inspection, firewalling, service chaining |
| **None** | Drops traffic to destination | No additional configuration | Blocks specific address prefixes (security) |

**Address Prefix Format:**

- **CIDR Blocks:** Standard IPv4 notation (e.g., `0.0.0.0/0`, `10.0.0.0/8`, `10.1.2.3/32`)
- **Reserved Ranges:** RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and RFC 6598 (`100.64.0.0/10`) are valid
- **Service Tags:** Azure service identifiers (e.g., `Storage`, `AppService`, `AzureCloud`) instead of explicit IP ranges
- **Special Cases:**
  - `0.0.0.0/0` (default route): Matches all traffic not matched by more specific routes; overrides Azure default Internet route
  - Service tags match all IPs belonging to that Azure service in all regions or specified regions (e.g., `Storage.EastUS`)

**Azure Alignment & Constraints:**

| Constraint | Azure Requirement | Implementation |
|---|---|---|
| **Next Hop Types** | 5 types: VirtualNetworkGateway, VnetLocal, Internet, VirtualAppliance, None | ✓ All supported |
| **Address Prefix** | CIDR blocks OR service tags | ✓ CIDR validated; service tags recognized |
| **Route Count** | 400 standard; 1,000 with AVNM | ⚠ Warning if ≥ 400 |
| **Per-Subnet Limit** | Max 1 route table per subnet | ✓ Validated; warning if reassigning |
| **VirtualAppliance** | NIC must have IP Forwarding enabled; next hop IP must have direct connectivity | ⚠ Warning if IP forwarding not enabled; info if no direct gateway |
| **VirtualNetworkGateway** | Gateway must exist in VNet; UDR can override BGP routes | ⚠ Warning if gateway not found |
| **0.0.0.0/0 Special** | Overrides default route; requires caution | ⚠ Warning explaining behavior |
| **GatewaySubnet Exception** | BGP propagation MUST NOT be disabled on GatewaySubnet | ❌ Error if detected |
| **System Routes** | Cannot be created/deleted; can be overridden by UDRs | ℹ️ Informational |
| **BGP Propagation** | Automatic unless `disableBgpRoutePropagation=true` | ✓ Toggle available |
| **Routing Loop Prevention** | Virtual appliance in different subnet than routes through it | ⚠ Info hint in form |

**Form Fields & Validation:**

1. **Name** (required text)
   - Placeholder: `"my-route-table"`
   - **Validation:** Required, non-empty

2. **Disable BGP Route Propagation** (toggle switch)
   - Default: `false` (propagation enabled)
   - Label: "Disable BGP Route Propagation"
   - Helper text: "When enabled, dynamic routes from VPN/ExpressRoute gateways will not be added to this table"
   - **Validation:** Error if enabled on GatewaySubnet

3. **Routes Section** (array of routes)
   - Header: "Routes (N)" with "Add Route" button
   - Each route displays: Name, Address Prefix, Next Hop Type, (conditional) Next Hop Resource/IP, Delete button

   **Route Fields:**
   - **Name:** Text input, placeholder "route-name"
   - **Address Prefix:** Text input, placeholder "0.0.0.0/0 or Storage", helper text "CIDR or service tag"
     - Validated: Must be valid CIDR block OR recognized service tag
   - **Next Hop Type:** Dropdown with 5 options:
     - Virtual Network Gateway (hint: "Routes via VPN/ExpressRoute gateway (on-premises)")
     - Virtual Network (hint: "Routes within the VNet (system-managed)")
     - Internet (hint: "Routes to the internet (default for 0.0.0.0/0)")
     - Virtual Appliance (hint: "Routes via NVA or Firewall (requires IP forwarding)")
     - None (hint: "Drops traffic to this destination (blocks routing)")
   - **Next Hop Resource** (conditional, if VirtualAppliance):
     - Dropdown populated from Firewall and NVA nodes in diagram
     - Placeholder: "Select appliance"
   - **Next Hop IP Address** (conditional, if VirtualAppliance):
     - Text input, placeholder "10.x.x.x"
     - Validated: If provided, must be valid IPv4 address; warning if NIC lacks IP forwarding enabled

4. **Associated Subnets** (checkbox list)
   - Header: "Associated Subnets"
   - Checkboxes for each Subnet node in diagram
   - **Validation:** Warning if subnet already assigned to different route table

**Validation Logic** (`validateUdr()` in `lib/componentValidators.ts`):

```
For each route in routes:
  1. Validate addressPrefix: Must be valid CIDR (10.0.0.0/8) OR service tag (Storage, AppService, etc.)
  2. If addressPrefix === '0.0.0.0/0':
       - Warn: This is the default route; careful configuration needed
       - Error if nextHopType === 'VnetLocal' (invalid combination)
  3. If nextHopType === 'VirtualAppliance':
       - Must provide either nextHopResourceId OR nextHopIpAddress
       - If IP provided: Must be valid IPv4; warn if NIC doesn't have IP forwarding
       - Warn: Ensure appliance is in DIFFERENT subnet to prevent routing loops
  4. If nextHopType === 'VirtualNetworkGateway':
       - Warn if no VPN/ExpressRoute gateway found in diagram
  5. For each subnet in subnetIds:
       - Warn if subnet already has different route table assigned
       - Error if no subnet exists with that ID
  6. If disableBgpRoutePropagation === true on GatewaySubnet:
       - Error: "BGP propagation must NOT be disabled on GatewaySubnet"
  7. If routes.length > 400:
       - Warning: Approaching or exceeding standard limit
  Return: { isValid: no errors, errors: [array of FieldErrors] }
```

**Integration with Other Components:**

- **Subnets:** Route tables are associated to subnets via `routeTableId` field in SubnetComponent. Each subnet has 0 or 1 route table.
- **Virtual Appliances (NVA/Firewall):** When `nextHopType='VirtualAppliance'`, next hop IP should reference a NIC with `enableIpForwarding=true` (warning if not found).
- **VPN/ExpressRoute Gateway:** Routes can point to these gateways via `nextHopType='VirtualNetworkGateway'` for hybrid connectivity scenarios.
- **VNet Peering:** When `allowForwardedTraffic=true`, UDRs can be chained across peered VNets with appliances as intermediate hops.
- **Network Security Groups:** UDRs determine path; NSGs filter at destination (orthogonal control layers).

**Default Values (Form Initialization):**

When creating a new UDR via the UI, the form initializes with:

```typescript
{
  type: NetworkComponentType.UDR,
  name: '',
  description: '',
  tags: {},
  createdAt: new Date().toISOString(),
  id: `UDR-${Date.now()}`,
  routes: [],                        // Empty; user adds routes
  subnetIds: [],                     // Not associated initially
  disableBgpRoutePropagation: false, // BGP propagation enabled by default
}
```

When adding a new route:

```typescript
{
  id: `r-${Date.now()}`,
  name: 'new-route',
  addressPrefix: '0.0.0.0/0',        // Default catch-all
  nextHopType: 'Internet',           // Default to Internet
  nextHopResourceId: undefined,
  nextHopIpAddress: undefined,
}
```

**Auto-Layout Positioning:**

- **Layer:** `'vnet'` (VNet-managed policy layer, similar to NSGs and ASGs)
- **Containment:** UDRs are positioned outside VNets but referenced by associated subnets
- **Edges:** Association edges drawn from UDR to each associated Subnet for visual clarity
- **Grouping:** Multiple UDRs can exist in diagram; each is independent and non-overlapping

**Common Routing Scenarios:**

1. **Internet Egress via Firewall (0.0.0.0/0):**
   - Route: `0.0.0.0/0` → Virtual Appliance (Firewall IP) in hub VNet
   - Effect: All non-local traffic routed through firewall for inspection

2. **Spoke-to-Spoke via NVA (Hub-and-Spoke):**
   - Spoke routes to other spoke via hub NVA
   - Route: `10.1.0.0/16` → Virtual Appliance (hub NVA IP)
   - Requires peering with `allowForwardedTraffic=true`

3. **On-Premises Connectivity (Hybrid):**
   - Route: `192.168.0.0/16` (on-prem range) → Virtual Network Gateway
   - Effect: Packets destined for on-prem sent through VPN tunnel

4. **Traffic Blocking (Security):**
   - Route: `10.2.0.0/16` → None
   - Effect: Traffic to blocked range is dropped; not routed

5. **Service-Specific Routing:**
   - Route: `Storage` (service tag) → Virtual Appliance (inspection appliance IP)
   - Effect: All traffic to Azure Storage sent through appliance for policy enforcement

**Future Enhancements (Out of Scope):**

- **Per-Route BGP Control:** Per-route enable/disable of BGP propagation (currently table-level only)
- **Route State Tracking:** Display route state (Active, Invalid, Default) for audit trails
- **Effective Routes Computation:** Combine UDRs + BGP routes + system routes to show computed effective routing
- **AVNM Integration:** Azure Virtual Network Manager-style routing configurations with rule collections
- **IPv6 Support:** IPv6 address prefixes and dual-stack routing
- **Routing Loop Detection:** Algorithm to detect and warn about potential routing loops
- **Route Analytics:** Traffic statistics and throughput metrics per route

**Key Invariants:**

- UDR must have name (required)
- Each route must specify: addressPrefix, nextHopType
- VirtualAppliance next hop requires IP address or resource reference
- Each subnet can have at most 1 route table (enforced via SubnetComponent.routeTableId)
- BGP propagation must NOT be disabled on GatewaySubnet (error-level constraint)
- Service tags and CIDR blocks are both valid addressPrefix formats
- Route count must not exceed 1,000 (warning at 400+, error at 1,000+)
- No route can have both resource ID and IP address undefined (required if VirtualAppliance)
