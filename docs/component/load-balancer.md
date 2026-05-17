## Azure Load Balancer (Standard & Gateway SKUs) Component Specification

**Overview:**  
Azure Load Balancer is a Layer 4 (transport layer) load balancing service that distributes inbound traffic across backend pool members based on load balancing rules. As of September 30, 2025, only Standard and Gateway SKUs are supported; Basic SKU has been retired. Standard Load Balancer provides zone redundancy, autoscaling capabilities, 5,000 endpoint backend pools, and configurable health probes with 5-300 second intervals. Load Balancer can distribute TCP and UDP traffic across virtual machines, virtual machine scale sets, or backend IP addresses using public or internal frontends. Both Public (internet-facing) and Internal (VNet-private) deployment models are supported, enabling diverse network topologies from internet-facing multi-tier applications to intra-VNet service-to-service load balancing.

**SKU Comparison (Basic Retired):**

| Feature | Standard | Gateway |
|---------|----------|---------|
| **Tier Support** | Regional, Global | Regional |
| **Backend Pool Limit** | 5,000 endpoints | Limited (for NVA chaining) |
| **Zone Redundancy** | Yes (2+ AZs recommended) | Yes |
| **Idle Timeout** | 4-30 minutes configurable | 4-30 minutes configurable |
| **Health Probes** | TCP, HTTP, HTTPS (5-300s interval) | TCP, HTTP, HTTPS (5-300s interval) |
| **Public Frontend** | Supported | Not typically used |
| **Internal Frontend** | Supported | Supported |
| **Basic SKU Retired** | YES (September 30, 2025) | — |

**Data Model** (`LoadBalancerComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Load Balancer name (1-80 chars) |
| `type` | enum | ✓ | Always `NetworkComponentType.LOAD_BALANCER` |
| `description` | string | — | Optional component description |
| `sku` | 'Standard' \| 'Gateway' | ✓ | Load Balancer SKU (Basic retired Sept 30, 2025) |
| `tier` | 'Regional' \| 'Global' | ✓ | Regional (single region) or Global (cross-region); Global only for Standard |
| `loadBalancerType` | 'Public' \| 'Internal' | ✓ | Public (internet-facing) or Internal (VNet-private) |
| `availabilityZones` | string[] | — | Zone IDs ('1', '2', '3') for zone redundancy; 2+ recommended for reliability |
| `idleTimeoutInMinutes` | number | — | TCP idle timeout: 4-30 minutes (default 4; applies to all rules) |
| `frontendIpConfigs` | object[] | conditional | Array of frontend IP configurations (public IP for Public LB, subnet for Internal) |
| `backendPools` | object[] | — | Array of backend pool definitions with NIC member arrays |
| `loadBalancingRules` | object[] | — | Array of rules defining frontend-to-backend port mappings |
| `healthProbes` | object[] | — | Array of health probe configurations (TCP, HTTP, HTTPS with intervals) |
| `createdAt` | ISO string | ✓ | Component creation timestamp |

**Frontend IP Configuration** (`LoadBalancerFrontend`):

| Field | Type | Public LB | Internal LB | Notes |
|---|---|---|---|---|
| `publicIpId` | string | ✓ Required | — | References an `IP_ADDRESS` node; must be Standard SKU with Static allocation |
| `subnetId` | string | — | ✓ Required | References a `SUBNET` node |
| `privateIpAddress` | string | — | Optional | Static private IP within subnet CIDR (if omitted, Dynamic allocation) |

**Backend Pool** (`LoadBalancerBackendPool`):

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique ID |
| `name` | string | Pool name (e.g., `default`) |
| `nicIds` | string[] | Array of `NETWORK_IC` node IDs; max 5,000 endpoints per Standard LB |

**Load Balancing Rule** (`LoadBalancingRule`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique ID |
| `name` | string | ✓ | Rule name (e.g., `http-rule`) |
| `protocol` | 'Tcp' \| 'Udp' \| 'All' | ✓ | Transport protocol |
| `frontendPort` | number | ✓ | 1-65535; frontend listening port |
| `backendPort` | number | ✓ | 1-65535; backend destination port |
| `frontendIpId` | string | ✓ | References a frontend IP config |
| `backendPoolId` | string | ✓ | References a backend pool |
| `probeId` | string | — | References a health probe for backend health monitoring |
| `enableFloatingIp` | boolean | — | Direct server return (DSR); allows backend to respond directly |
| `idleTimeoutInMinutes` | number | — | Optional rule-level idle timeout override (4-30 minutes) |

**Health Probe** (`HealthProbe`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique ID |
| `name` | string | ✓ | Probe name (e.g., `http-probe`) |
| `protocol` | 'Tcp' \| 'Http' \| 'Https' | ✓ | Protocol for health checks |
| `port` | number | ✓ | 1-65535; port to probe on backend |
| `intervalInSeconds` | number | ✓ | 5-300 seconds; time between probes |
| `numberOfProbes` | number | ✓ | ≥1; unhealthy threshold (probes failed before marking unhealthy) |
| `requestPath` | string | conditional | Required for HTTP/HTTPS; URI path (e.g., `/health`) |

**Form Behavior** (`LoadBalancerForm.vue`):

1. **Basic Configuration**
   - **Name** (required text)
   - **SKU** (selector: Standard, Gateway; deprecation note for Basic; error if not set)
   - **Type** (selector: Public, Internal; config-driven layer classification)
   - **Tier** (selector: Regional, Global; warning if Global with Gateway SKU)

2. **Availability & Timeout**
   - **Availability Zones** (comma-separated text via `availabilityZonesStr` computed property)
     - Parsed as `string[]` and stored in component
     - Visual warning if < 2 zones
     - Helper: "2+ zones recommended for zone redundancy and reliability (Well-Architected)"
   - **Idle Timeout** (InputNumber 4-30 minutes; default 4)
     - Helper: "TCP idle timeout before connection reset"

3. **Frontend IP Configuration** (conditional)
   - **Public LB:** 
     - Public IP Address (required `IP_ADDRESS` select; error if not set or node doesn't exist)
     - Error validation: Referenced IP must exist, must be Standard SKU, must use Static allocation
   - **Internal LB:**
     - Subnet (required `SUBNET` select; error if not set or node doesn't exist)
     - Private IP Address (optional; Dynamic if empty, Static if specified)

4. **Backend Pool Members**
   - Checkboxes for `NETWORK_IC` nodes
   - Helper: "Select NICs to include in the default backend pool"
   - Shows member count with warning if approaching 5,000 endpoint limit

5. **Health Probes Section** (collapsible, add/remove buttons)
   - For each probe: Name, Protocol, Port, Interval (5-300s), Unhealthy Threshold (≥1), Request Path
   - Request Path field shown only for HTTP/HTTPS; marked required with warning if empty
   - Probe-level validation errors displayed inline
   - Helper: "Health probes monitor backend instance health; 5-300s interval recommended"

6. **Load Balancing Rules Section** (collapsible, add/remove buttons)
   - For each rule: Name, Protocol, Frontend Port, Backend Port, Floating IP toggle
   - Rule-level validation errors displayed inline
   - Helper: "Rules define how frontend ports map to backend pools; each rule should reference a health probe"
   - Port validation: 1-65535 for both frontend and backend ports

7. **Description** (optional textarea)
   - General-purpose notes field

**Validation Rules** (`validateLoadBalancer()` in `componentValidators.ts`):

| Severity | Field | Rule |
|---|---|---|
| ❌ Error | `sku` | Must be Standard or Gateway (reject Basic per retirement) |
| ❌ Error | `tier` | If Gateway SKU, must be Regional (error if Global) |
| ❌ Error | `idleTimeoutInMinutes` | If set, must be 4-30 minutes |
| ❌ Error | `availabilityZones` | Each zone must be '1', '2', or '3' |
| ❌ Error | Health Probe | Interval must be 5-300 seconds, numberOfProbes ≥ 1 |
| ❌ Error | Health Probe | Protocol-specific: HTTP/HTTPS must have requestPath; Tcp may omit it |
| ❌ Error | Load Balancing Rule | Protocol must be Tcp, Udp, or All |
| ❌ Error | Load Balancing Rule | Frontend and backend ports must be 1-65535 |
| ❌ Error | Frontend IP (Public) | Public IP must exist in diagram and must have Standard SKU + Static allocation |
| ❌ Error | Frontend IP (Internal) | Subnet must exist in diagram |
| ⚠️ Warning | `availabilityZones` | Fewer than 2 zones (zone redundancy recommended for Well-Architected reliability) |
| ⚠️ Warning | `tier` | Global tier only valid with Standard SKU; warning if Gateway+Global |
| ⚠️ Warning | Health Probe (HTTP/HTTPS) | Request Path should be specified (warning if empty) |
| ⚠️ Warning | Public IP | Public IP SKU not Standard (Azure requires Standard) |
| ⚠️ Warning | Public IP | Public IP allocation method not Static (Azure requires Static) |
| ⚠️ Warning | Backend Pool | Approaching 5,000 endpoint limit (Azure max per Standard LB) |
| ⚠️ Warning | No Probes | No health probes configured (best practice to monitor backend health) |
| ⚠️ Warning | No Rules | No load balancing rules configured (LB cannot distribute traffic without rules) |

**Azure Alignment:**

- ✓ SKU support: Standard and Gateway only; Basic retired September 30, 2025
- ✓ Tier configuration: Regional (default) or Global (cross-region); Global only for Standard SKU
- ✓ Zone redundancy: 2+ availability zones recommended per Well-Architected Reliability pillar
- ✓ Idle timeout: 4-30 minute range matching Azure configuration span
- ✓ Health probe validation: 5-300 second intervals, ≥1 probe threshold, protocol-specific requestPath
- ✓ Load balancing rule validation: TCP/UDP/All protocols, 1-65535 port range
- ✓ Frontend type config-driven layer classification (Public = `public-facing`, Internal = `vnet`)
- ✓ Public IP Standard SKU + Static allocation validation (Azure requirement for public frontends)
- ✓ Backend pool sizing awareness: max 5,000 endpoints per Standard LB per Azure limits
- ✓ Internal LB subnet requirement and VNet association validation
- ✓ Well-Architected Reliability: zone redundancy warnings, health probe enforcement, idle timeout configuration
- ✓ Well-Architected Security: frontend type separation (public/internal), NSG recommendations via test findings
- ✓ Well-Architected Cost: efficient rule consolidation recommendation, backend pool sizing warnings
- ✓ Well-Architected Operational Excellence: health probe monitoring, test findings integration

**Key Integration Points:**

1. **Layer Classification** ([stores/diagram.ts](stores/diagram.ts#L78-L80))
   - Returns `public-facing` if `loadBalancerType === 'Public'`
   - Returns `vnet` if `loadBalancerType === 'Internal'`
   - Layer classification drives edge visibility and rendering in diagram canvas

2. **Node Type Mapping** ([lib/export/nodeTypeMap.ts](lib/export/nodeTypeMap.ts))
   - Load Balancer component maps to `load-balancer-node` (distinct from compute nodes)
   - Node detail displays SKU + loadBalancerType (e.g., "Standard - Public")

3. **Test Findings Integration** ([stores/tests.ts](stores/tests.ts#L432-L490))
   - Public LB without public IP frontend → warning finding
   - Standard LB with non-Standard public IP → critical finding
   - Zone redundancy check: < 2 AZs or single AZ on Standard → warning with Well-Architected note
   - No health probes configured → warning finding
   - No load balancing rules configured → warning finding
   - Internal LB frontend/backend VNet mismatch → warning finding

4. **Sample Diagram** ([components/diagram/DiagramCanvas.vue](components/diagram/DiagramCanvas.vue#L685-L722))
   - Public Load Balancer example with Standard SKU
   - Zone redundancy configured (2 availability zones: '1', '2')
   - Health probe: HTTP on port 80, 5-second interval, 2-probe threshold, `/healthz` path
   - Load balancing rule: TCP protocol, port 80 frontend → 80 backend
   - Backend pool: 3 NICs for web tier

5. **Diagram Export/Import**
   - All fields preserved including `availabilityZones` and `idleTimeoutInMinutes`
   - Roundtrip fidelity maintained for saved setup reload

**Do NOT:**

- Support Basic SKU (retired September 30, 2025); only Standard and Gateway SKUs
- Model `capacity` field (not an Azure Load Balancer property; removed in this iteration)
- Skip health probe interval validation (5-300 seconds is Azure requirement)
- Skip health probe request path validation for HTTP/HTTPS protocols
- Skip load balancing rule protocol/port validation
- Allow public Load Balancer without public IP frontend (required by Azure)
- Allow non-Standard public IP on Standard Load Balancer (Azure requirement)
- Allow Dynamic IP allocation on public frontend (Azure requires Static)
- Skip backend pool sizing warnings for 5,000 endpoint limit (Azure Standard LB max)
- Suppress zone redundancy warnings (critical for Well-Architected Reliability pillar)
- Remove zone redundancy recommendations for production workloads
- Skip frontend/backend reference validation (must exist and be correct type in diagram)
- Remove `idleTimeoutInMinutes` field (part of Azure Load Balancer configuration contract)

**Future Enhancements (Out of Scope):**

- **Outbound Rules & SNAT:** Explicit outbound traffic configuration and source NAT modeling
- **Session Persistence:** Sticky sessions / client affinity rules (currently not modeled)
- **Multi-Frontend Support:** UI for multiple frontend IP configurations (currently simplified to single frontend)
- **Gateway Load Balancer Chaining:** Transparent NVA injection via GWLB for layer 4 packet forwarding
- **Cross-Region Global LB:** Traffic distribution algorithm details for Global tier (metadata-only in v1)
- **Admin State Management:** Maintenance mode and health probe override mechanisms
- **IPv6 / Dual-Stack:** IPv6 address family and mixed IPv4/IPv6 configurations
- **HA Ports:** Standard LB layer 4 all-ports load balancing for NVA deployments
- **Multiple Backend Pools:** Dynamic creation of multiple named backend pools via UI

**Key Invariants:**

- Load Balancer SKU must be Standard or Gateway (error if Basic attempted)
- Public frontends require Standard SKU public IP with Static allocation
- Internal frontends require subnet membership with optional static private IP
- Health probe intervals must be 5-300 seconds; numberOfProbes ≥ 1
- Load balancing rule ports must be 1-65535
- Zone redundancy of 2+ availability zones recommended for production (Well-Architected)
- Backend pool size ≤ 5,000 endpoints per Standard LB (per Azure limit)
- Idle timeout range 4-30 minutes (default 4 minutes per Azure)
