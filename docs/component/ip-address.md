## Azure Public IP Address Component Specification

**Overview:**
Public IP addresses enable inbound and outbound internet connectivity for Azure resources. Public IPs are resources assigned exclusively to VMs, Load Balancers, App Gateways, Bastion hosts, Firewalls, VPN Gateways, and other internet-facing services. Azure assigns the actual public IP address from available pools; users cannot specify exact IPs. Public IPs can be dissociated and reassociated without data loss.

**CRITICAL:** Basic SKU was **retired September 30, 2025**. Only Standard (v1) and Standard_v2 are supported.

**SKU Tiers:**

| Feature | Standard (v1) | Standard_v2 |
|---------|---------------|------------|
| **Allocation Methods** | Static, Dynamic | Static, Dynamic |
| **Zone Support** | Non-zonal, zonal, or zone-redundant (optional) | Always zone-redundant (mandatory) |
| **Tier Support** | Regional, Global | Regional only (Global support coming) |
| **Routing Preference** | ✓ Internet / Microsoft | ✗ Not supported |
| **Idle Timeout** | Configurable 4-30 min | Configurable 4-30 min |
| **Use Cases** | Traditional deployments, cross-region LBs, cost optimization | New deployments, reliability-focused, zone-redundant |
| **Azure Load Balancer** | ✓ All LB SKUs | ✓ Standard LB, Gateway LB |
| **Application Gateway** | ✗ Not supported | ✓ v2 SKU only |

**Data Model** (`IpAddressComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | User-friendly name (1-80 chars) |
| `type` | enum | ✓ | Always `NetworkComponentType.IP_ADDRESS` |
| `ipAddress` | string | — | Optional documentation field; Azure assigns actual IP from pool |
| `allocationMethod` | 'Static' \| 'Dynamic' | ✓ | Static: persists across stop/start; Dynamic: may change |
| `sku` | 'Standard' \| 'Standard_v2' | ✓ | **Basic retired Sep 30, 2025**; use Standard for all new deployments |
| `tier` | 'Regional' \| 'Global' | — | Regional (default) for single region; Global for cross-region LB backends |
| `ipVersion` | 'IPv4' \| 'IPv6' | ✓ | IPv4 (default) or IPv6 addressing |
| `dnsLabel` | string | — | Optional; maps to `{label}.{region}.cloudapp.azure.com` (must be unique per region) |
| `associatedTo` | string | — | Metadata field tracking which resource owns this IP (informational) |
| `availabilityZones` | string[] | — | Zone IDs ('1', '2', '3'); Standard_v2 always zone-redundant; Standard optional |
| `routingPreference` | 'Internet' \| 'Microsoft' | — | Standard only; not supported on Standard_v2; routes traffic for cost/latency optimization |

**Form Behavior** (`IpAddressForm.vue`):

1. **Name Field** (required text)
   - User-friendly identifier for the IP address

2. **SKU Selector** (required; Standard or Standard_v2)
   - ✅ Standard (v1): Regional deployments, optional zone redundancy, routing preference support
   - ✅ Standard_v2: Zone-redundant by default, modern deployments (recommended)
   - ❌ Basic: Retired Sep 30, 2025; error if selected
   - Helper text: "Basic SKU was retired September 30, 2025. Use Standard for all new deployments."

3. **Tier Selector** (optional; Regional or Global)
   - Regional (default): Single-region deployments, most common
   - Global: Cross-region load balancer backends (Standard v1 only currently)
   - Helper text: "Global tier supports cross-region load balancer configurations."
   - ⚠️ Warning if Global + Standard_v2 selected (future support not yet available)

4. **Availability Zones** (comma-separated text input; optional)
   - Input: Comma-separated zone IDs (e.g., "1,2,3")
   - Computed property: `availabilityZonesStr` ↔ `availabilityZones: string[]`
   - **Standard v1**: Zones optional; if provided, zones are metadata (may not guarantee zone-redundancy depending on deployment)
   - **Standard_v2**: Always zone-redundant by default; zones field shows metadata only
   - Validation: 
     - ⚠️ Warning if fewer than 2 zones (not zone-redundant; lower reliability)
     - ❌ Error if zone ID not in '1', '2', '3'
   - Helper text: "Comma-separated zone IDs for zone redundancy"

5. **Routing Preference** (dropdown; shown only for Standard v1)
   - Options: Default (undefined), Internet, Microsoft
   - **Internet**: Minimizes time on Microsoft network; reduces egress transfer costs
   - **Microsoft**: Optimizes for network performance (Microsoft backbone priority)
   - ✗ Disabled if Standard_v2 selected (not supported)
   - Helper text: "Optimize routing path for cost/latency (Standard only)"

6. **Allocation Method** (required; Static or Dynamic)
   - **Static**: IP address persists across resource stop/start; use for DNS/firewall rules
   - **Dynamic**: IP may change upon stop/deallocate; lower cost
   - ⚠️ Warning if Dynamic selected (potential IP change impact)

7. **IP Version** (required; IPv4 or IPv6)
   - IPv4 (default): Standard 32-bit addressing
   - IPv6: 128-bit addressing (preview in many scenarios)

8. **IP Address** (optional documentation field)
   - Placeholder: "20.x.x.x (Azure assigns from pool)"
   - ⚠️ Warning: "Azure assigns the public IP from available pool; this field is for documentation only"
   - Validation: Format check if provided (IPv4 or IPv6 per `ipVersion` setting)

9. **DNS Label** (optional)
   - Placeholder: "my-app"
   - Maps to: `{label}.{region}.cloudapp.azure.com` (must be unique per region per subscription)
   - Helper text: "Maps to {label}.{region}.cloudapp.azure.com"
   - Validation: DNS name format check (alphanumeric, hyphens; 1-63 chars)

**Validation Logic** (`validateIpAddress()` in `lib/componentValidators.ts`):

1. **SKU Validation**
   - ❌ Error: Must be 'Standard' or 'Standard_v2'; Basic is retired
   - ❌ Error if SKU not recognized

2. **Allocation Method Validation**
   - ✓ Valid: Static or Dynamic
   - ⚠️ Warning: Dynamic allocation may change IP upon stop/start

3. **Tier Validation**
   - ✓ Valid: Regional or Global
   - ⚠️ Warning if Global + Standard_v2 (future support)

4. **Availability Zones Validation**
   - ❌ Error: Zone ID not in '1', '2', '3'
   - ⚠️ Warning: Fewer than 2 zones (not zone-redundant)
   - ⚠️ Warning: Standard v1 with zones (zones are optional metadata; may not guarantee zone-redundancy)
   - ⚠️ Warning: Standard_v2 without explicit zones (always zone-redundant by default)

5. **Routing Preference Validation**
   - ❌ Error: Routing Preference set on Standard_v2 (not supported)
   - ✓ Valid: Internet or Microsoft on Standard v1

6. **IP Address Format Validation**
   - If provided, validate format per `ipVersion` (IPv4 or IPv6)
   - ⚠️ Warning: Cannot specify exact public IP; Azure assigns from pool

7. **DNS Label Validation**
   - If provided, validate DNS name format (1-63 chars; alphanumeric + hyphens)

8. **Integration Validation** (checks if referenced by other components)
   - Scan LoadBalancer, AppGateway, Bastion, Firewall, NVA nodes
   - ⚠️ Warning if IP referenced by public LB/AppGateway/Bastion but SKU mismatches requirements (must be Standard with Static allocation)

**Azure Alignment Checklist:**

- ✓ **SKU Support**: Standard and Standard_v2 only; Basic retired Sep 30, 2025
- ✓ **Allocation Methods**: Static (persists) and Dynamic (may change)
- ✓ **Zone Redundancy**: Standard_v2 always zone-redundant; Standard optional
- ✓ **Tier Support**: Regional (single-region) and Global (cross-region)
- ✓ **Routing Preference**: Internet (cost optimization) and Microsoft (performance) for Standard only
- ✓ **IPv4/IPv6**: Dual-stack support (separate IPs per version)
- ✓ **DNS Label**: Maps to FQDN with region; unique per subscription per region
- ✓ **No IP Address Specification**: Azure assigns; user cannot specify exact IP
- ✓ **Integration**: LoadBalancer, AppGateway, Bastion, Firewall, VPN Gateway, NVA support
- ✓ **Layer Classification**: Always `'public-facing'` in diagram (all public IPs are internet-edge)

**Key Integration Points:**

- **Load Balancer**: Public LBs require `publicIpId` field pointing to Standard/Standard_v2 IP with Static allocation (enforced in LoadBalancer validation)
- **Application Gateway**: v2 instances require public frontend IP (Standard or Standard_v2 with Static allocation)
- **Bastion**: Basic/Standard/Premium SKUs require Standard_v2 IP for public IP field (or Premium private-only deployment without IP)
- **Firewall**: Standard/Premium modes require at least one public IP for NAT (optional in Forced Tunnel mode); up to 250 public IPs supported
- **VPN Gateway**: Public IPs support both site-to-site and point-to-site scenarios
- **NVA**: Optional public IP for internet-facing appliances
- **Node Display**: Shows `"Public IP - {SKU} ({AllocationMethod})"` and appends `" - Global"` if tier is Global

**Do NOT:**

- Support Basic SKU (retired Sep 30, 2025); force migration to Standard
- Allow allocation method or SKU changes without validation
- Skip tier/zone validation (zone redundancy affects reliability architecture)
- Allow routing preference on Standard_v2 (not supported by Azure)
- Skip integration validation for referenced components (LB/AppGateway require specific SKU+allocation combinations)
- Model private IPs as IP_ADDRESS component (private IPs remain NIC properties per Azure architecture)

**Future Enhancements (Out of Scope):**

- Domain Name Label Scope (preview feature; reduces DNS dangling name reuse risk)
- IPv4 Address Prefix support (for scaling VM deployments)
- Dual-stack explicit management (IPv4 and IPv6 as unified dual-stack IPs)
- Cross-subscription IP mobility (Complex governance; not typically modeled in design tools)
