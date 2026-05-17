## Azure Kubernetes Service (AKS) Component Specification

**Overview:**  
Azure Kubernetes Service (AKS) is a managed Kubernetes container orchestration service that simplifies deploying and managing Kubernetes clusters in Azure. AKS abstracts the complexity of Kubernetes control plane management while providing a production-ready environment for container workloads. AKS clusters are deployed into a VNet subnet, integrate with Azure security policies (NSGs, UDRs), and support advanced networking (Azure CNI, network policies), identity (managed identities, RBAC), and observability (Container Insights).

**Kubernetes Version Support Policy:**  
Azure follows an N-2 major version support window (where N is the latest GA release). As of May 2026, supported versions are 1.28 through 1.35. Versions outside this window are unsupported; simulator enforces this range at validation time. Users are encouraged via warnings to upgrade to the latest GA version for security patches and feature access.

**Core Concepts - Node Pools:**

AKS clusters have two categories of node pools:

1. **System Node Pool**: Mandatory, managed by Azure. Runs critical Kubernetes system components (API server, etcd, coredns, etc.). Minimum 3 nodes recommended for production reliability. Automatically labeled with `workload.azure.com/scale-down-enabled=true` and taint `CriticalAddonsOnly=NoSchedule`. User workloads cannot run on system pool (unless explicitly allowed via taint toleration).

2. **User Node Pool(s)**: Optional, managed by cluster autoscaler. Runs customer application workloads. Minimum 2 nodes recommended for high availability; 3+ for production. Can be auto-scaled based on resource requests (horizontal pod autoscaling via metrics server + cluster autoscaler).

**Data Model** (`AksComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | User-defined cluster name |
| `type` | `AKS` | ✓ | Enum value |
| `description` | string | — | Optional |
| **Core Cluster** | | | |
| `kubernetesVersion` | string | ✓ | Must be one of: 1.28, 1.29, 1.30, 1.31, 1.32, 1.33, 1.34, 1.35 (N-2 support) |
| `subnetId` | string | ✓ | VNet Subnet where cluster nodes are deployed; must have sufficient IP space (e.g., /24 or larger) |
| `networkPlugin` | 'kubenet' \| 'azure' \| 'azure-overlay' | ✓ | **kubenet**: Simple overlay networking (Linux-only, basic). **azure**: Azure CNI with IPAM (recommended). **azure-overlay**: Azure CNI overlay for pod IP flexibility |
| `apiServerAccess` | 'Public' \| 'Private' | ✓ | **Public**: Exposed to internet (lockable via `apiServerAuthorizedIpRanges`). **Private**: Accessible only via VNet (recommended for production) |
| `pricingTier` | 'Free' \| 'Standard' \| 'Premium' | — | Default: 'Standard'. **Free**: No SLA, dev/test only. **Standard**: 99.95% SLA. **Premium**: 99.99% SLA (zone-redundant) |
| **System Node Pool** | | | |
| `systemNodePoolSize` | number | — | Node count (1-1000); minimum 3 recommended for production. Controls system component replication and availability |
| `systemNodePoolVmSku` | string | — | VM SKU (e.g., 'Standard_D2d_v5'). Should be cost-effective but sufficient for system load (recommend D2d+) |
| **User Node Pool** | | | |
| `nodeCount` | number | — | Initial node count (1-1000); minimum 2 recommended for HA, 3+ for production |
| `nodeVmSize` | string | — | VM SKU for user workloads (e.g., 'Standard_D4s_v5'). Minimum D2s_v3 or equivalent; larger for production apps |
| `enableClusterAutoscaler` | boolean | — | Default: true. Enables automatic horizontal scaling based on pod resource requests. Scaler respects min/max bounds |
| `minNodeCount` | number | — | Minimum nodes when autoscaler enabled (1-1000); typically 2-3 |
| `maxNodeCount` | number | — | Maximum nodes when autoscaler enabled (1-1000); typically 5-20 or higher for large workloads |
| **Availability & Resilience** | | | |
| `availabilityZones` | string[] | — | Zone IDs (1, 2, 3) for zone-redundant deployment. 2+ zones: 99.99% SLA. Empty or 1 zone: 99.95% SLA |
| **OS & Image** | | | |
| `osSku` | 'Ubuntu' \| 'AzureLinux' \| 'Windows2022' | — | Default: 'Ubuntu'. **Ubuntu**: Ubuntu 22.04 LTS. **AzureLinux**: Azure-optimized Linux. **Windows2022**: Windows Server 2022 (requires Azure CNI) |
| `osVersion` | string | — | Version string (e.g., '22.04' for Ubuntu) |
| **Security & Policies** | | | |
| `enableRbac` | boolean | — | Default: true (mandatory per Azure best practice). Enables Kubernetes RBAC for authentication/authorization |
| `enablePrivateCluster` | boolean | — | Default: false; recommend: true. Private cluster restricts API server to VNet only (prevents public internet exposure) |
| `enableNetworkPolicy` | boolean | — | Default: false. Enables network policies for microsegmentation (Azure NPM or Calico) |
| `networkPolicyProvider` | 'azure' \| 'calico' | — | If `enableNetworkPolicy=true`, provider for network policies (Azure NPM default, Calico for complex rules) |
| `apiServerAuthorizedIpRanges` | string[] | — | CIDR blocks (e.g., ['203.0.113.0/24']) allowed to access public API server; empty = unrestricted |
| `enableManagedIdentity` | boolean | — | Default: true (recommended). Uses managed identity for cluster-to-Azure authentication (replaces service principal) |
| **Networking** | | | |
| `outboundType` | 'loadBalancer' \| 'userDefinedRouting' \| 'managedNAT' | — | Default: 'loadBalancer'. How cluster egress is routed: LB NAT pool, UDR + NVA, or managed NAT gateway |
| `loadBalancerSku` | 'Standard' \| 'Basic' | — | Default: 'Standard'. **Standard**: Zone-redundant, public IP required. **Basic**: Single zone (deprecated; avoid) |
| `dnsPrefix` | string | — | Optional. Azure-managed FQDN prefix: `{dnsPrefix}.{region}.cloudapp.azure.com` |
| `serviceCidr` | string | — | Optional. Kubernetes service IP range (default 10.0.0.0/16). Must not overlap with node subnet or peered VNets |
| `dnsServiceIp` | string | — | Optional. Kubernetes DNS service IP within `serviceCidr` (default 10.0.0.10) |
| `dockerBridgeCidr` | string | — | Optional. Docker bridge network CIDR on nodes (default 172.17.0.1/16) |
| **Monitoring & Operations** | | | |
| `enableMonitoring` | boolean | — | Default: true. Enables Container Insights (Azure Monitor integration for logs, metrics, alerts) |
| `monitoringWorkspaceId` | string | — | Log Analytics workspace ID for Container Insights ingestion (optional if monitoring enabled) |

**Validation Rules (`validateCompute` AKS section in `componentValidators.ts`):**

| Rule | Severity | Details |
|---|---|---|
| `kubernetesVersion` must be 1.28-1.35 | Error | Enforces N-2 support window; prevents unsupported versions |
| `subnetId` must exist | Error | Referenced subnet must be present in diagram |
| `nodeCount` must be 1-1000 | Error | Respects Azure scaling limits |
| `systemNodePoolSize` must be 1-1000 | Error | System pool size validation |
| Autoscaler: `minNodeCount` ≤ `maxNodeCount` | Error | Both must be in 1-1000 range; min ≤ max |
| `networkPlugin` valid value | Error | Must be kubenet, azure, or azure-overlay |
| `apiServerAccess` valid value | Error | Must be Public or Private |
| `pricingTier` valid value | Error | Must be Free, Standard, or Premium (if set) |
| `nodeCount` < 2 | Warning | Recommend 2-3 nodes for HA; alert if below 2 |
| `systemNodePoolSize` < 3 | Warning | Recommend 3 nodes for system pool reliability |
| `enableClusterAutoscaler=false` | Warning | Recommend autoscaler for production workloads |
| `availabilityZones` < 2 zones | Warning | Recommend 2+ zones for 99.99% SLA vs 99.95% |
| `availabilityZones` empty or unset | Warning | Zone-unaware cluster; recommend zones for reliability |
| `apiServerAccess='Public'` | Warning | Public API server increases attack surface; private recommended |
| `enableNetworkPolicy=false` | Warning | Network policies recommended for security microsegmentation |
| `enableMonitoring=false` | Warning | Monitoring recommended for observability and troubleshooting |
| `pricingTier='Free'` | Warning | Free tier no SLA; recommend Standard for production |
| `kubernetesVersion` not latest GA | Warning | Encourage upgrade for security patches and features |
| `networkPlugin='kubenet'` | Warning | Kubenet is basic; Azure CNI recommended for production |
| `nodeVmSize` too small (e.g., D2s_v3) | Warning | Recommend D2s_v3+ or larger for node capacity |
| `enableRbac=false` | Warning | RBAC is required; must be enabled |

**Form Behavior (`ComputeForm.vue` AKS section):**

- **Basic Configuration**: Kubernetes version selector (dropdown: 1.35...1.28), pricing tier selector (Standard/Free/Premium with SLA info)
- **Cluster Networking**: Network plugin selector, API server access (Public/Private), subnet selector (required)
- **Node Pools**: System node pool fieldset (size, VM SKU) + User node pool fieldset (initial count, VM size)
- **Autoscaling & Scaling**: Toggle for `enableClusterAutoscaler`, conditional min/max node fields
- **Availability & Resilience**: Availability zones input (comma-separated, parsed to array)
- **Security & Policies**: RBAC toggle (enabled), Private Cluster toggle, Network Policies toggle + provider dropdown, API Server IP ranges
- **OS & Image**: OS SKU selector, OS version input
- **Monitoring & Operations**: Monitoring toggle + conditional Log Analytics workspace ID field, Managed Identity toggle
- **Advanced (collapsible)**: Outbound type, Load Balancer SKU, DNS Prefix, Service/DNS Service/Docker Bridge CIDR

**Azure Alignment:**

- ✓ N-2 Kubernetes version support window (1.28-1.35)
- ✓ System + user node pool architecture
- ✓ Cluster autoscaler with 1-1000 scaling bounds
- ✓ Availability zones for zone redundancy (99.99% SLA)
- ✓ Pricing tiers (Free, Standard, Premium) with SLA characteristics
- ✓ Network plugin constraints (kubenet Linux-only, Azure CNI for Windows/advanced networking)
- ✓ Private cluster support (API server VNet integration)
- ✓ Network policies (Azure NPM, Calico)
- ✓ Outbound traffic type (loadBalancer, UDR, managedNAT)
- ✓ OS support (Ubuntu, AzureLinux, Windows2022)
- ✓ Container Insights monitoring integration
- ✓ Managed Identity (RBAC-based workload authentication)

**Key Integration Points:**

- **Layer Classification**: AKS always `vnet` layer in `getComponentLayer()` (deployed in subnet, VNet-scoped)
- **Node Rendering**: Renders as `compute-node` type; displays detail "N nodes - K8s vX.Y.Z"
- **Subnet Integration**: Node IP space consumed from referenced subnet; recommend /24 or larger
- **Test Integration**: Inbound reachability tests can target AKS ingress (e.g., port 80 on ingress controller)
- **Sample Diagram**: Full sample includes AKS cluster with Standard pricing, Private API, Azure CNI, zones 1,2,3, autoscaling

**Do NOT:**

- Remove node pool architecture (system vs user distinction is mandatory)
- Allow K8s versions outside N-2 support window (security/support critical)
- Skip network plugin validation for OS compatibility (Windows + kubenet must error)
- Merge system/user node pools into single concept
- Support K8s versions < 1.28 or > 1.35 without explicit update
- Allow RBAC to be disabled
- Skip zone redundancy warnings (critical for SLA awareness)

**Future Enhancements (Out of Scope):**

- Multiple user node pools with distinct autoscaling policies
- Spot node pools for cost optimization
- Node auto-upgrade configuration
- Advanced networking (IPv6 dual-stack, custom CNI)
- Workload identity federation
- AKS Automatic mode support
- Multi-region deployments
- Persistent volume/storage integration
- Container Registry integration
- Azure Policy compliance monitoring
