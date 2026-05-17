## Azure Network Virtual Appliance (NVA) Component Specification

**Overview:**  
A Network Virtual Appliance (NVA) is a third-party virtual machine image from Azure Marketplace that provides network functions virtualization. NVAs extend Azure-native networking with capabilities including next-generation firewalls (NGFW), SD-WAN edge appliances, VPN endpoints, internet proxies, IDS/IPS, layer-4 reverse proxies, and WAN optimizers. Unlike Azure Firewall (a managed PaaS service), NVAs run on customer-managed VMs and require explicit configuration: IP forwarding must be enabled, User-Defined Routes (UDRs) must steer traffic to the NVA, and for high availability, additional infrastructure (Load Balancer, Route Server, or dynamic UDR/IP failover) is needed.

**Core Azure Concepts:**

- **IP Forwarding:** Azure's network stack drops packets not addressed to the NIC's own IP address by default. NVAs must have IP forwarding enabled (modeled directly on `NvaComponent.enableIpForwarding` in this simulator) so that traffic routed to the NVA by a UDR is accepted and forwarded rather than dropped.
- **UDR Integration:** Traffic is steered to an NVA via UDRs with `nextHopType=VirtualAppliance` and the NVA's private IP as the next hop. The UDR is associated with subnets whose outbound traffic must pass through the NVA for inspection or routing.
- **Hub-and-Spoke Pattern:** NVAs are commonly deployed in a hub VNet. Spoke subnets have UDRs pointing `0.0.0.0/0` (or specific prefixes) to the hub NVA, enabling centralized East-West and North-South traffic inspection.
- **High Availability:** Azure recommends deploying NVA instances across Availability Zones. HA patterns include: Active-Active (internal Azure Load Balancer with HA ports rules), Active-Standby (dynamic UDR/public IP failover), and BGP-based failover via Azure Route Server.
- **Accelerated Networking:** NVAs should use VM sizes that support accelerated networking (SR-IOV) for high-throughput workloads.

**Data Model (`NvaComponent` in `types/network.ts`):**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | ✓ | — | Unique identifier |
| `name` | string | ✓ | — | Display name (e.g. `hub-nva`) |
| `type` | `NetworkComponentType.NVA` | ✓ | — | Type discriminant |
| `description` | string | — | — | Optional free-text description |
| `tags` | `Record<string, string>` | — | — | Optional resource tags |
| `nvaRole` | `'Firewall' \| 'SDWAN' \| 'VPN' \| 'Proxy' \| 'Other'` | — | — | NVA function classification |
| `vmSize` | string | — | — | Azure VM size (e.g. `Standard_D4s_v3`, `Standard_F8s_v2`) |
| `publisher` | string | — | — | Azure Marketplace publisher (e.g. `cisco`, `checkpoint`, `fortinet`) |
| `offer` | string | — | — | Azure Marketplace offer name (e.g. `cisco-csr-1000v`) |
| `sku` | string | — | — | Azure Marketplace image plan/SKU (e.g. `17_3_3-byol`) |
| `version` | string | — | — | Image version (typically `latest`) |
| `haMode` | `'Single' \| 'ActiveActive' \| 'ActiveStandby'` | — | — | HA topology; informational metadata |
| `availabilityZones` | string[] | — | — | Zones for zone-redundant deployment (e.g. `['1','2','3']`) |
| `publicIpId` | string | — | — | ID of an `IP_ADDRESS` node; for internet-facing NVA scenarios |
| `subnetId` | string | ✓* | — | ID of the subnet the NVA is deployed in (\*required; error if absent) |
| `enableIpForwarding` | boolean | — | `false` | Must be `true` for NVA to route traffic; warning if disabled |
| `createdAt` | string | ✓ | — | ISO timestamp |

**Form Behavior (`NvaForm.vue`):**

- **Name** (required text)
- **Description** (optional textarea)
- **NVA Role** (dropdown: Firewall/NGFW, SD-WAN, VPN Endpoint, Proxy/Web Filter, Other; optional with clear)
- **VM Size** (free text; warning border + text if empty; helper: "Azure VM size — sizes with accelerated networking recommended")
- **Publisher** (free text; warning shown on publisher field when all three marketplace fields — publisher, offer, SKU — are empty; helper: "Azure Marketplace publisher")
- **Offer** (free text; helper: "Azure Marketplace offer name")
- **Image SKU** (free text; helper: "Azure Marketplace image plan/SKU")
- **Version** (free text; placeholder `latest`)
- **High Availability Mode** (dropdown: Single Instance, Active-Active, Active-Standby; optional with clear)
- **Availability Zones** (comma-separated text; `availabilityZonesStr` computed property parses/serializes `string[]`; warning if invalid zone values)
- **Public IP Address** (optional `IP_ADDRESS` select with clear; error if referenced IP doesn't exist in diagram)
- **Enable IP Forwarding** (toggle; warning shown in caption if disabled: `"IP forwarding should be enabled. Without it, Azure drops packets not destined for the NVA's own IP address."`; normal caption shown when enabled)
- **Subnet** (required `SUBNET` select; error label and red border if missing or non-existent)

**Validation Rules (`validateNva()` in `componentValidators.ts`):**

| Severity | Field | Rule |
|---|---|---|
| ❌ Error | `subnetId` | Subnet is required |
| ❌ Error | `subnetId` | Referenced subnet must exist in diagram |
| ❌ Error | `publicIpId` | Referenced public IP must exist in diagram (when set) |
| ⚠️ Warning | `enableIpForwarding` | IP forwarding should be enabled; without it Azure drops routed packets |
| ⚠️ Warning | `vmSize` | VM size should be specified |
| ⚠️ Warning | `publisher` | Azure Marketplace image info (publisher, offer, SKU) should be provided — shown only when all three are empty |
| ⚠️ Warning | `availabilityZones` | Zones must be `1`, `2`, or `3` — lists any invalid values found |

**Azure Alignment:**

- ✓ IP forwarding requirement modeled (warning when disabled; NVA cannot route without it)
- ✓ UDR integration: NVA nodes appear in UDR `nextHopResourceId` dropdown when `nextHopType=VirtualAppliance` (see §2.4)
- ✓ Azure Marketplace image fields: publisher, offer, SKU, version
- ✓ HA topology modes (Single, Active-Active, Active-Standby) as informational metadata
- ✓ Availability Zones for zone-redundant deployment
- ✓ Optional public IP for internet-facing NVA scenarios
- ✓ NVA role classification (Firewall, SD-WAN, VPN, Proxy, Other)
- ✓ Layer classification: always `vnet` in `getComponentLayer()` (NVAs are always deployed within a VNet subnet)

**Key Integration Points:**

- **UDR next-hop:** UDR routes with `nextHopType='VirtualAppliance'` reference NVA nodes in the `nextHopResourceId` dropdown (see [§2.4 UDR](#24-azure-user-defined-routes-udr-component-specification)). The UDR validator also warns when the referenced next-hop NIC does not have IP forwarding enabled.
- **Layer classification:** NVA is always `vnet` layer in `getComponentLayer()` ([stores/diagram.ts](stores/diagram.ts)).
- **Node rendering:** NVA uses its own dedicated `nva-node` canvas node type; do not remap to `compute-node`.
- **Hub-and-spoke firewalling:** The canonical pattern is an NVA in a hub VNet with UDRs on spoke subnets pointing `0.0.0.0/0` or specific prefixes to the hub NVA's IP (`nextHopType=VirtualAppliance`).

**Do NOT:**

- Remove `enableIpForwarding` from `NvaComponent` — it is a required Azure concept; the component models it directly for simplicity even though technically it is per-NIC in Azure
- Add `nicIds[]` to `NvaComponent` for multi-NIC modeling — per-NIC detail for the NVA's own NICs is out of scope; NICs attached to NVA VMs are modeled via separate `NetworkICComponent` nodes if needed
- Remap `NVA` to `compute-node` in `getNodeType()` — NVA has its own `nva-node`
- Remove the UDR-to-NVA integration — the `nextHopResourceId` dropdown in UDR form must continue to include NVA nodes

**Future Enhancements (Out of Scope):**

- **Virtual WAN Hub NVA:** Managed application deployment, NVA Infrastructure Units (scale units), and hub address space allocation are a distinct deployment model not in scope
- **BGP / Route Server Integration:** NVA BGP peering with Azure Route Server for dynamic route advertisement
- **Gateway Load Balancer Chaining:** GWLB-based transparent NVA injection without UDRs
- **Multi-NIC NVA Topology:** Explicit modeling of management, data, and external NICs as separate `NetworkICComponent` nodes on the same NVA
- **HA Failover Automation:** Scripted failover logic (UDR updates, public IP reassignment) for Active-Standby mode
- **Accelerated Networking Enforcement:** Warning if VM size does not support SR-IOV (requires a VM size catalog)

**Key Invariants:**

- NVA must have a subnet reference (`subnetId` required; error if absent)
- IP forwarding must be enabled for the NVA to serve its routing function (warning if absent)
- UDR routes pointing to this NVA use `nextHopType='VirtualAppliance'`
- NVA layer classification is always `vnet`
- NVA node type is `nva-node` (distinct from `compute-node`)
