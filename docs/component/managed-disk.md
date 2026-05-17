## Azure Managed Disk Component Specification

**Overview:**  
Azure Managed Disks are block-level storage volumes managed by Azure for persistent data on Virtual Machines. The simulator models all 5 Azure managed disk types (Ultra Disks, Premium SSD v2, Premium SSDs, Standard SSDs, Standard HDDs) with support for redundancy options (LRS/ZRS), disk roles (OS/Data), and performance configuration (IOPS/throughput). This aligns with Azure best practices for high availability, performance optimization, and cost-effective storage selection per workload requirements.

**Core Features:**
- **5 Disk Types:** Ultra (4–65,536 GiB, ultra-high IOPS), Premium SSD v2 (1–65,536 GiB, configurable IOPS/throughput), Premium SSD (4–32,767 GiB, fixed IOPS/throughput), Standard SSD (4–32,767 GiB, consistent latency), Standard HDD (4–32,767 GiB, legacy, retiring Sept 8, 2028 for OS disks)
- **Redundancy Options:** LRS (Locally Redundant, 99.999999999% durability) or ZRS (Zone Redundant, 99.9999999999% durability; Premium SSD and Standard SSD only)
- **Disk Roles:** OS (system boot disk), Data (application data disk)
- **Performance Configuration:** Optional IOPS and throughput fields for Ultra and Premium SSD v2 (metadata only; not simulated)
- **Attachment:** Optional linkage to VM for tracking ownership and deployment context

**Data Model** (`ManagedDiskComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Disk resource name |
| `type` | `MANAGED_DISK` | ✓ | Enum value |
| `diskType` | `ManagedDiskType` | ✓ | One of: Ultra, Premium_SSD_v2, Premium_SSD, Standard_SSD, Standard_HDD |
| `redundancy` | `ManagedDiskRedundancy` | ✓ | LRS (all types) or ZRS (Premium/Standard SSD only) |
| `diskRole` | `ManagedDiskRole` | ✓ | OS or DATA |
| `diskSizeGb` | number | ✓ | Size in GiB; range per disk type (1–65,536 for v2, 4–65,536 for Ultra, 4–32,767 for others) |
| `osType` | 'Windows' \| 'Linux' | — | Optional metadata; ignored for Data disks |
| `attachedToVmId` | string | — | Optional VM ID for context tracking |
| `iops` | number | — | Optional; valid only for Ultra and Premium SSD v2 |
| `throughput` | number | — | Optional MB/s; valid only for Ultra and Premium SSD v2 |
| `description` | string | — | Free-form text |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |

**Disk Type Constraints:**

| Disk Type | Min Size | Max Size | Redundancy | OS Disk? | Performance Config? | Regions | Deprecation |
|---|---|---|---|---|---|---|---|
| Ultra | 4 GiB | 65,536 GiB | LRS only | ❌ No | ✓ Yes (1000 IOPS/GiB, 0.25 MB/s per IOPS) | Limited | None |
| Premium SSD v2 | 1 GiB | 65,536 GiB | LRS only | ❌ No | ✓ Yes (3000–80,000 IOPS, 125–2,000 MB/s) | Limited | None |
| Premium SSD | 4 GiB | 32,767 GiB | LRS, ZRS | ✓ Yes | ❌ No | All | None |
| Standard SSD | 4 GiB | 32,767 GiB | LRS, ZRS | ✓ Yes | ❌ No | All | None |
| Standard HDD | 4 GiB | 32,767 GiB | LRS only | ✓ Yes | ❌ No | All | **Sept 8, 2028** (OS disk only) |

**Redundancy & Availability:**
- **LRS (Locally Redundant Storage):** Data replicated 3 times within a single data center; 99.999999999% (11 9's) annual durability; all disk types supported
- **ZRS (Zone Redundant Storage):** Data replicated 3 times across 3 availability zones; 99.9999999999% (12 9's) annual durability; **only Premium SSD and Standard SSD** supported (not Ultra, not Premium SSD v2); better for multi-zone deployments

**Performance Configuration (Ultra & Premium SSD v2 Only):**
- **Ultra Disk IOPS:** 100–400,000 IOPS; 1000 IOPS/GiB provisioning model; 4 performance adjustments per 24-hour window
- **Ultra Disk Throughput:** 1–10,000 MB/s; 0.25 MB/s per provisioned IOPS; minimum 1 MB/s guaranteed baseline
- **Premium SSD v2 IOPS:** 3,000–80,000 IOPS; baseline 3,000 + 500 per GiB above 6 GiB; 4 adjustments per 24-hour window
- **Premium SSD v2 Throughput:** 125–2,000 MB/s; baseline 125 + 0.25 MB/s per IOPS above 3,000
- **Fixed IOPS/Throughput (Premium SSD, Standard SSD, HDD):** IOPS and throughput tied to disk size (not configurable); performance configuration fields ignored with warning

**Validation Rules** (`validateStorage()` in `lib/componentValidators.ts`):

**Errors (blocking):**
- ❌ diskType not one of 5 supported types
- ❌ redundancy not LRS or ZRS
- ❌ redundancy incompatible with disk type (e.g., Ultra + ZRS)
- ❌ diskRole not OS or DATA
- ❌ diskSizeGb outside range for selected disk type
- ❌ OS role selected for Ultra or Premium SSD v2 (cannot be OS disks)
- ❌ attachedToVmId references non-existent VM

**Warnings (non-blocking):**
- ⚠️ Standard HDD as OS disk (retiring Sept 8, 2028)
- ⚠️ Premium SSD v2 with ZRS redundancy (not yet supported; use LRS)
- ⚠️ OS role without compatibility (Ultra/Premium v2 cannot be OS disks)
- ⚠️ Data disk without VM attachment (tracking recommendation)
- ⚠️ IOPS/throughput configured on non-configurable disk types (Premier SSD, Standard SSD, HDD, or Data disks)
- ⚠️ IOPS/throughput values outside Azure limits per disk type
- ⚠️ Premium v2 or Ultra disk type without regional availability confirmation (informational)

**Form Behavior** (`StorageForm.vue` Managed Disk Section):

| Field | Type | Visibility | Notes |
|---|---|---|---|
| **Disk Type** | SelectButton + Label | Always | Dropdown with 5 options; updates redundancy/size limits dynamically |
| **Disk Role** | SelectButton (OS/Data) | Always | Determines OS type field visibility and OS disk type constraints |
| **Redundancy** | Dropdown | Always | Dynamic options per selected disk type (LRS only for Ultra/v2; LRS+ZRS for Premium/Standard SSD) |
| **Disk Size (GB)** | InputNumber | Always | Min/max dynamically updates per selected disk type |
| **IOPS** | InputNumber | Ultra/v2 only | Optional; helper text shows valid range and baseline calculation |
| **Throughput (MB/s)** | InputNumber | Ultra/v2 only | Optional; helper text shows max MB/s per Azure specs |
| **OS Type** | SelectButton (Windows/Linux) | Data Disk only | Optional metadata; hidden for OS disks; purely informational |
| **Attached to VM** | Dropdown | Always | Optional; select from VM nodes; warning if data disk unattached |

**Helper Text Guidance:**
- Disk Type: "Ultra and Premium SSD v2 available in select regions; Standard HDD retiring Sept 8, 2028 for OS disks"
- Redundancy: "LRS: 11 9's durability; ZRS: 12 9's (multi-zone, Premium/Standard SSD only)"
- Disk Size: "Range: {min}–{max} GB for {diskType}"
- IOPS (Ultra): "Ultra: 100–{maxIops} IOPS (1000 IOPS/GiB, max 400,000)"
- IOPS (Premium v2): "Premium v2: 3000–{maxIops} IOPS (baseline 3000 + 500/GiB above 6 GB)"
- Throughput: "Max: {maxThroughput} MB/s"
- OS Type (Data disk): "Documentation only; data disks are OS-agnostic"
- Attached VM: "Optionally link to VM for ownership tracking; data disks should have one attachment"

**Node Display Format:**
`"{DiskType} - {Size}GB ({Redundancy}) ({Role})"`
Examples: "Premium_SSD_v2 - 512 GB (LRS) (Data)", "Premium_SSD - 256 GB (ZRS) (OS)", "Ultra - 1024 GB (LRS) (Data)"

**Layer Classification:**
Managed Disks always classified as **private** layer (backend storage, not public-facing). Access mediated through VM attachment context. Storage accounts and managed identities are also private-layer resources.

**Integration Points:**
- **VM Component:** VM.diskType field (backward-compatible metadata) expands to support all 5 disk types; recommend explicit Managed Disk linkage via attachedToVmId (future enhancement)
- **Test Integration:** Managed disk reachability tests (intra-disk verification) deferred to v2; v1 focuses on form/validation completeness
- **Storage Layer:** Managed disks fall under private storage category alongside Storage Accounts; never expose to public internet directly
- **Export/Import:** Managed disk data model (all 5 types + redundancy) round-trips via drawio export/import without data loss

**Backward Compatibility:**
- **Legacy sku Field:** Existing components with deprecated `sku` field ('Standard_LRS', 'Premium_LRS', 'StandardSSD_LRS', 'UltraSSD_LRS') normalize on load to new model (diskType + redundancy)
- **Migration Logic:** On component load, if legacy sku present and new fields absent, auto-populate: diskType from sku prefix, redundancy from sku suffix (LRS assumed), diskRole defaults to DATA
- **No Data Loss:** Legacy components remain editable and save with new model; no breaking changes

**Best Practices Matrix:**

| Use Case | Recommended Disk Type | Redundancy | Role | Rationale |
|---|---|---|---|---|
| High-transaction DB (SQL, SAP HANA) | Ultra or Premium SSD v2 | LRS | Data | Sub-millisecond latency, 400K IOPS, enterprise SLA |
| Production application (Standard tier) | Premium SSD | ZRS | Both | Zone resilience, consistent performance, 99.99% SLA |
| Development/testing | Standard SSD | LRS | Both | Cost-effective, predictable latency, sufficient for dev workloads |
| Archive/backup data | Standard HDD | LRS | Data | Cost-optimized for long-term retention; retire Sept 2028 |
| Single-zone non-critical | Standard SSD or HDD | LRS | Both | Cost-optimal; acceptable single-zone failure risk |
| Multi-zone high-availability | Any | ZRS | Both | Zone redundancy for 99.99% uptime (Premium SSD/Standard SSD only) |

**Azure Well-Architected Framework Alignment:**
- **Reliability:** ZRS for multi-zone resilience (99.99% SLA); premium disk types (Ultra/Premium v2/Premium SSD) for mission-critical workloads; avoid Standard HDD for OS disks (retiring)
- **Security:** Data encryption handled by Azure managed service (SSE); host-based encryption optional; encryption key management deferred to v2
- **Performance:** Disk type selection directly impacts IOPS/throughput; Ultra for ultra-high transaction workloads; Premium SSD v2 for flexible performance adjustment; Standard SSD for balanced price/performance
- **Cost Optimization:** Access tier modeling (future); disk right-sizing via performance metrics; Standard HDD end-of-life cost reduction; Zone-redundant SSD cost premium justified for SLA improvement
- **Operational Excellence:** Managed disk snapshots (future), Azure Backup integration (future); disk health monitoring (platform service); size and performance tracking via monitoring

**Out of Scope (v1):**
- Disk snapshots and images (backup/DR feature; deferred to v2)
- Encryption key management and customer-managed keys (security feature; deferred)
- Disk caching policies (performance tuning detail; deferred)
- Premium disk bursting and performance tiers (PerformancePlus; deferred)
- Shared disks (multi-VM attachment; deferred)
- Disk lifecycle management and auto-scaling (automation feature; deferred)
- Regional and zone-specific availability modeling (deployment context; metadata-only)

**Critical Constraints:**
- All 5 disk types must be supported; removing any type breaks Azure fidelity
- Redundancy options must enforce per-type constraints (ZRS only for Premium/Standard SSD)
- Standard HDD deprecation warning non-negotiable (Sept 8, 2028 retirement approaching)
- OS disk compatibility must be enforced (Ultra and Premium SSD v2 cannot be OS disks)
- Single-VM attachment validation for data disks (Azure constraint)
- Dynamic size range validation per disk type (1 GiB minimum for Premium v2, 4 GiB for others)
- IOPS/throughput configuration only for Ultra and Premium SSD v2 (other types fixed)

**Do NOT:**
- Support fewer than 5 disk types; all must be available
- Remove redundancy field or merge SKU + redundancy back into single field
- Allow ZRS for Ultra or Premium SSD v2 (Azure limitation)
- Allow Ultra or Premium SSD v2 as OS disks (Azure constraint)
- Skip Standard HDD deprecation warning (Sept 8, 2028 approaching)
- Allow data disk attachment to multiple VMs (single-attachment constraint)
- Merge disk role field back into osType (role distinction foundational to v1 model)
- Remove IOPS/throughput configuration for premium disks (feature completeness)
- Support performance configuration on non-configurable types (Premium SSD, Standard SSD, HDD)
