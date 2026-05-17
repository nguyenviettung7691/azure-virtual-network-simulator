## Azure DNS Zone Component Specification

**Overview:**  
Azure DNS is a cloud-based DNS hosting service that allows you to manage and resolve domain names within Azure. DNS zones are containers for DNS records of a specific domain (e.g., `contoso.com`). Azure supports both **Public DNS zones** (internet-resolvable domains) and **Private DNS zones** (resolvable only from linked virtual networks). Public zones host domains registered with domain registrars and accessible globally; private zones enable internal name resolution within VNets without public exposure.

**Key Azure DNS Specifications:**

| Aspect | Public DNS Zones | Private DNS Zones |
|--------|------------------|-------------------|
| **Max Zones per Subscription** | 250 | 1,000 |
| **Max Record Sets per Zone** | 10,000 | 25,000 |
| **Max Records per Record Set** | 20 | 20 |
| **Max VNet Links** | N/A | 1,000 |
| **Zone Name Format** | Any valid domain name | 2+ labels minimum (e.g., `contoso.com`, not `local`) |
| **Resolution Scope** | Internet-wide (global DNS hierarchy) | Only linked VNets |
| **DNS Servers** | Azure DNS nameservers assigned per zone | Azure DNS nameservers assigned per zone |
| **Wildcard Support** | ✓ Yes (e.g., `*.contoso.com`) | ✓ Yes |
| **Metadata** | Per zone (tags) | Per zone (tags) + per record set (metadata) |

**Data Model** (`DnsZoneComponent` and `DnsRecord` in `types/network.ts`):

```typescript
export interface DnsZoneComponent extends NetworkComponent {
  type: NetworkComponentType.DNS_ZONE
  zoneName: string                              // Required: Valid domain name (e.g., contoso.com)
  zoneType: 'Public' | 'Private'               // Required: Public or Private zone type
  vnetLinks?: string[]                          // Optional: VNet IDs linked to private zone
  recordSets?: DnsRecord[]                      // Optional: Array of record sets in this zone
  metadata?: Record<string, string>             // Optional: Key-value metadata pairs
}

export interface DnsRecord {
  name: string                                  // Record name (@=apex, *=wildcard, or FQDN relative to zone)
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'PTR' | 'SRV' | 'TXT' | 'CAA' | 'NS' | 'SOA' | 'SPF' | 'DS' | 'TLSA'
  ttl: number                                   // Time-to-live: 1 to 2,147,483,647 seconds
  values: string[]                              // Array of record values (e.g., ['10.0.1.10'] for A record)
  metadata?: Record<string, string>             // Optional: Per-record metadata
}
```

**Form Behavior** (`DnsZoneForm.vue`):

1. **Name** (required text)
   - Placeholder: `"my-dns-zone"`
   - User-friendly name for the zone in the diagram

2. **Zone Name** (required text)
   - Placeholder: `"example.com"`
   - Must be valid domain name (RFC 1035 DNS name format)
   - **Private zones constraint:** Must contain 2+ labels (e.g., `contoso.com`; single-label names like `local` rejected with error)
   - Validation: `validateDnsName()` checks DNS format; private zone label count enforced

3. **Zone Type** (required; Public or Private)
   - SelectButton: "Public" or "Private"
   - **Public:** Internet-resolvable zone; requires external name server configuration with registrar
   - **Private:** VNet-linked zone; only resolvable within linked VNets

4. **VNet Links** (shown only if Zone Type = Private)
   - Checkboxes for all VNET nodes in diagram
   - Caption: "Private zones should be linked to one or more VNets"
   - Helper text shows: "VNet Links: {count}/1000 ({status})" where status is "✓ Within limit", "⚠️ Over 50%", or "⚠️ Approaching limit"
   - **Validation:**
     - ⚠️ Warning: Private zone with no VNet links
     - ⚠️ Warning: Referenced VNet doesn't exist
     - ⚠️ Warning if count ≥ 900/1000 (approaching Azure limit)

5. **Record Sets** (optional array section)
   - Add Record button to append new records
   - For each record:
     - **Name field:** Record name (@ for apex, * for wildcard, or subdomain like `web`)
     - **Type selector:** A, AAAA, CNAME, MX, PTR, SRV, TXT, CAA, NS, SOA, SPF, DS, TLSA (14 types)
     - **TTL field:** InputNumber with range 1 to 2,147,483,647 seconds (Azure limit)
     - **Values field:** Comma-separated values (e.g., "10.0.1.10, 10.0.1.11" for A record; "mail.contoso.com" for MX)
     - **Delete button:** Remove individual record
   - Helper text: "Supported types: A, AAAA, CNAME, MX, PTR, SRV, TXT, CAA, NS, SOA, SPF, DS, TLSA. Use '@' or leave empty for apex records. Use '*' for wildcard records."
   - **Validation per record:**
     - ❌ Error if TTL < 1 or > 2,147,483,647
     - ⚠️ Warning if CNAME has > 1 record (CNAME records can only have 1 record; cannot coexist with other records of same name)
     - ⚠️ Warning if SOA has > 1 record (SOA records auto-managed by Azure; single record only)

6. **Record Set Count Warning**
   - Display record count at top of Record Sets section: "Record Sets ({{count}})"
   - **Validation:**
     - ⚠️ Warning if approaching Azure limits:
       - Public zones: 10,000 record sets max; warn at 9,000+
       - Private zones: 25,000 record sets max; warn at 22,500+

7. **Description** (optional textarea)
   - Placeholder: (empty)
   - Free-form text describing zone purpose

**Azure Alignment:**

| Constraint | Implementation | Validation |
|-----------|-----------------|-----------|
| **Zone Name Format** | Valid DNS name (RFC 1035) | `validateDnsName()` checks format |
| **Private Zone Labels** | 2+ labels required (e.g., `contoso.com`) | Form error if single-label for Private zones |
| **TTL Range** | 1 to 2,147,483,647 seconds | InputNumber min/max; warning on record validation |
| **Record Types** | All 14 Azure types supported | Type selector dropdown |
| **CNAME Constraint** | Single record only; cannot coexist with other records | Warning if >1 CNAME for same name |
| **SOA Constraint** | Auto-managed; single record only | Warning if >1 SOA for same name |
| **Wildcard Support** | Record name = '*' | Helper text documents wildcard records |
| **VNet Links (Private)** | Max 1,000 links per zone | Warning if count ≥ 900 |
| **Record Sets (Public)** | Max 10,000 per zone | Warning if ≥ 9,000 |
| **Record Sets (Private)** | Max 25,000 per zone | Warning if ≥ 22,500 |
| **Records per Set** | Max 20 records | Not enforced in v1 (metadata awareness only) |

**Validation Logic** (`validateDnsZone()` in `lib/componentValidators.ts`):

1. **Zone Name Validation**
   - ❌ Error: Zone name required
   - ❌ Error: Invalid DNS format (via `validateDnsName()`)
   - ❌ Error (Private only): Single-label zone names not allowed

2. **Record TTL Validation**
   - ❌ Error (warning): TTL < 1 or > 2,147,483,647

3. **CNAME/SOA Constraint Validation**
   - ⚠️ Warning: Multiple CNAME records for same name
   - ⚠️ Warning: Multiple SOA records for same name

4. **Record Set Count Validation**
   - ⚠️ Warning (Public zones): ≥ 9,000 record sets
   - ⚠️ Warning (Private zones): ≥ 22,500 record sets

5. **VNet Links Validation (Private only)**
   - ⚠️ Warning: No VNet links attached to private zone
   - ⚠️ Warning: Referenced VNet doesn't exist
   - ⚠️ Warning: VNet link count ≥ 900/1000 (approaching limit)

**Integration with Other Components:**

- **Private Endpoint DNS Zone Group:** Private Endpoints reference private DNS zones via `dnsZoneGroupId` for private link DNS resolution. Form filters to show only Private zones.
- **DNS Tests:** Network tests of type `'dns'` reference DNS zones via `targetId` for name resolution validation.
- **Layer Classification:** Config-driven based on `zoneType`:
  - `zoneType === 'Public'` → `public-facing` layer (rendered in public edge lanes)
  - `zoneType === 'Private'` → `private` layer (rendered in private resource lanes)

**Key Invariants:**

- Public DNS zone names must be registered via domain registrar and delegated to Azure DNS nameservers for internet resolution
- Private DNS zone names must have 2+ labels; single-label names reserved for special use and blocked by Azure
- CNAME records cannot coexist with other records of the same name (Azure constraint)
- SOA records are auto-managed by Azure and typically read-only (single record per zone)
- VNet links establish the trust boundary for private zones; zones linked to a VNet are resolvable only within that VNet
- Wildcard records (`*`) are supported for all record types except NS and SOA
- Record metadata is optional; supports key-value pairs for operational tagging

**Do NOT:**

- Support only 7 record types; must include all 14 Azure types (A, AAAA, CNAME, MX, PTR, SRV, TXT, CAA, NS, SOA, SPF, DS, TLSA)
- Allow TTL values outside 1 to 2,147,483,647 range
- Skip private zone label validation (2+ labels required)
- Allow CNAME/SOA multiple records without warning
- Skip VNet link count warnings (approaching 1000 limit)
- Skip record set count warnings (approaching zone limits)
- Merge public and private zones into single type; must enforce type separation in validation

**Future Enhancements (Out of Scope):**

- Auto-registration for private zones (requires VM lifecycle integration)
- Zone delegations (child zones via NS records)
- DNSSEC signing and validation (DANE/TLSA verification)
- Alias records to Azure resources (separate Azure feature)
- DNS Private Resolver integration (forwarding rules, conditional DNS)
- Query logging and monitoring
- Automatic zone failover (cross-region failover automation)
- Per-record TTL caching and optimization suggestions
