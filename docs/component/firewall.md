## Azure Firewall Component Specification

**Overview:**  
Azure Firewall is a managed, cloud-native, fully stateful network firewall security service that provides centralized protection for Azure resources and hybrid networks. It offers Layer 3-7 filtering, threat intelligence, and advanced features varying by SKU tier. Azure Firewall is stateful: if outbound traffic is allowed via a rule, the return inbound traffic is automatically allowed without explicit rules. The firewall processes rules in deterministic order: Threat Intelligence → DNAT → Network → Application → Infrastructure rule collection, with parent policies taking precedence over child policies.

**Three SKU Tiers:**

| Feature | Basic | Standard | Premium |
|---------|-------|----------|---------|
| **Max Throughput** | 250 Mbps | 30 Gbps | 100 Gbps |
| **Fat Flow Support** | N/A | 1 Gbps | 10 Gbps |
| **Threat Intelligence** | Alert only | Alert & Deny | Alert & Deny |
| **DNS Proxy + Custom DNS** | ✗ | ✓ | ✓ |
| **Network-level FQDN Filtering** | ✗ | ✓ | ✓ |
| **Web Content Filtering** | ✗ | ✓ | ✓ |
| **Forced Tunneling** | ✗ | ✓ | ✓ |
| **IDPS (Intrusion Detection/Prevention)** | ✗ | ✗ | ✓ |
| **TLS Inspection (Outbound & East-West)** | ✗ | ✗ | ✓ |
| **URL Filtering (Full Path)** | ✗ | ✗ | ✓ |
| **Scale Units (1-100)** | ✗ | ✗ | ✓ |
| **PCI DSS Compliance** | ✗ | ✗ | ✓ |
| **Public IPs** | Up to 250 | Up to 250 | Up to 250 |
| **Built-in HA & AZs** | ✓ | ✓ | ✓ |

**Rule Processing Order (Microsoft Documentation):**

1. **Threat Intelligence** (processed first, regardless of priority)
   - Blocks/alerts on known malicious IPs and domains before any other rules
   - In Deny mode: drops traffic silently
   - In Alert mode: logs and allows (if other rules permit)

2. **DNAT Rules** (priority 100 to 65,000; lowest number = highest priority)
   - Translates destination IP/port on inbound Internet traffic
   - Allows traffic to be redirected to private IPs on VNet

3. **Network Rules** (priority 100 to 65,000)
   - Filters L3-L4 traffic based on IP/protocol/port
   - Terminating: if match found, subsequent rules not evaluated

4. **Application Rules** (priority 100 to 65,000)
   - Filters L7 traffic (HTTP/S, SQL, FQDN-based)
   - Evaluated only if no Network rule matched
   - For HTTPS: uses SNI (Server Name Indication) header

5. **Infrastructure Rule Collection** (built-in, implicit)
   - Allows platform FQDNs for compute, managed disks, Azure Diagnostics
   - Can be overridden by deny-all application rule processed last

6. **Final Deny** (implicit)
   - Any traffic not explicitly allowed is denied

**Data Model** (`FirewallComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | User-friendly name (1-80 chars) |
| `type` | enum | ✓ | Always `NetworkComponentType.FIREWALL` |
| `description` | string | — | Optional component description |
| `sku` | 'Basic' \| 'Standard' \| 'Premium' | ✓ | Determines available features and throughput |
| `vnetId` | string | ✓ | Parent VNet (Firewall must belong to a VNet) |
| `publicIpIds` | string[] | conditional | Required for standard mode (at least 1); optional for Forced Tunnel mode |
| `firewallPolicies` | string[] | — | Reference names for organizational tracking (not rule definitions) |
| `threatIntelMode` | 'Alert' \| 'Deny' \| 'Off' | — | Threat intelligence behavior; Basic SKU locked to 'Alert' |
| `subnetId` | string | — | Optional subnet reference; used for Forced Tunnel mode or AKS attachments |
| `availabilityZones` | string[] | — | AZ names or numbers (e.g., ['1', '2', '3']); improves resilience |
| `forcedTunneling` | boolean | — | Standard/Premium only; routes all Internet traffic to designated next hop |
| `dnsProxyEnabled` | boolean | — | Standard/Premium only; enables DNS proxy and custom DNS support |
| `customDnsServers` | string[] | — | IPv4 addresses (e.g., ['8.8.8.8', '1.1.1.1']); requires `dnsProxyEnabled: true` |
| `idpsMode` | 'Off' \| 'Alert' \| 'AlertDeny' | — | Premium only; signature-based intrusion detection (67,000+ rules) |
| `tlsInspectionEnabled` | boolean | — | Premium only; decrypt/inspect/re-encrypt HTTPS for threat detection |
| `scaleUnits` | number | — | Premium only; range 1-100; scales performance proportionally |
| `createdAt` | ISO string | ✓ | Component creation timestamp |
| `tags` | object | — | Optional key-value tags for resource grouping |
| `parentId` | string | — | (Inherited from NetworkComponent; not typically used for Firewall) |

**Form Behavior** (`FirewallForm.vue`):

1. **Basic Fields**
   - Name field (required text)
   - SKU selector (Basic / Standard / Premium radio buttons) with descriptions
   - VNet selector (required dropdown, filtered to VNet components)
   - Description textarea (optional)

2. **SKU-Conditional Rendering**
   - **Basic SKU Only:** Shows threat intelligence locked to "Alert" mode
   - **Standard/Premium:** 
     - Toggle: "Enable Forced Tunneling" (optional; routes data plane traffic through designated hop)
     - Subnet selector (optional; used with Forced Tunneling or gateway attachments)
     - Toggle: "Enable DNS Proxy" + multi-input for custom DNS servers
   - **Premium Only:**
     - IDPS Mode selector (Off / Alert / AlertDeny)
     - Toggle: "Enable TLS Inspection" (outbound & east-west)
     - Scale Units spinner (1-100)

3. **Public IP Configuration**
   - Checkbox list showing all IP_ADDRESS components in diagram
   - Badge displaying current count and max (250)
   - Visual warning when count ≥ 220
   - Status: Required for standard mode, optional for Forced Tunnel mode

4. **Availability Zones**
   - Text input accepting comma-separated zone identifiers (e.g., "1,2,3")
   - Optional for all SKUs; improves fault tolerance

5. **Threat Intelligence**
   - Selector: Alert / Deny / Off (or Alert-only for Basic)
   - Applies to known malicious IPs/domains before other rules

6. **DNS Configuration** (Standard/Premium only)
   - Toggle: Enable DNS Proxy
   - If enabled: text input for comma-separated IPv4 addresses
   - Helper text: "Leave empty to use Azure DNS"

7. **Firewall Policies** (Organizational Reference)
   - Comma-separated text input
   - Stores policy names for audit/tracking (not rule definitions)

**Validation Rules:**

- **VNet Reference:** Must exist in diagram; required for all Firewalls
- **SKU Validation:** Must be one of Basic, Standard, or Premium
- **Threat Intelligence Mode:**
  - Basic SKU: Restricted to Alert mode; other values trigger warning
  - Standard/Premium: All modes (Alert, Deny, Off) supported
- **Public IP Handling:**
  - Standard mode: At least one public IP required (error if missing)
  - Forced Tunnel mode: Public IPs optional (management NIC handles platform traffic)
  - Max 250 public IPs across all modes; warning when ≥ 220
- **Forced Tunneling:**
  - Premium/Standard only; error if enabled on Basic SKU
  - Subnet reference: Validated to exist if provided (warning if missing)
- **DNS Proxy & Custom DNS:**
  - Premium/Standard only; error if enabled on Basic SKU
  - Custom DNS servers: Must be valid IPv4 addresses; warning if invalid format
- **IDPS Mode:**
  - Premium only; error if non-'Off' mode on Basic/Standard
  - Supported modes: Off, Alert, AlertDeny
- **TLS Inspection:**
  - Premium only; error if enabled on Basic/Standard
- **Scale Units:**
  - Premium only; error if configured on Basic/Standard
  - Range 1-100; error if outside range

**Deployment & Integration:**

- **VNet Parent:** Firewall must reference a valid VNet; VNet determines region and isolation boundary
- **Subnet (Optional):** If `forcedTunneling: true`, optional subnet can be used for management NIC (data plane traffic is separate)
- **Public IPs:** Associated via edges in diagram for visual clarity; standard deployments require at least one
- **Availability Zones:** Specified as array of zone identifiers; can span zones for cross-AZ resilience
- **Policy Association:** Firewall Policies field stores reference names; detailed rule structures (DNAT/Network/Application rules) are not modeled in v1 (deferred to v2)

**Azure Alignment:**

- ✓ All three SKUs (Basic, Standard, Premium) with correct throughput limits and feature availability
- ✓ Stateful traffic handling with implicit return traffic support
- ✓ Rule processing order: Threat Intelligence → DNAT → Network → Application → Infrastructure
- ✓ Threat Intelligence limited to Alert mode for Basic SKU
- ✓ DNS proxy and custom DNS configurable on Standard/Premium
- ✓ Forced Tunneling support (Standard/Premium) with optional subnet attachment
- ✓ IDPS signature-based detection (Premium only) with Alert/AlertDeny modes
- ✓ TLS inspection (outbound and east-west) for Premium SKU
- ✓ URL filtering with scale units (Premium only)
- ✓ Public IP limit (max 250) with capacity tracking
- ✓ Availability Zones support for cross-AZ resilience
- ✓ Built-in HA (no external load balancer required)

**Future Enhancements (Out of Scope):**

- **Detailed Rule Structures:** DNAT rules, Network rules, Application rules, and rule collection groups (complex; deferred to v2)
- **Parent Policy Inheritance:** Multi-level policy hierarchies with inheritance rules
- **Rule Analytics & Metrics:** Traffic analysis, throughput graphs, rule hit counters
- **Web Category Customization:** Category overrides and custom category definitions
- **IDPS Customization:** User-defined signature rules (beyond built-in 67,000)
- **Certificate Management:** Customer-provided CA certificates for TLS inspection
- **Private IP Range Configuration:** IDPS private IP ranges for traffic direction determination
- **Multi-Subscription Management:** Azure Firewall Manager integration for centralized multi-tenant setup

**Key Invariants:**

- Firewall must belong to exactly one VNet (vnetId required)
- At least one public IP required for standard deployments (unless Forced Tunneling enabled)
- Threat Intelligence mode is always Alert for Basic SKU; never Deny
- Forced Tunneling is Standard/Premium only; not available on Basic
- DNS Proxy and Custom DNS require Standard/Premium SKU
- IDPS and TLS Inspection are Premium-only features
- Scale Units only configurable on Premium SKU (range 1-100)
- Public IP count cannot exceed 250 (enforced, warning at 220+)
- Custom DNS servers must be valid IPv4 format (IPv6 not supported in v1)
- Availability Zones are optional; can improve resilience across failure domains
