## Azure Virtual Machine Scale Sets (VMSS) Component Specification

**Overview:**  
Azure Virtual Machine Scale Sets (VMSS) enable you to create and manage a group of identical, load-balanced VMs that automatically scale up or down based on demand or schedules. VMSS simplifies large-scale VM deployment, provides high availability through distribution across fault domains and availability zones, and supports automatic OS updates and instance healing. VMSS is ideal for stateless applications, web services, and batch processing workloads requiring elastic scalability.

**Data Model** (`VmssComponent` in `types/network.ts`):

```typescript
export interface VmssComponent extends NetworkComponent {
  type: NetworkComponentType.VMSS
  sku: string                                    // Required: VM size (e.g., Standard_D2s_v3)
  capacity: number                               // Required: Initial number of instances (0-1000)
  os: 'Windows' | 'Linux'                       // Required: Operating system type
  orchestrationMode: 'Flexible' | 'Uniform'     // Required: Immutable orchestration mode
  imagePublisher: string                         // Recommended: Marketplace image publisher
  imageOffer: string                             // Recommended: Marketplace image offer
  imageSku: string                               // Recommended: Marketplace image SKU
  subnetId?: string                              // Required: Subnet for instance deployment
  upgradePolicy?: 'Automatic' | 'Manual' | 'Rolling' // Optional: Default Automatic (recommended)
  autoscaleEnabled?: boolean                     // Optional: Enable autoscaling
  minCapacity?: number                           // Optional: Min capacity when autoscale enabled
  maxCapacity?: number                           // Optional: Max capacity when autoscale enabled
  availabilityZones?: string[]                   // Optional: Zone distribution (1, 2, 3 for resilience)
  scaleInPolicy?: 'FIFO' | 'OldestVM' | 'NewestVM' // Optional: Order for scale-in (Flexible only)
  overprovision?: boolean                        // Optional: Overprovision during deployment (Uniform only)
}
```

**Orchestration Modes (Critical Distinction):**

Azure VMSS supports two fundamentally different orchestration modes, each with distinct capabilities, capacity limits, and API compatibility. **The orchestration mode is immutable after creation and cannot be changed.**

| Aspect | Flexible (Recommended) | Uniform |
|--------|---|---|
| **Use Case** | Mixed instance types, Spot + on-demand mix, high availability, stateless/stateful apps | Consistent identical instances, large-scale homogeneous deployments |
| **Max Instances** | 1,000 (standard images, marketplace, custom via Azure Compute Gallery) | 100 per placement group; 600 total with custom images; 1,000 with platform images |
| **Instance Types** | ✓ Can mix different VM SKUs (within FDCount=1 constraint) | ✗ All instances must be identical |
| **Spot + On-Demand** | ✓ Mix Spot and on-demand instances with priority specification | ✗ All instances must be same priority |
| **API Compatibility** | ✓ Full standard Azure IaaS VM APIs; tagging, RBAC, Backup, Site Recovery | ✗ Limited to scale set VM APIs; no standard VM API support |
| **Fault Domain Control** | ✓ Specify fault domain per instance; 1-3 FDs depending on region | ✗ Automatic spread; no per-instance FD control |
| **Zone Redundancy** | ✓ Full control; instances spread across 1, 2, or 3 availability zones | ✓ Supported; instances spread across zones |
| **Scale-In Policy** | ✓ FIFO, OldestVM, NewestVM | ✓ Removal order configurable |
| **SLA** | 99.95% (FD>1); 99.99% (across zones) | 99.95% (FD>1); 99.99% (across zones) |
| **Autoscaling** | ✓ Metrics-based, schedule-based, manual scaling | ✓ Metrics-based, schedule-based, manual scaling |
| **Maintenance** | Platform-driven per fault domain; no update domains | Update domains (5 per placement group) |

**Form Behavior** (`ComputeForm.vue` - VMSS section):

1. **Orchestration Mode** (required SelectButton):
  - Options: `Flexible`, `Uniform`
  - Default: `Flexible` (Azure recommendation)
  - Info text: Explains mode immutability and key differences
  - **Conditional Fields** (shown based on selected mode):
    - **Flexible**: Scale-In Policy dropdown (FIFO, OldestVM, NewestVM)
    - **Uniform**: Overprovision toggle (default true; creates extra instances for deployment reliability)

2. **SKU / VM Size** (required text, with error if empty):
  - Placeholder: `"Standard_D2s_v3"`
  - Helper text: "Applies to all instances in the scale set"
  - Applies uniformly to all instances in the scale set

3. **OS** (required SelectButton):
  - Options: `Windows`, `Linux`

4. **Image Publisher, Offer, SKU** (recommended text fields):
  - Placeholders: `"Canonical"`, `"UbuntuServer"`, `"22_04-lts-gen2"`
  - All three recommended for deployment realism
  - Warning issued if any of the three missing

5. **Initial Capacity** (required InputNumber):
  - Min: 0 (allows empty scale set for deferred deployment)
  - Max: 1000 (Azure limit; actual limit varies by mode/region)
  - Helper text: "Starting number of VMs (0 allowed for deferred deployment)"
  - Default: 2 (recommended for HA)

6. **Upgrade Policy** (optional Select):
  - Options: `Automatic` (recommended), `Manual`, `Rolling`
  - Default: `Automatic` (management best practice)
  - Helper text: "How OS patches and config updates are applied"

7. **Availability Zones** (optional comma-separated input):
  - Parsed into `string[]` via computed property (`availabilityZonesStr`)
  - Placeholder: `"1, 2"`
  - Validation: Only values 1, 2, 3 allowed; warning if < 2 zones (SLA drops to 99.95%)
  - Helper text: "Comma-separated zone IDs (1, 2, 3); 2+ recommended for 99.99% SLA"
  - Default: `['1', '2']` (zone redundancy by default)

8. **Scale-In Policy** (Flexible-only, optional Select):
  - Options: `FIFO` (oldest first), `OldestVM`, `NewestVM`
  - Default: `FIFO` (safe default; removes oldest instances first)
  - Shown only when `orchestrationMode === 'Flexible'`
  - Helper text: "Order for removing VMs during scale-in"

9. **Overprovision** (Uniform-only, optional toggle):
  - Default: true (creates extra instances for deployment reliability; can cause up to 20% waste)
  - Shown only when `orchestrationMode === 'Uniform'`
  - Warning: Explains default behavior and implications for strict instance counting
  - Helper text: "Default true: creates extra VMs during deployment for reliability"

10. **Autoscale Enabled** (optional toggle):
   - When enabled, shows Min Capacity and Max Capacity fields
   - Min Capacity (optional InputNumber): 0-1000
   - Max Capacity (optional InputNumber): 0-1000
   - Constraint: Min <= Max (error if violated)
   - Helper text: "Min must be <= Max; if equal, autoscaling will not trigger"

11. **Subnet** (required Select):
   - Dropdown from SUBNET nodes in diagram
   - Error if missing or referenced subnet doesn't exist

**Validation Rules** (`componentValidators.ts` - validateCompute VMSS section):

| Constraint | Validation | Severity | UI Behavior |
|---|---|---|---|
| **SKU Required** | `sku` non-empty | Error | Input wrapper red border; error message shown |
| **OS Required** | `os` one of 'Windows' or 'Linux' | Error | SelectButton always valid; validation catches API errors |
| **Orchestration Mode** | `orchestrationMode` one of 'Flexible' or 'Uniform' | Error | SelectButton constraint; field disabled if invalid |
| **Capacity Range** | `capacity` 0-1000 | Error | InputNumber enforces min=0, max=1000 |
| **Subnet Required** | `subnetId` required and exists | Error | Dropdown validation; error if referenced node missing |
| **Image Recommended** | All of publisher/offer/SKU provided | Warning | Warning text shown; does not block save |
| **Availability Zones** | Zone IDs only 1, 2, or 3 | Warning | Array filter; warning if invalid zones found |
| **Zone Redundancy** | < 2 zones | Warning | Informs user of 99.95% SLA vs 99.99% with 2+ zones |
| **Autoscale Min/Max** | If enabled: min >= 0, max <= 1000, min <= max | Error | InputNumber constraints; error if violated |
| **Autoscale Ineffective** | If enabled and min == max | Warning | Warns user scaling will not trigger |
| **Overprovision (Uniform)** | Default true; advise implications | Warning | Explains deployment reliability vs cost/resource waste tradeoff |

**Azure Alignment:**

- ✓ Two orchestration modes with correct capacity limits (Flexible: 1000, Uniform: 600-1000)
- ✓ Orchestration mode immutability enforced in UI (no mode change after creation in simulator; accurate to Azure)
- ✓ SKU and OS fields required; apply uniformly to all instances
- ✓ Capacity range 0-1000 (allows deferred deployment)
- ✓ Upgrade policies Automatic (recommended), Manual, Rolling
- ✓ Autoscaling independent of upgrade policy; optional metrics/schedule-based scaling
- ✓ Availability zones support across both modes; 99.99% SLA with 2+ zones
- ✓ Scale-in policy selection (Flexible mode feature)
- ✓ Overprovision modeling (Uniform mode feature)
- ✓ Instance protection and health probe references (documented as future enhancements)
- ✓ Spot instance mixing (documented as v2 enhancement; Flexible supports both)

**Key Integration Points:**

- **Node Type**: `compute-node` (shared with VM, AKS, App Service, Functions)
- **Layer Classification**: `vnet` (deployed in subnet, always VNet-scoped)
- **Backend Pool Eligibility**: VMSS instances can be backend pool members in LoadBalancer and AppGateway
- **Test Integration**: VMSS inbound reachability test in full sample diagram
- **Challenges**: VMSS can reference compute resources in challenge tasks
- **Export/Import**: All VMSS fields including orchestration mode, zones, and scale-in policy preserved

**Do NOT:**

- Support fewer than two orchestration modes (both Flexible and Uniform required for Azure accuracy)
- Allow orchestration mode change after creation (mode is immutable in Azure)
- Remove capacity field or limit to >= 1 (Azure allows 0 instances for deferred deployment)
- Skip zone redundancy warnings (critical for SLA awareness)
- Remove scale-in policy or overprovision fields (core features of respective modes)
- Merge SKU and OS as optional (both are required in Azure)

**Future Enhancements (Out of Scope for v1):**

- Spot instance priority and eviction policy (Flexible only)
- Public IP per instance (Flexible only)
- Instance protection capability (prevent scale-in for specific instances)
- Health probe reference and Application Health Extension
- Automatic OS image upgrades via Azure Compute Gallery
- Capacity reservations for reserved instance integration
- Per-instance fault domain assignment (Flexible advanced feature)
- Multiple NICs and custom IP configurations per instance
- BGP / Azure Route Server integration for stateful VMSS in hub networks
