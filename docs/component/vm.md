## Azure Virtual Machine (VM) Component Specification

**Overview:**  
The Virtual Machine component models Azure IaaS compute instances that run inside a virtual network through attached Network Interface Cards (NICs). In simulator behavior, VM networking is NIC-authoritative: NIC attachment determines subnet and VNet context for validation, path simulation, and containment. The legacy `subnetId` field is retained for compatibility but must stay consistent with attached NICs.

**Data Model** (`VmComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | VM resource name |
| `type` | `VM` | ✓ | Enum value |
| `size` | string | ✓ | Azure VM size (e.g., `Standard_D2s_v3`) |
| `os` | `'Windows' \| 'Linux'` | ✓ | Guest OS family |
| `imagePublisher` | string | — | Marketplace image publisher (recommended) |
| `imageOffer` | string | — | Marketplace image offer (recommended) |
| `imageSku` | string | — | Marketplace image SKU (recommended) |
| `adminUsername` | string | ✓ | Administrator username |
| `nicIds` | string[] | ✓ | One or more NIC IDs; authoritative network attachment |
| `subnetId` | string | — | Compatibility metadata; must match first attached NIC subnet when set |
| `availabilityZone` | `'1' \| '2' \| '3'` | — | Optional zone placement |
| `diskType` | `'Standard_LRS' \| 'StandardSSD_LRS' \| 'Premium_LRS'` | — | Legacy simplified OS disk tier metadata; full disk modeling belongs to `MANAGED_DISK` |
| `enableManagedIdentity` | boolean | — | Enables a system-assigned managed identity for the VM |
| `userAssignedIdentityIds` | string[] | — | User-assigned managed identity node references |

**Form Behavior** (`ComputeForm.vue`, VM mode):

1. **Name** (required text)
2. **VM Size** (required text)
3. **OS** (required select button)
4. **Admin Username** (required text)
5. **Image Publisher/Offer/SKU** (optional but recommended)
6. **Disk Type** (optional select)
7. **Network Interfaces** (required multi-select from NIC components)
8. **Subnet (derived)** read-only display resolved from attached NICs
9. **Availability Zone** optional select (zones 1/2/3 only)
10. **Identity** controls: system-assigned managed identity toggle plus user-assigned identity MultiSelect filtered to `UserAssigned` managed identity nodes

**Validation Logic** (`validateCompute()` for VM):

- ❌ Error: `size` required
- ❌ Error: `adminUsername` required
- ❌ Error: `os` must be `Windows` or `Linux`
- ❌ Error: At least one NIC must be attached (`nicIds` non-empty)
- ❌ Error: Every `nicIds` reference must exist and be a NIC node
- ❌ Error: Every attached NIC must have a subnet
- ❌ Error: All attached NICs must resolve to the same VNet
- ❌ Error: If `subnetId` is set, it must match first attached NIC subnet
- ❌ Error: `availabilityZone` must be `1`, `2`, or `3` when set
- ❌ Error: `diskType` must be one of supported tiers when set
- ❌ Error: `userAssignedIdentityIds[]` references a non-managed-identity resource or a system-assigned identity node
- ⚠️ Warning: Image publisher/offer/SKU should be provided for deployment realism
- ⚠️ Warning: Referenced user-assigned identity is missing from the diagram

**Integration Points:**

- **Tests (`stores/tests.ts`):** internet traversal and subnet NSG evaluation resolve subnet from attached NICs first, then fallback to `subnetId`.
- **Auto-layout (`lib/dagre.ts`):** VM parent containment resolves subnet from attached NICs when direct `subnetId` is absent.
- **Challenges (`stores/challenges.ts`):** subnet-based challenge checks resolve VM subnet from NICs first.
- **Managed Identity:** VM can use both `enableManagedIdentity` and `userAssignedIdentityIds[]`; identity references participate in test and challenge relationship graphs.

**Key Invariants:**

- VM requires at least one NIC; NIC attachment is the source of truth for network placement.
- Legacy `subnetId` remains compatibility metadata and must not conflict with attached NICs.
- VM availability zones are optional but constrained to Azure zone IDs (`1`,`2`,`3`).
- VM `diskType` remains legacy simplified metadata for backward compatibility.
- Full managed disk modeling, including disk role, redundancy, size, performance metadata, and VM attachment, belongs to the Managed Disk component.
- System-assigned and user-assigned managed identities are not mutually exclusive.
