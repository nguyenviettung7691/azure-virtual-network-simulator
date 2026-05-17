## Azure Network Security Group (NSG) Component Specification

**Overview:**  
A Network Security Group (NSG) is a fundamental Azure security construct that contains security rules to filter inbound and outbound network traffic to Azure resources. NSGs can be associated with subnets (filtering traffic for all resources in the subnet) and with individual network interface cards (NICs, filtering traffic for a specific resource). NSGs are stateful: if outbound traffic is allowed via a rule, the return inbound traffic is automatically allowed without an explicit rule. Azure creates default rules in every NSG that cannot be deleted but can be overridden.

**Data Model** (`NsgComponent` and `NsgRule` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | NSG name (recommended pattern: "{purpose}-nsg") |
| `type` | `NSG` | ✓ | Enum value |
| `description` | string | — | Optional free-form text |
| `securityRules` | `NsgRule[]` | ✓ | Array of security rules (0 or more custom rules) |
| `subnetIds` | string[] | — | Optional array of Subnet IDs to which this NSG is associated (for reference only) |
| `nicIds` | string[] | — | Optional array of NIC IDs to which this NSG is associated (for reference only) |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |

**NsgRule Interface:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier within NSG |
| `name` | string | ✓ | Rule name (1-80 chars, must start with letter/number, end with letter/number/underscore) |
| `priority` | number | ✓ | 100-4096 (lower = evaluated first; gaps recommended: 100, 200, 300) |
| `direction` | 'Inbound' \| 'Outbound' | ✓ | Traffic direction |
| `access` | 'Allow' \| 'Deny' | ✓ | Allow or block traffic |
| `protocol` | 'Tcp' \| 'Udp' \| 'Icmp' \| '*' | ✓ | Protocol; '*' = all protocols |
| `sourceAddressPrefix` | string | ✓ | Source address (IP/CIDR, service tag, or '*' depending on `sourceType`) |
| `sourcePortRange` | string | ✓ | Source port (single: '80', range: '1024-65535', list: '80,443', or '*') |
| `destinationAddressPrefix` | string | ✓ | Destination address (IP/CIDR, service tag, or '*' depending on `destinationType`) |
| `destinationPortRange` | string | ✓ | Destination port (single, range, list, or '*') |
| `description` | string | — | Rule description (max 140 chars) |
| `sourceType` | 'IpCidr' \| 'ServiceTag' \| 'Asg' | — | Source type selector (default: 'IpCidr' for backward compatibility) |
| `destinationType` | 'IpCidr' \| 'ServiceTag' \| 'Asg' | — | Destination type selector (default: 'IpCidr' for backward compatibility) |
| `sourceAsgId` | string | — | ASG ID reference when `sourceType='Asg'` |
| `destinationAsgId` | string | — | ASG ID reference when `destinationType='Asg'` |

**Azure Alignment & Constraints:**

| Constraint | Azure Requirement | Implementation |
|---|---|---|
| **Priority Range** | 100-4096; lower = higher priority | ✓ Enforced; unique per NSG |
| **Direction** | Inbound or Outbound (separate rule sets) | ✓ Separate rule evaluation path per direction |
| **Access** | Allow or Deny (not both in same rule) | ✓ Single choice per rule |
| **Protocol** | TCP, UDP, ICMP, or Any (ESP/AH deferred) | ✓ Four options; ESP/AH future enhancement |
| **Source/Destination** | IP/CIDR, service tag, ASG, or wildcard | ✓ Three types: IP/CIDR, ServiceTag, ASG |
| **Port Range** | Single, range, comma-separated, or * | ✓ Supports all formats |
| **Rule Name** | 1-80 chars, letter/number start, letter/number/underscore end | ✓ Validated |
| **Description** | Max 140 chars | ✓ Validated |
| **Default Rules** | Azure creates inbound/outbound defaults (priority 65000, 65001, 65500); cannot be deleted | ℹ️ Not modeled (simulator rules are purely custom) |
| **Evaluation Order** | Inbound: subnet NSG → NIC NSG; Outbound: NIC NSG → Subnet NSG | ✓ Tests respect this order |
| **Statefulness** | NSG is stateful; return traffic auto-allowed if outbound allowed | ℹ️ Informational (not explicitly simulated) |
| **Most-Specific-Wins** | If subnet and NIC both have NSGs, most restrictive rule applies | ✓ Tests check both NSGs |

**Form Fields & Validation:**

1. **Name** (required text)
   - Placeholder: `"web-nsg"`
   - **Validation:** Required, 1-80 chars, must start with letter/number, end with letter/number/underscore

2. **Description** (optional text area)
   - Placeholder: `"Rules for web tier traffic"`
   - **Validation:** Optional; if provided, max 140 chars

3. **Security Rules Section** (array of rules)
   - Header: "Security Rules (N)" with "Add Rule" button
   - Each rule is a collapsible card with multiple rows

   **Rule Row 1: Name, Priority, Direction, Access, Protocol, Delete**
   - **Name:** Text input (80 chars max)
   - **Priority:** Number input (100-4096)
   - **Direction:** Dropdown (Inbound | Outbound)
   - **Access:** Dropdown (Allow | Deny)
   - **Protocol:** Dropdown (Tcp | Udp | Icmp | *)
   - **Delete:** Button to remove rule

   **Rule Row 2: Source Type, Source Address/Tag/ASG, Source Port**
   - **Source Type:** Toggle buttons (IP/CIDR | Tag | ASG)
     - When **IP/CIDR:** Text input with placeholder `"10.0.0.0/8 or *"`
     - When **ServiceTag:** Dropdown with known tags (VirtualNetwork, Internet, Storage, KeyVault, etc.)
     - When **ASG:** Dropdown populated from ASG nodes in diagram
   - **Source Port:** Text input with placeholder `"* or 80 or 1024-65535 or 80,443"`

   **Rule Row 3: Destination Type, Destination Address/Tag/ASG, Destination Port**
   - **Destination Type:** Toggle buttons (IP/CIDR | Tag | ASG)
     - When **IP/CIDR:** Text input with placeholder `"10.0.1.0/24 or *"`
     - When **ServiceTag:** Dropdown with known tags
     - When **ASG:** Dropdown populated from ASG nodes in diagram
   - **Destination Port:** Text input with placeholder `"80 or 1024-65535 or 80,443"`

   **Rule Row 4: Description**
   - **Description:** Text input (140 chars max)

   **Errors Display:**
   - Shows validation errors for rule name, priority, addresses, ports, service tags, or ASG references

**Validation Logic** (`validateNsg()` in `lib/componentValidators.ts`):

```
For each rule in securityRules:
  1. Validate rule name: required, 1-80 chars, proper start/end chars
  2. Validate rule description: optional, max 140 chars if provided
  3. Validate priority: 100-4096, unique within NSG
  4. If sourceType === 'IpCidr':
       - Validate sourceAddressPrefix is valid CIDR or known service tag or '*'
  5. If sourceType === 'ServiceTag':
       - Validate sourceAddressPrefix is recognized service tag
  6. If sourceType === 'Asg':
       - Validate sourceAsgId references existing ASG node (warning if missing)
  7. Similarly for destination address/port and destinationType
  8. Validate source and destination port ranges: single/range/list/*
  Return: { isValid: no errors, errors: [array of FieldErrors] }
```

**Integration with Other Components:**

- **Subnets:** NSGs can be associated to subnets via `nsgId` field in SubnetComponent. Subnet-level NSG filters all inbound/outbound traffic for resources in that subnet.
- **NICs:** NSGs can be associated to NICs via `nsgId` field in NetworkICComponent. NIC-level NSG overrides subnet-level NSG; most restrictive rule wins.
- **Evaluation Order:**
  - **Inbound:** Subnet NSG evaluated first (if exists); if allowed, NIC NSG evaluated (if exists)
  - **Outbound:** NIC NSG evaluated first (if exists); if allowed, Subnet NSG evaluated (if exists)
- **Tests:** Connection/LoadBalance/DNS tests check NSG rules via `checkNsgBlocking()` function in `stores/tests.ts`. Blocked connections report "Connection blocked by NSG: [name]".
- **Application Security Groups (ASGs):** NSG rules can reference ASGs as source or destination; all NICs in an ASG are affected by matching rules.

**Auto-Layout Positioning:**

- **Layer:** `'policy'` (outside-VNet policy layer)
- **Positioning:** NSGs are positioned outside and to the side of protected subnets/NICs in the diagram (not contained within VNets)
- **Visual Indicator:** NSG nodes display as security-related icons with rule count badge

**Default Rules (Informational):**

Azure creates these default rules automatically; simulator rules are purely custom (defaults not modeled):

*Inbound:*
- AllowVNetInBound (65000): Allow traffic from VirtualNetwork to VirtualNetwork
- AllowAzureLoadBalancerInBound (65001): Allow Azure Load Balancer traffic
- DenyAllInbound (65500): Deny all other inbound traffic

*Outbound:*
- AllowVnetOutBound (65000): Allow traffic from VirtualNetwork to VirtualNetwork
- AllowInternetOutBound (65001): Allow outbound to Internet
- DenyAllOutBound (65500): Deny all other outbound traffic

**Service Tag Support:**

The simulator recognizes these common service tags (non-exhaustive; extensible):

- `VirtualNetwork` — All IPs within the VNet
- `Internet` — All public internet traffic
- `AzureLoadBalancer` — Azure Load Balancer service
- `Storage` — Azure Storage accounts (GPv2 recommended for new deployments; legacy BlobStorage/FileStorage compatibility retained in the simulator)
- `KeyVault` — Azure Key Vault service
- `Sql` — SQL Database service
- `AppService` — App Service infrastructure
- `AzureActiveDirectory` — Azure AD service
- `AzureContainerRegistry` — Container Registry service
- Plus ~15 others (AppServiceManagement, SqlManagement, AzureResourceManager, AzureMonitor, etc.)

**Future Enhancements (Out of Scope):**

- **ESP/AH Protocol Support:** IPsec protocols rarely used in typical scenarios; can be added to protocol enum later
- **Flow Timeout Configuration:** Advanced feature (currently not configurable)
- **Default Rules Modeling:** Would require read-only rule display in form; tests work without explicit defaults
- **Effective NSG Rules Computation:** Combining subnet + NIC NSG rules for audit report (complex; deferred)
- **Multiple IP Configurations:** Secondary IPs on NICs with independent public IPs
- **IPv6 Support:** Dual-stack subnets and NICs require additional CIDR validation

**Key Invariants:**

- Priority must be unique within an NSG (100-4096 range enforced)
- Rule name must be 1-80 chars, start with letter/number, end with letter/number/underscore
- Rule description must be max 140 chars if provided
- Port range supports single port, range, comma-separated list, or '*'
- Source/Destination must match the selected type (IP/CIDR, ServiceTag, or ASG)
- ASG references are validated against diagram nodes (warning if missing)
- Service tags are validated against known Azure service tag list
- Inbound and Outbound are evaluated separately with different processing order
- NSG itself has no network location restrictions (can be associated with any subnet/NIC in any VNet)
