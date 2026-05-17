## Azure Bastion Component Specification

**Overview:**  
Azure Bastion is a fully managed Platform-as-a-Service (PaaS) that provides secure and seamless RDP/SSH connectivity to Azure virtual machines directly over TLS (port 443) from the Azure portal or via the native SSH/RDP client already installed on your local computer. Bastion is deployed directly within your virtual network and supports all VMs in that network using private IP addresses, eliminating the need for public IPs, agents, or special client software on target VMs. Azure Bastion offers four SKU tiers with varying features and deployment models: Developer (free, shared), Basic (dedicated, fixed capacity), Standard (dedicated, scalable, advanced features), and Premium (all Standard features plus session recording and private-only deployment).

**Four SKU Tiers:**

| Feature | Developer | Basic | Standard | Premium |
|---------|-----------|-------|----------|---------|
| **Deployment** | Shared infrastructure | Dedicated host | Dedicated host | Dedicated host |
| **Requires AzureBastionSubnet** | No | Yes (/26+) | Yes (/26+) | Yes (/26+) |
| **Requires Public IP** | No | Yes | Yes | Yes (except private-only) |
| **Fixed Instance Count** | N/A | 2 | Configurable 2-50 | Configurable 2-50 |
| **Max Concurrent Sessions** | 1 VM at a time | 40 RDP + 80 SSH | 1,000 RDP + 2,000 SSH | 1,000 RDP + 2,000 SSH |
| **Concurrent VM Connections** | 1 at a time | Multiple VMs | Multiple VMs | Multiple VMs |
| **Native Client Support** | No | No | Yes | Yes |
| **Shareable Links** | No | No | Yes | Yes |
| **Custom Inbound Ports** | No | No | Yes | Yes |
| **IP-Based Connections** | No | No | Yes | Yes |
| **File Transfer** | No | No | Yes | Yes |
| **Session Recording** | No | No | No | Yes |
| **Private-Only Deployment** | No | No | No | Yes |
| **Virtual Network Peering** | No | Yes | Yes | Yes |
| **Availability Zones** | Limited regions | Yes | Yes | Yes |
| **Cost** | Free | Hourly charge | Hourly charge | Hourly charge |

**Data Model** (`BastionComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Bastion host name (1-80 chars) |
| `type` | enum | ✓ | Always `NetworkComponentType.BASTION` |
| `description` | string | — | Optional component description |
| `sku` | 'Developer' \| 'Basic' \| 'Standard' \| 'Premium' | ✓ | SKU tier determining features and deployment model |
| `subnetId` | string | conditional | Required for Basic+; N/A for Developer. Must reference AzureBastionSubnet (/26+) |
| `publicIpId` | string | conditional | Required for Basic/Standard/Premium (unless `isPrivateOnly: true`); N/A for Developer |
| `scaleUnits` | number | — | Fixed 2 for Basic; configurable 2-50 for Standard/Premium; N/A for Developer |
| `enableTunneling` | boolean | — | Standard+ feature; enables SSH/RDP via native client tunneling |
| `enableIpConnect` | boolean | — | Standard+ feature; enables IP-based connections to VMs |
| `enableShareableLink` | boolean | — | Standard+ feature; enables shareable links without portal access |
| `customInboundPorts` | number[] | — | Standard+ feature; custom RDP/SSH ports (default 3389, 22) |
| `isPrivateOnly` | boolean | — | Premium-only; private-only deployment without public IP requirement |
| `enableSessionRecording` | boolean | — | Premium-only; enables session recording for compliance requirements |
| `availabilityZones` | string[] | — | Optional; zone identifiers (1, 2, 3); support varies by region (preview) |
| `createdAt` | ISO string | ✓ | Component creation timestamp |
| `tags` | object | — | Optional key-value tags for resource grouping |

**Form Behavior** (`BastionForm.vue`):

1. **Name Field** (all SKUs)
   - Required text input
   - Placeholder: `"my-bastion"`

2. **SKU Selector** (all SKUs)
   - Radio/button selector: Developer, Basic, Standard, Premium
   - Developer shows informational message about shared infrastructure

3. **Developer SKU Behavior**
   - Shows informational box: "Shared infrastructure for dev/test only. No dedicated subnet or public IP required. Supports one VM connection at a time."
   - Subnet and Public IP fields hidden
   - Scale units, advanced features, and Premium features hidden

4. **Basic SKU Behavior**
   - Subnet selector required (with helper text emphasizing "AzureBastionSubnet" /26+ requirement)
   - Public IP selector required (with helper text: "Must be Standard SKU with Static allocation")
   - Scale Units field shown as read-only (fixed at 2)
   - Helper text: "Basic SKU has fixed capacity of 2 instances (40 RDP / 80 SSH concurrent sessions)"
   - Advanced features (tunneling, IP Connect, etc.) hidden

5. **Standard SKU Behavior**
   - Subnet selector required
   - Public IP selector required
   - Scale Units field editable (2-50); helper text explains capacity scaling
   - Toggles shown: Enable Tunneling, Enable IP Connect, Enable Shareable Links
   - Custom Inbound Ports field (comma-separated text input)
   - Availability Zones field (comma-separated text input)
   - Premium features hidden

6. **Premium SKU Behavior**
   - All Standard SKU fields present
   - Private-Only toggle shown; helper text: "No public IP required; requires ExpressRoute or VPN for connectivity"
   - When Private-Only enabled: Public IP field conditionally hidden
   - Session Recording toggle shown; helper text: "Premium feature for compliance and audit trails"
   - All custom ports, tunneling, and shareable links available
   - Availability Zones field

7. **Description Field** (all SKUs)
   - Optional textarea (2 rows)

**Validation Rules:**

- **SKU Validation:** Must be one of Developer, Basic, Standard, or Premium

- **Developer SKU Constraints:**
  - Subnet must not be set (warning if present)
  - Public IP must not be set (warning if present)
  - Scale units should not be set (warning if present)
  - Advanced and Premium features should not be set (warning if present)

- **Basic SKU Constraints:**
  - Subnet required; must exist in diagram (error if missing/not found)
  - Subnet naming: Should be named "AzureBastionSubnet" (warning if not)
  - Subnet sizing: Must be /26 or larger (error if /27 or smaller)
  - Public IP required; must exist in diagram (error if missing/not found)
  - Public IP SKU: Should be Standard (warning if Basic)
  - Public IP Allocation: Should be Static (warning if Dynamic)
  - Scale units: Fixed at 2 (warning if set to other value)
  - Advanced and Premium features should not be set (warning if present)

- **Standard SKU Constraints:**
  - All Basic constraints apply (subnet, public IP required)
  - Scale units: If set, must be 2-50 (warning if outside range)
  - Private-only must not be enabled (error if set)
  - Session Recording must not be enabled (error if set)
  - Advanced features (tunneling, IP Connect, shareable links, custom ports) are allowed

- **Premium SKU Constraints:**
  - All Standard constraints apply
  - If `isPrivateOnly: true`:
    - Public IP must not be set (error if present)
  - If `isPrivateOnly: false`:
    - Public IP required (same as Standard)
  - Session Recording is allowed (no storage account validation in v1)
  - Custom ports, tunneling, and shareable links fully supported
  - Availability Zones: If set, should contain 1, 2, or 3 (warning for other values)

- **Custom Inbound Ports (Standard+):**
  - Must be comma-separated numbers
  - Each port must be 1-65535 (error if outside range)
  - Empty/whitespace: valid (means default ports 3389, 22 only)

- **Availability Zones (all dedicated SKUs):**
  - Must be comma-separated identifiers (e.g., "1, 2, 3")
  - Recommended zones: 1, 2, 3 (warning for other values)
  - Optional (warning only, not error, if not set)

**Deployment & Integration:**

- **VNet Context:** Bastion serves all VMs in its VNet using private IPs; VNet determines region and network boundary
- **Subnet (Basic+):** Must be dedicated AzureBastionSubnet with /26+ size; cannot share resources
- **Public IP (except private-only):** Must be Standard SKU with Static allocation to ensure stable endpoint for users
- **Scaling:** Basic fixed at 2 instances; Standard/Premium scale 2-50 for throughput and concurrent session capacity
- **Native Client Support (Standard+):** Enables SSH/RDP client integration with Bastion for custom ports and file transfer
- **Private-Only (Premium):** Allows end-to-end private connectivity via ExpressRoute/VPN without public IP exposure
- **Session Recording (Premium):** Records sessions to storage account for compliance and audit trails
- **Availability Zones:** Enables cross-AZ resilience; support limited to select regions (preview feature)

**Azure Alignment:**

- ✓ All four SKUs (Developer, Basic, Standard, Premium) with correct feature parity
- ✓ Developer SKU shared infrastructure model (though v1 doesn't enforce quota limits)
- ✓ AzureBastionSubnet requirement and /26+ sizing enforced
- ✓ Public IP SKU (Standard) and allocation method (Static) requirements
- ✓ Fixed 2 instances for Basic; configurable 2-50 for Standard/Premium
- ✓ Concurrent session limits (40 RDP + 80 SSH per instance)
- ✓ Standard+ advanced features (tunneling, IP Connect, shareable links, custom ports)
- ✓ Premium-only features (session recording, private-only deployment)
- ✓ Virtual Network peering support (all dedicated SKUs)
- ✓ Availability Zones support for cross-AZ resilience (preview for select regions)
- ✓ TLS connectivity over port 443 (implicit in model)

**Future Enhancements (Out of Scope):**

- **Session Recording Storage Account:** Configuration of storage account, SAS URLs, and session playback UI
- **Kerberos Authentication:** Azure AD integration for single sign-on and credential delegation
- **Per-Subscription Quotas:** Developer SKU quota limits (3 per subscription) not enforced
- **VNet Peering Bastion Access:** Cross-VNet connectivity via peered networks (model supports conceptually, UI not implemented)
- **Multi-Region Setup:** Replication and failover across Azure regions
- **Native Client Advanced Settings:** Configure native client certificate pinning, proxy settings, MFA
- **Custom DNS & NSG Rules:** DNS suffixes, granular NSG rules for Bastion management traffic
- **Metrics & Monitoring:** Connection logs, throughput graphs, rule hit counters
- **Session Sharing & Multi-User:** Concurrent user sessions to same VM with shared control

**Key Invariants:**

- Bastion must reference exactly one subnet (for Basic+; N/A for Developer)
- Subnet must be named AzureBastionSubnet and sized /26 or larger (for Basic+)
- Public IP required for Basic/Standard/Premium (unless Premium with `isPrivateOnly: true`)
- Public IP must have Standard SKU and Static allocation (except private-only mode)
- Scale Units fixed at 2 for Basic; configurable 2-50 for Standard/Premium
- Developer SKU does not support subnet, public IP, or advanced features
- Advanced features (tunneling, IP Connect, shareable links, custom ports) are Standard+ only
- Session recording and private-only deployment are Premium-only features
- Private-only deployment (Premium) disables public IP requirement (mutually exclusive)
- Availability Zones are optional; support limited to select regions (preview)
