## Azure Managed Disk Component Specification

**Overview:**  
Azure Managed Disks are Azure-managed block storage volumes for Virtual Machines. The simulator models the current v1 managed disk surface: disk type, redundancy, OS/data role, size, optional VM attachment, optional OS type metadata, and configurable IOPS/throughput for Ultra Disk and Premium SSD v2.

This spec is aligned with Microsoft Learn guidance for managed disk overview, disk types, redundancy, and VM high availability. Features such as snapshots, disk encryption sets, shared disks, caching policies, bursting, and sector-size settings remain out of scope for v1.

## Data Model

`ManagedDiskComponent` in `types/network.ts`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Unique simulator ID |
| `name` | string | Yes | Disk resource name |
| `type` | `MANAGED_DISK` | Yes | Component discriminator |
| `diskType` | `ManagedDiskType` | Yes | `Ultra`, `Premium_SSD_v2`, `Premium_SSD`, `Standard_SSD`, or `Standard_HDD` |
| `redundancy` | `ManagedDiskRedundancy` | Yes | `LRS` or `ZRS`, constrained by disk type |
| `diskRole` | `ManagedDiskRole` | Yes | `OS` or `DATA` |
| `diskSizeGb` | number | Yes | Whole GiB value; range depends on disk type |
| `osType` | `Windows` or `Linux` | No | OS disk metadata only; must match attached VM OS when set |
| `attachedToVmId` | string | No | Optional VM ID for ownership and topology context |
| `iops` | number | No | Only meaningful for Ultra Disk and Premium SSD v2 |
| `throughput` | number | No | MB/s; only meaningful for Ultra Disk and Premium SSD v2 |
| `sku` | legacy string | No | Deprecated compatibility field normalized on load/edit/export |

## Disk Type Rules

| Disk Type | Size Range | Redundancy | OS Disk | Configurable Performance |
|---|---:|---|---|---|
| Ultra | 4-65,536 GiB | LRS | No | Yes |
| Premium SSD v2 | 1-65,536 GiB | LRS | No | Yes |
| Premium SSD | 4-32,767 GiB | LRS, ZRS | Yes | No |
| Standard SSD | 4-32,767 GiB | LRS, ZRS | Yes | No |
| Standard HDD | 4-32,767 GiB | LRS | Yes, warning | No |

Validation blocks unsupported combinations:

- Ultra and Premium SSD v2 cannot be OS disks.
- ZRS is valid only for Premium SSD and Standard SSD.
- Disk size must be a whole number within the selected disk type range.
- Standard HDD as an OS disk is allowed but warns about the September 8, 2028 OS disk retirement.

## Performance Rules

Performance fields are metadata-only in the simulator and are validated as warnings when outside Azure limits.

- Ultra Disk IOPS: `100` to `min(400000, diskSizeGb * 1000)`.
- Ultra Disk throughput: `1` to `min(10000, iops * 0.25)` MB/s when IOPS is set.
- Premium SSD v2 IOPS: `3000` to `min(80000, 3000 + max(0, diskSizeGb - 6) * 500)`.
- Premium SSD v2 throughput: `125` to `min(2000, max(750, iops * 0.25))` MB/s. If IOPS is unset, validation assumes 3000 IOPS, so the default throughput ceiling is 750 MB/s.
- Premium SSD, Standard SSD, and Standard HDD have fixed performance bands determined by Azure; simulator `iops` and `throughput` fields warn if set.

## Form Behavior

`StorageForm.vue` shows the managed disk section when `type === MANAGED_DISK`:

- Disk Type dropdown with all five supported disk types.
- Disk Role selector (`OS` or `Data`).
- Redundancy dropdown filtered by disk type; invalid existing values are coerced to the first valid option when the disk type changes.
- Disk Size input with dynamic min/max.
- IOPS and Throughput inputs only for Ultra Disk and Premium SSD v2; values are cleared when switching to fixed-performance disk types.
- OS Type selector only for OS disks; data disks clear `osType`.
- Attached VM selector listing VM components.
- Warning-severity validation renders as warnings and does not block save; error-severity validation blocks save.

## Integration

- Diagram loading, node creation, editing, and draw.io import normalize legacy managed disk records before use.
- Legacy `sku` values normalize to the current model:
  - `Premium_LRS` / `Premium_ZRS` -> Premium SSD with matching redundancy.
  - `StandardSSD_LRS` / `StandardSSD_ZRS` -> Standard SSD with matching redundancy.
  - `Standard_LRS` -> Standard HDD LRS.
  - `UltraSSD_LRS` -> Ultra LRS.
  - `PremiumV2_LRS` -> Premium SSD v2 LRS.
- Legacy `diskSizeGB` normalizes to `diskSizeGb`.
- Managed disk nodes render and export labels as: `{diskType} - {diskSizeGb} GB ({redundancy}) ({diskRole})`.
- Data disk attachment is optional but warns when absent.
- Attached VM IDs must resolve to VM nodes.
- Only one modeled OS disk may attach to a given VM.
- OS disk `osType`, when present, must match the attached VM `os`.
- VM `diskType` remains a legacy simplified OS disk metadata field; it is not expanded to the full managed disk model.

## Out Of Scope

- Disk snapshots, images, Azure Backup, and restore workflows.
- Customer-managed keys, disk encryption sets, and host-based encryption settings.
- Shared disks and multi-writer attachment.
- Disk caching, bursting, performance tiers, and Performance Plus.
- Regional/zone SKU availability enforcement and VM-size compatibility enforcement.
- Sector size, upload size, import/export jobs, and lifecycle automation.
