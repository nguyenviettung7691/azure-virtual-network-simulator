export enum NetworkComponentType {
  VNET = 'VNET',
  SUBNET = 'SUBNET',
  NETWORK_IC = 'NETWORK_IC',
  NSG = 'NSG',
  ASG = 'ASG',
  IP_ADDRESS = 'IP_ADDRESS',
  DNS_ZONE = 'DNS_ZONE',
  VNET_PEERING = 'VNET_PEERING',
  UDR = 'UDR',
  VPN_GATEWAY = 'VPN_GATEWAY',
  APP_GATEWAY = 'APP_GATEWAY',
  NVA = 'NVA',
  LOAD_BALANCER = 'LOAD_BALANCER',
  VM = 'VM',
  VMSS = 'VMSS',
  AKS = 'AKS',
  APP_SERVICE = 'APP_SERVICE',
  FUNCTIONS = 'FUNCTIONS',
  STORAGE_ACCOUNT = 'STORAGE_ACCOUNT',
  BLOB_STORAGE = 'BLOB_STORAGE',
  MANAGED_DISK = 'MANAGED_DISK',
  KEY_VAULT = 'KEY_VAULT',
  MANAGED_IDENTITY = 'MANAGED_IDENTITY',
  SERVICE_ENDPOINT = 'SERVICE_ENDPOINT',
  PRIVATE_ENDPOINT = 'PRIVATE_ENDPOINT',
  FIREWALL = 'FIREWALL',
  BASTION = 'BASTION',
  INTERNET = 'INTERNET',
  NAT_GATEWAY = 'NAT_GATEWAY',
}
/**
 * Azure NAT Gateway Component
 * See: https://docs.azure.cn/en-us/nat-gateway/nat-gateway-resource
 */
export interface NatGatewayComponent extends NetworkComponent {
  type: NetworkComponentType.NAT_GATEWAY
  sku: 'Standard'
  publicIpIds?: string[] // Up to 2 Public IPs (Standard SKU only)
  publicIpPrefixIds?: string[] // Up to 2 Public IP Prefixes (Standard SKU only)
  subnetIds?: string[] // Up to 16 subnets, each subnet can only be associated with one NAT Gateway
  idleTimeoutInMinutes?: number // 4-120 minutes, default 4
  availabilityZones?: string[] // Zone IDs: '1', '2', '3'
}

/**
 * Managed Disk Type enum (all 5 Azure disk types)
 */
export enum ManagedDiskType {
  ULTRA = 'Ultra',
  PREMIUM_SSD_V2 = 'Premium_SSD_v2',
  PREMIUM_SSD = 'Premium_SSD',
  STANDARD_SSD = 'Standard_SSD',
  STANDARD_HDD = 'Standard_HDD',
}

/**
 * Managed Disk Redundancy enum (LRS or ZRS)
 */
export enum ManagedDiskRedundancy {
  LRS = 'LRS',
  ZRS = 'ZRS',
}

/**
 * Managed Disk Role enum (OS or Data)
 */
export enum ManagedDiskRole {
  OS = 'OS',
  DATA = 'DATA',
}

/**
 * Managed Disk type constraints: which redundancy options are supported per disk type
 */
export const MANAGED_DISK_REDUNDANCY_BY_TYPE: Record<ManagedDiskType, ManagedDiskRedundancy[]> = {
  [ManagedDiskType.ULTRA]: [ManagedDiskRedundancy.LRS],
  [ManagedDiskType.PREMIUM_SSD_V2]: [ManagedDiskRedundancy.LRS],
  [ManagedDiskType.PREMIUM_SSD]: [ManagedDiskRedundancy.LRS, ManagedDiskRedundancy.ZRS],
  [ManagedDiskType.STANDARD_SSD]: [ManagedDiskRedundancy.LRS, ManagedDiskRedundancy.ZRS],
  [ManagedDiskType.STANDARD_HDD]: [ManagedDiskRedundancy.LRS],
}

/**
 * Managed Disk size constraints (min and max GiB per disk type)
 */
export const MANAGED_DISK_SIZE_LIMITS: Record<ManagedDiskType, { min: number; max: number }> = {
  [ManagedDiskType.ULTRA]: { min: 4, max: 65536 },
  [ManagedDiskType.PREMIUM_SSD_V2]: { min: 1, max: 65536 },
  [ManagedDiskType.PREMIUM_SSD]: { min: 4, max: 32767 },
  [ManagedDiskType.STANDARD_SSD]: { min: 4, max: 32767 },
  [ManagedDiskType.STANDARD_HDD]: { min: 4, max: 32767 },
}

/**
 * Disk types that can be used as OS disks
 */
export const MANAGED_DISK_OS_COMPATIBLE: ManagedDiskType[] = [
  ManagedDiskType.PREMIUM_SSD,
  ManagedDiskType.STANDARD_SSD,
  ManagedDiskType.STANDARD_HDD,
]

export interface NetworkComponent {
  id: string
  name: string
  type: NetworkComponentType
  description?: string
  tags?: Record<string, string>
  createdAt: string
  parentId?: string
}

export interface InternetComponent extends NetworkComponent {
  type: NetworkComponentType.INTERNET
  systemManaged: true
}

export interface VNetComponent extends NetworkComponent {
  type: NetworkComponentType.VNET
  addressSpace: string[]
  dnsServers?: string[]
  enableDdosProtection?: boolean
  enableVmProtection?: boolean
  region: string
  resourceGroup: string
}

export interface SubnetComponent extends NetworkComponent {
  type: NetworkComponentType.SUBNET
  addressPrefix: string
  addressPrefixIPv6?: string
  vnetId: string
  nsgId?: string
  routeTableId?: string
  natGatewayId?: string
  serviceEndpoints?: string[]
  delegations?: string[]
  privateEndpointNetworkPolicies?: 'Enabled' | 'Disabled'
  privateSubnet?: boolean
}

export interface NsgComponent extends NetworkComponent {
  type: NetworkComponentType.NSG
  securityRules: NsgRule[]
  subnetIds?: string[]
  nicIds?: string[]
}

export interface NsgRule {
  id: string
  name: string
  priority: number
  direction: 'Inbound' | 'Outbound'
  access: 'Allow' | 'Deny'
  protocol: 'Tcp' | 'Udp' | 'Icmp' | '*'
  sourceAddressPrefix: string
  sourcePortRange: string
  destinationAddressPrefix: string
  destinationPortRange: string
  description?: string
  // Optional type specifiers for source/destination (defaults to 'IpCidr' for backward compatibility)
  sourceType?: 'IpCidr' | 'ServiceTag' | 'Asg'
  destinationType?: 'IpCidr' | 'ServiceTag' | 'Asg'
  // Optional ASG references when sourceType='Asg' or destinationType='Asg'
  sourceAsgId?: string
  destinationAsgId?: string
}

export interface AsgComponent extends NetworkComponent {
  type: NetworkComponentType.ASG
  nicIds?: string[]
}

export interface IpAddressComponent extends NetworkComponent {
  type: NetworkComponentType.IP_ADDRESS
  ipAddress?: string
  allocationMethod: 'Static' | 'Dynamic'
  sku: 'Standard' | 'Standard_v2'  // Basic SKU retired Sep 30, 2025
  tier?: 'Regional' | 'Global'     // Regional (default) or Global for cross-region LBs
  ipVersion: 'IPv4' | 'IPv6'
  associatedTo?: string
  dnsLabel?: string
  availabilityZones?: string[]      // Zone IDs: '1', '2', '3'; Standard_v2 always zone-redundant
  routingPreference?: 'Internet' | 'Microsoft'  // Standard only; not supported on Standard_v2
}

export interface DnsZoneComponent extends NetworkComponent {
  type: NetworkComponentType.DNS_ZONE
  zoneName: string
  zoneType: 'Public' | 'Private'
  vnetLinks?: string[]
  recordSets?: DnsRecord[]
  metadata?: Record<string, string>
}

export interface DnsRecord {
  name: string
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'PTR' | 'SRV' | 'TXT' | 'CAA' | 'NS' | 'SOA' | 'SPF' | 'DS' | 'TLSA'
  ttl: number
  values: string[]
  metadata?: Record<string, string>
}

export interface VnetPeeringComponent extends NetworkComponent {
  type: NetworkComponentType.VNET_PEERING
  localVnetId: string
  remoteVnetId: string
  allowVirtualNetworkAccess: boolean
  allowForwardedTraffic: boolean
  allowGatewayTransit: boolean
  useRemoteGateways: boolean
  peeringState?: 'Connected' | 'Disconnected' | 'Initiated'
}

export interface UdrComponent extends NetworkComponent {
  type: NetworkComponentType.UDR
  routes: UdrRoute[]
  subnetIds?: string[]
  disableBgpRoutePropagation?: boolean
}

export interface UdrRoute {
  id: string
  name: string
  addressPrefix: string
  nextHopType: 'VirtualNetworkGateway' | 'VnetLocal' | 'Internet' | 'VirtualAppliance' | 'None'
  nextHopResourceId?: string
  nextHopIpAddress?: string
}

export interface VpnGatewayComponent extends NetworkComponent {
  type: NetworkComponentType.VPN_GATEWAY
  sku: 'Basic' | 'VpnGw1' | 'VpnGw2' | 'VpnGw3' | 'VpnGw4' | 'VpnGw5' | 'VpnGw1AZ' | 'VpnGw2AZ' | 'VpnGw3AZ' | 'VpnGw4AZ' | 'VpnGw5AZ'
  vpnType: 'PolicyBased' | 'RouteBased'
  vpnGatewayGeneration?: 'Generation1' | 'Generation2' // Optional; inferred from SKU if omitted
  enableBgp?: boolean
  activeActive?: boolean
  availabilityZones?: string[] // e.g., ['1', '2', '3'] for zone-redundant deployment
  bgpSettings?: {
    asn?: number // Border Gateway Protocol ASN
    bgpPeeringAddress?: string // BGP peering address
    bgpPeeringAddressForIPv6?: string // BGP peering address for IPv6
  }
  gatewayIpId?: string
  subnetId?: string
}

export interface AppGatewayComponent extends NetworkComponent {
  type: NetworkComponentType.APP_GATEWAY
  sku: 'Standard_v2' | 'WAF_v2'
  tier: 'Standard_v2' | 'WAF_v2'
  capacity: number
  minInstances?: number // 1-125; for autoscaling
  maxInstances?: number // 1-125; for autoscaling
  idleTimeoutInMinutes?: number // 4-30 minutes
  enableHttp2?: boolean
  enableWaf?: boolean
  wafMode?: 'Detection' | 'Prevention'
  enableMutualAuthentication?: boolean // mTLS (v2 feature)
  frontendType: 'Public' | 'Internal'
  frontendIpId?: string
  subnetId?: string
  availabilityZones?: string[] // e.g., ['1', '2', '3'] for zone-redundant deployment
  keyVaultCertificateId?: string // Legacy compatibility field; stores the resolved Key Vault secret URI when structured fields are set
  keyVaultId?: string
  keyVaultCertificateName?: string
  keyVaultCertificateVersion?: string
  keyVaultManagedIdentityId?: string
  backendPools?: string[]
  healthProbes?: HealthProbe[]
  loadBalancingRules?: LoadBalancingRule[]
}

export interface NvaComponent extends NetworkComponent {
  type: NetworkComponentType.NVA
  nvaRole?: 'Firewall' | 'SDWAN' | 'VPN' | 'Proxy' | 'Other'
  vmSize: string
  publisher: string
  offer: string
  sku: string
  version: string
  haMode?: 'Single' | 'ActiveActive' | 'ActiveStandby'
  availabilityZones?: string[] // e.g., ['1', '2', '3'] for zone-redundant deployment
  publicIpId?: string
  subnetId?: string
  enableIpForwarding?: boolean
}

/**
 * Azure Load Balancer Component
 * Note: Basic SKU was retired September 30, 2025; only Standard and Gateway SKUs are supported.
 * For Azure alignment and Well-Architected best practices, use Standard SKU for production workloads.
 */
export interface LoadBalancerComponent extends NetworkComponent {
  type: NetworkComponentType.LOAD_BALANCER
  sku: 'Standard' | 'Gateway'
  tier: 'Regional' | 'Global'
  loadBalancerType: 'Public' | 'Internal'
  availabilityZones?: string[] // Zone IDs: '1', '2', '3' for zone redundancy
  idleTimeoutInMinutes?: number // 4-30 minute range for TCP idle timeout
  frontendIpConfigs?: LoadBalancerFrontend[]
  backendPools?: LoadBalancerBackendPool[]
  loadBalancingRules?: LoadBalancingRule[]
  healthProbes?: HealthProbe[]
}

export interface LoadBalancerFrontend {
  id: string
  name: string
  publicIpId?: string
  subnetId?: string
  privateIpAddress?: string
}

export interface LoadBalancerBackendPool {
  id: string
  name: string
  nicIds?: string[]
}

export interface LoadBalancingRule {
  id: string
  name: string
  protocol: 'Tcp' | 'Udp' | 'All'
  frontendPort: number
  backendPort: number
  frontendIpId: string
  backendPoolId: string
  probeId?: string
  enableFloatingIp?: boolean
  idleTimeoutInMinutes?: number
}

export interface HealthProbe {
  id: string
  name: string
  protocol: 'Http' | 'Https' | 'Tcp'
  port: number
  intervalInSeconds: number
  numberOfProbes: number
  requestPath?: string
}

export interface NetworkICComponent extends NetworkComponent {
  type: NetworkComponentType.NETWORK_IC
  privateIpAddress?: string
  privateIpAllocationMethod: 'Static' | 'Dynamic'
  subnetId?: string
  publicIpId?: string
  nsgId?: string
  asgIds?: string[]
  dnsServers?: string[]
  enableAcceleratedNetworking?: boolean
  enableIpForwarding?: boolean
}

export interface VmComponent extends NetworkComponent {
  type: NetworkComponentType.VM
  size: string
  os: 'Windows' | 'Linux'
  imagePublisher: string
  imageOffer: string
  imageSku: string
  adminUsername: string
  subnetId?: string
  nicIds?: string[]
  availabilityZone?: '1' | '2' | '3'
  diskType?: 'Standard_LRS' | 'Premium_LRS' | 'StandardSSD_LRS'
  enableManagedIdentity?: boolean
  userAssignedIdentityIds?: string[]
}

export interface VmssComponent extends NetworkComponent {
  type: NetworkComponentType.VMSS
  sku: string
  capacity: number
  os: 'Windows' | 'Linux'
  orchestrationMode: 'Flexible' | 'Uniform'
  imagePublisher: string
  imageOffer: string
  imageSku: string
  subnetId?: string
  upgradePolicy?: 'Automatic' | 'Manual' | 'Rolling'
  autoscaleEnabled?: boolean
  minCapacity?: number
  maxCapacity?: number
  availabilityZones?: string[]
  scaleInPolicy?: 'FIFO' | 'OldestVM' | 'NewestVM'
  overprovision?: boolean
  enableManagedIdentity?: boolean
  userAssignedIdentityIds?: string[]
}

export interface AksComponent extends NetworkComponent {
  type: NetworkComponentType.AKS
  // Core cluster configuration
  kubernetesVersion: string // Must be N-2 or N: 1.28-1.35 (per Azure support window)
  subnetId?: string // Required for production
  networkPlugin: 'kubenet' | 'azure' | 'azure-overlay' // azure/overlay for production
  apiServerAccess: 'Public' | 'Private' // Private recommended
  pricingTier?: 'Free' | 'Standard' | 'Premium' // Default: Standard
  // System node pool
  systemNodePoolSize?: number // Min 3 recommended; includes system components
  systemNodePoolVmSku?: string // e.g., 'Standard_D2d_v5'
  // User node pool configuration
  nodeCount?: number // Initial node count (user pool)
  nodeVmSize?: string // User node pool VM size
  enableClusterAutoscaler?: boolean // Default: true
  minNodeCount?: number // Min 1-2; if autoscaler enabled
  maxNodeCount?: number // Max 1-1000; if autoscaler enabled
  // Availability & resilience
  availabilityZones?: string[] // e.g., ['1','2','3'] for zone redundancy
  // OS & image configuration
  osSku?: 'Ubuntu' | 'AzureLinux' | 'Windows2022' // Default: Ubuntu
  osVersion?: string // e.g., '22.04' for Ubuntu
  // Security & policies
  enableRbac?: boolean // Default: true; recommended always ON
  enablePrivateCluster?: boolean // Recommended: true
  enableNetworkPolicy?: boolean // Default: false; recommend: true
  networkPolicyProvider?: 'azure' | 'calico' // If enableNetworkPolicy true
  apiServerAuthorizedIpRanges?: string[] // For public cluster lockdown
  // Networking & ingress
  outboundType?: 'loadBalancer' | 'userDefinedRouting' | 'managedNAT' // Default: loadBalancer
  loadBalancerSku?: 'Basic' | 'Standard' // Default: Standard
  dnsPrefix?: string // Optional; for FQDN
  serviceCidr?: string // Optional; default 10.0.0.0/16
  dnsServiceIp?: string // Optional; default 10.0.0.10
  dockerBridgeCidr?: string // Optional; for advanced networking
  // Monitoring & operations
  enableMonitoring?: boolean // Default: true; enables Container Insights
  monitoringWorkspaceId?: string // Log Analytics workspace ID
  enableManagedIdentity?: boolean // Default: true; recommended
  userAssignedIdentityIds?: string[] // User-assigned managed identities
}

export interface AppServiceComponent extends NetworkComponent {
  type: NetworkComponentType.APP_SERVICE
  // Plan & Tier (pricing tier determines features and scale-out)
  sku: 'F1' | 'D1' | 'B1' | 'B2' | 'B3' | 'S1' | 'S2' | 'S3' | 'P1v2' | 'P2v2' | 'P3v2' | 'P1v3' | 'P2v3' | 'P3v3' | 'P1v4' | 'P2v4' | 'P3v4' | 'I1v2' | 'I2v2' | 'I3v2'
  tier: 'Free' | 'Shared' | 'Basic' | 'Standard' | 'Premium' | 'PremiumV2' | 'PremiumV3' | 'PremiumV4' | 'Isolated' | 'IsolatedV2'
  os: 'Windows' | 'Linux'
  // Runtime & Workload
  runtimeStack?: string // e.g., "DOTNET|8.0", "NODE|20-lts", "PYTHON|3.11", "JAVA|21-java21"
  // Networking
  vnetIntegrationSubnetId?: string // VNet integration for outbound access
  enablePrivateEndpoint?: boolean // Private Link support
  privateEndpointId?: string // Reference to private endpoint if enabled
  ipRestrictions?: Array<{ ipAddress: string; priority?: number; action?: 'Allow' | 'Deny' }> // IP access restrictions
  customDomain?: string
  // Security & TLS
  enableHttps?: boolean // Force HTTPS redirect
  minTlsVersion?: '1.0' | '1.1' | '1.2' | '1.3' // Minimum TLS version; recommend 1.2+
  enableManagedIdentity?: boolean // Enable system-assigned managed identity
  userAssignedIdentityIds?: string[] // User-assigned managed identities
  // Authentication & Authorization
  enableEasyAuth?: boolean // Built-in authentication/authorization
  easyAuthProvider?: 'AzureAD' | 'Microsoft' | 'Google' | 'Facebook' | 'X'
  // Monitoring & Diagnostics
  enableDiagnosticLogging?: boolean // Enable diagnostic logs (app logs, web server logs, failed requests)
  applicationInsightsResourceId?: string // Log Analytics workspace or Application Insights resource
  enableHealthCheck?: boolean
  healthCheckPath?: string // Path for health check probe (e.g., /health)
  // Key Vault integration
  keyVaultSecretUri?: string // Legacy compatibility field; stores the resolved Key Vault secret URI when structured fields are set
  keyVaultId?: string
  keyVaultSecretName?: string
  keyVaultSecretVersion?: string
}

export interface FunctionsComponent extends NetworkComponent {
  type: NetworkComponentType.FUNCTIONS
  // Hosting model (Azure Functions-native)
  hostingOption?: 'FlexConsumption' | 'Premium' | 'Dedicated' | 'ContainerApps' | 'Consumption'
  planSku?: 'FC1' | 'Y1' | 'EP1' | 'EP2' | 'EP3' | 'B1' | 'B2' | 'B3' | 'S1' | 'S2' | 'S3' | 'P1v2' | 'P2v2' | 'P3v2' | 'P1v3' | 'P2v3' | 'P3v3' | 'P1v4' | 'P2v4' | 'P3v4' | 'I1v2' | 'I2v2' | 'I3v2'
  os?: 'Windows' | 'Linux'
  // Legacy compatibility fields (read/write for older saved setups)
  tier?: 'Free' | 'Shared' | 'Basic' | 'Standard' | 'Premium' | 'PremiumV2' | 'PremiumV3' | 'PremiumV4' | 'Isolated' | 'IsolatedV2'
  hostingPlanSku?: 'Y1' | 'EP1' | 'EP2' | 'EP3' | 'B1' | 'B2' | 'B3' | 'S1' | 'S2' | 'S3' | 'P1v2' | 'P2v2' | 'P3v2' | 'P1v3' | 'P2v3' | 'P3v3' | 'P1v4' | 'P2v4' | 'P3v4' | 'I1v2' | 'I2v2' | 'I3v2'
  // Runtime & Workload
  runtimeStack: 'dotnet' | 'node' | 'python' | 'java' | 'powershell'
  runtimeVersion: string // e.g., "8.0", "20", "3.11", "21", "7.4"
  storageAccountId?: string // Required storage account for function code/state
  // Networking
  vnetIntegrationSubnetId?: string
  enablePrivateEndpoint?: boolean
  privateEndpointId?: string
  ipRestrictions?: Array<{ ipAddress: string; priority?: number; action?: 'Allow' | 'Deny' }>
  // Security & TLS
  enableHttps?: boolean
  minTlsVersion?: '1.0' | '1.1' | '1.2' | '1.3'
  enableManagedIdentity?: boolean
  userAssignedIdentityIds?: string[]
  // Authentication & Authorization (less common for Functions but supported)
  enableEasyAuth?: boolean
  easyAuthProvider?: 'AzureAD' | 'Microsoft' | 'Google' | 'Facebook' | 'X'
  // Monitoring & Diagnostics
  enableDiagnosticLogging?: boolean
  applicationInsightsResourceId?: string
  // Key Vault integration
  keyVaultSecretUri?: string
  keyVaultId?: string
  keyVaultSecretName?: string
  keyVaultSecretVersion?: string
}

export interface StorageAccountComponent extends NetworkComponent {
  type: NetworkComponentType.STORAGE_ACCOUNT
  accountKind: 'BlobStorage' | 'BlockBlobStorage' | 'FileStorage' | 'Storage' | 'StorageV2'
  replication: 'LRS' | 'GRS' | 'RAGRS' | 'ZRS' | 'GZRS' | 'RAGZRS'
  accessTier?: 'Hot' | 'Cool' | 'Archive'
  // Security settings
  enableHttpsOnly?: boolean
  minTlsVersion?: 'TLS1_0' | 'TLS1_1' | 'TLS1_2'
  allowBlobPublicAccess?: boolean
  allowSharedKeyAccess?: boolean // Default true for compatibility; false disables shared key + SAS authorization
  allowPublicEndpoint?: boolean // Default true; false disables public endpoint entirely (requires private endpoints)
  // Networking
  networkDefaultAction?: 'Allow' | 'Deny'
  virtualNetworkRules?: string[]
  ipRules?: string[]
  // Data protection
  enableSoftDelete?: boolean // Allows recovery of deleted containers/blobs within retention period
  softDeleteRetentionDays?: number // 1-365 days; recommended minimum 7 days
}

export interface ManagedDiskComponent extends NetworkComponent {
  type: NetworkComponentType.MANAGED_DISK
  diskType: ManagedDiskType
  redundancy: ManagedDiskRedundancy
  diskRole: ManagedDiskRole
  diskSizeGb: number
  osType?: 'Windows' | 'Linux'
  attachedToVmId?: string
  iops?: number
  throughput?: number
  // Backward compatibility: legacy sku field (will be normalized on load)
  sku?: 'Standard_LRS' | 'Premium_LRS' | 'Premium_ZRS' | 'StandardSSD_LRS' | 'StandardSSD_ZRS' | 'UltraSSD_LRS' | 'PremiumV2_LRS'
}

export interface KeyVaultComponent extends NetworkComponent {
  type: NetworkComponentType.KEY_VAULT
  sku: 'Standard' | 'Premium'
  tenantId?: string
  enableSoftDelete?: boolean
  softDeleteRetentionDays?: number
  enablePurgeProtection?: boolean
  networkDefaultAction?: 'Allow' | 'Deny'
  allowTrustedMicrosoftServices?: boolean
  virtualNetworkRules?: string[]
  ipRules?: string[]
  accessPolicies?: KeyVaultAccessPolicy[]
}

export interface KeyVaultAccessPolicy {
  tenantId: string
  objectId: string
  permissions: {
    keys?: string[]
    secrets?: string[]
    certificates?: string[]
  }
}


/**
 * Azure Managed Identity (User-Assigned or System-Assigned)
 *
 * - System-assigned: created with parent resource, single assignment, lifecycle tied to parent
 * - User-assigned: standalone, reusable, assignable to multiple resources, independent lifecycle
 *
 * Fields:
 *   - identityType: 'SystemAssigned' | 'UserAssigned'
 *   - clientId: Azure application (client) ID (auto-generated by Azure)
 *   - principalId: Service principal object ID in Microsoft Entra ID (auto-generated)
 *   - tenantId: Microsoft Entra tenant ID (required for cross-tenant RBAC)
 *   - resourceId: Azure resource ID (format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/{name})
 *   - isolationScope: 'Regional' | 'None' (user-assigned only; restricts cross-region assignment)
 *   - assignedToId: (system-assigned only) ID of parent resource (VM, App Service, etc.)
 */
export interface ManagedIdentityComponent extends NetworkComponent {
  type: NetworkComponentType.MANAGED_IDENTITY
  identityType: 'SystemAssigned' | 'UserAssigned'
  clientId?: string // Azure application (client) ID
  principalId?: string // Service principal object ID
  tenantId?: string // Microsoft Entra tenant ID
  resourceId?: string // Azure resource ID (user-assigned only)
  isolationScope?: 'Regional' | 'None' // User-assigned only
  assignedToId?: string // System-assigned only: parent resource
}

export interface ServiceEndpointComponent extends NetworkComponent {
  type: NetworkComponentType.SERVICE_ENDPOINT
  // Mirror node for subnet-level service endpoint configuration.
  // Authoritative endpoint configuration is SubnetComponent.serviceEndpoints[].
  service: string
  subnetId?: string
  locations?: string[]
}

export interface PrivateEndpointComponent extends NetworkComponent {
  type: NetworkComponentType.PRIVATE_ENDPOINT
  connectionName: string
  privateLinkServiceId?: string
  groupIds?: string[]
  subnetId?: string
  privateIpAddress?: string
  dnsZoneGroupId?: string
}

export interface FirewallComponent extends NetworkComponent {
  type: NetworkComponentType.FIREWALL
  sku: 'Basic' | 'Standard' | 'Premium'
  vnetId?: string
  publicIpIds?: string[]
  firewallPolicies?: string[]
  threatIntelMode?: 'Alert' | 'Deny' | 'Off'
  // Optional deployment mode and networking
  subnetId?: string // For Forced Tunnel mode (Standard/Premium only)
  availabilityZones?: string[] // AZ names, e.g. ['1', '2', '3']
  forcedTunneling?: boolean // Standard/Premium only; if true, uses management NIC + optional subnet
  // Standard and Premium features
  dnsProxyEnabled?: boolean // Standard/Premium only
  customDnsServers?: string[] // Standard/Premium only; array of IPv4 addresses
  // Premium-only features
  idpsMode?: 'Off' | 'Alert' | 'AlertDeny'
  tlsInspectionEnabled?: boolean
  scaleUnits?: number // Premium only; range 1-100
}

export interface BastionComponent extends NetworkComponent {
  type: NetworkComponentType.BASTION
  sku: 'Developer' | 'Basic' | 'Standard' | 'Premium'
  subnetId?: string                        // Required for Basic+; not applicable to Developer
  publicIpId?: string                      // Required for Basic/Standard/Premium (unless isPrivateOnly); not for Developer
  scaleUnits?: number                      // Fixed 2 for Basic; configurable 2-50 for Standard/Premium; N/A for Developer
  enableTunneling?: boolean                // Standard+ feature; allows SSH/RDP via native client tunneling
  enableIpConnect?: boolean                // Standard+ feature; allows IP-based connections
  enableShareableLink?: boolean             // Standard+ feature; enables shareable links without portal access
  customInboundPorts?: number[]            // Standard+ feature; custom RDP/SSH ports (default 3389, 22)
  isPrivateOnly?: boolean                  // Premium-only; private-only deployment without public IP
  enableSessionRecording?: boolean          // Premium-only; session recording for compliance
  availabilityZones?: string[]             // Optional all SKUs where supported; AZ support varies by region
}

export type AnyNetworkComponent =
  | VNetComponent
  | SubnetComponent
  | NsgComponent
  | AsgComponent
  | IpAddressComponent
  | DnsZoneComponent
  | VnetPeeringComponent
  | UdrComponent
  | VpnGatewayComponent
  | AppGatewayComponent
  | NvaComponent
  | LoadBalancerComponent
  | NetworkICComponent
  | VmComponent
  | VmssComponent
  | AksComponent
  | AppServiceComponent
  | FunctionsComponent
  | StorageAccountComponent
  | ManagedDiskComponent
  | KeyVaultComponent
  | ManagedIdentityComponent
  | ServiceEndpointComponent
  | PrivateEndpointComponent
  | FirewallComponent
  | BastionComponent
  | InternetComponent
  | NatGatewayComponent

export const COMPONENT_COLORS: Record<NetworkComponentType, string> = {
  [NetworkComponentType.VNET]: '#0078d4',
  [NetworkComponentType.SUBNET]: '#50a7f0',
  [NetworkComponentType.NETWORK_IC]: '#005a9e',
  [NetworkComponentType.NSG]: '#d13438',
  [NetworkComponentType.ASG]: '#b4009e',
  [NetworkComponentType.IP_ADDRESS]: '#0099bc',
  [NetworkComponentType.DNS_ZONE]: '#038387',
  [NetworkComponentType.VNET_PEERING]: '#0078d4',
  [NetworkComponentType.UDR]: '#8764b8',
  [NetworkComponentType.VPN_GATEWAY]: '#004578',
  [NetworkComponentType.APP_GATEWAY]: '#0063b1',
  [NetworkComponentType.NVA]: '#6b4226',
  [NetworkComponentType.LOAD_BALANCER]: '#0078d4',
  [NetworkComponentType.VM]: '#107c10',
  [NetworkComponentType.VMSS]: '#107c10',
  [NetworkComponentType.AKS]: '#326ce5',
  [NetworkComponentType.APP_SERVICE]: '#0062ad',
  [NetworkComponentType.FUNCTIONS]: '#7b2fb5',
  [NetworkComponentType.STORAGE_ACCOUNT]: '#0078d4',
  [NetworkComponentType.BLOB_STORAGE]: '#0063b1',
  [NetworkComponentType.MANAGED_DISK]: '#6b4226',
  [NetworkComponentType.KEY_VAULT]: '#c7b130',
  [NetworkComponentType.MANAGED_IDENTITY]: '#b4009e',
  [NetworkComponentType.SERVICE_ENDPOINT]: '#038387',
  [NetworkComponentType.PRIVATE_ENDPOINT]: '#005a9e',
  [NetworkComponentType.FIREWALL]: '#d13438',
  [NetworkComponentType.BASTION]: '#004578',
  [NetworkComponentType.INTERNET]: '#0f6cbd',
  [NetworkComponentType.NAT_GATEWAY]: '#0078d4',
}

export const COMPONENT_ICONS: Record<NetworkComponentType, string> = {
  [NetworkComponentType.VNET]: 'mdi:network',
  [NetworkComponentType.SUBNET]: 'mdi:lan',
  [NetworkComponentType.NETWORK_IC]: 'mdi:ethernet',
  [NetworkComponentType.NSG]: 'mdi:shield-lock',
  [NetworkComponentType.ASG]: 'mdi:account-group',
  [NetworkComponentType.IP_ADDRESS]: 'mdi:ip-network',
  [NetworkComponentType.DNS_ZONE]: 'mdi:dns',
  [NetworkComponentType.VNET_PEERING]: 'mdi:transit-connection',
  [NetworkComponentType.UDR]: 'mdi:routes',
  [NetworkComponentType.VPN_GATEWAY]: 'mdi:vpn',
  [NetworkComponentType.APP_GATEWAY]: 'mdi:application',
  [NetworkComponentType.NVA]: 'mdi:router-network',
  [NetworkComponentType.LOAD_BALANCER]: 'mdi:scale-balance',
  [NetworkComponentType.VM]: 'mdi:server',
  [NetworkComponentType.VMSS]: 'mdi:server-network',
  [NetworkComponentType.AKS]: 'mdi:kubernetes',
  [NetworkComponentType.APP_SERVICE]: 'mdi:web',
  [NetworkComponentType.FUNCTIONS]: 'mdi:function',
  [NetworkComponentType.STORAGE_ACCOUNT]: 'mdi:database',
  [NetworkComponentType.BLOB_STORAGE]: 'mdi:file-multiple',
  [NetworkComponentType.MANAGED_DISK]: 'mdi:harddisk',
  [NetworkComponentType.KEY_VAULT]: 'mdi:key',
  [NetworkComponentType.MANAGED_IDENTITY]: 'mdi:badge-account',
  [NetworkComponentType.SERVICE_ENDPOINT]: 'mdi:connection',
  [NetworkComponentType.PRIVATE_ENDPOINT]: 'mdi:shield-lock-outline',
  [NetworkComponentType.FIREWALL]: 'mdi:wall-fire',
  [NetworkComponentType.BASTION]: 'mdi:castle',
  [NetworkComponentType.INTERNET]: 'mdi:web',
  [NetworkComponentType.NAT_GATEWAY]: 'mdi:network-outline',
}

export function getComponentColor(type: NetworkComponentType): string {
  return COMPONENT_COLORS[type] || '#666666'
}

export function getComponentIcon(type: NetworkComponentType): string {
  return COMPONENT_ICONS[type] || 'mdi:help-circle'
}

export function getComponentLabel(type: NetworkComponentType): string {
  const labels: Record<NetworkComponentType, string> = {
    [NetworkComponentType.VNET]: 'Virtual Network',
    [NetworkComponentType.SUBNET]: 'Subnet',
    [NetworkComponentType.NETWORK_IC]: 'Network Interface',
    [NetworkComponentType.NSG]: 'Network Security Group',
    [NetworkComponentType.ASG]: 'Application Security Group',
    [NetworkComponentType.IP_ADDRESS]: 'Public IP Address',
    [NetworkComponentType.DNS_ZONE]: 'DNS Zone',
    [NetworkComponentType.VNET_PEERING]: 'VNet Peering',
    [NetworkComponentType.UDR]: 'Route Table (UDR)',
    [NetworkComponentType.VPN_GATEWAY]: 'VPN Gateway',
    [NetworkComponentType.APP_GATEWAY]: 'Application Gateway',
    [NetworkComponentType.NVA]: 'Network Virtual Appliance',
    [NetworkComponentType.LOAD_BALANCER]: 'Load Balancer',
    [NetworkComponentType.VM]: 'Virtual Machine',
    [NetworkComponentType.VMSS]: 'VM Scale Set',
    [NetworkComponentType.AKS]: 'AKS Cluster',
    [NetworkComponentType.APP_SERVICE]: 'App Service',
    [NetworkComponentType.FUNCTIONS]: 'Azure Functions',
    [NetworkComponentType.STORAGE_ACCOUNT]: 'Storage Account',
    [NetworkComponentType.BLOB_STORAGE]: 'Blob Storage',
    [NetworkComponentType.MANAGED_DISK]: 'Managed Disk',
    [NetworkComponentType.KEY_VAULT]: 'Key Vault',
    [NetworkComponentType.MANAGED_IDENTITY]: 'Managed Identity',
    [NetworkComponentType.SERVICE_ENDPOINT]: 'Service Endpoint',
    [NetworkComponentType.PRIVATE_ENDPOINT]: 'Private Endpoint',
    [NetworkComponentType.FIREWALL]: 'Azure Firewall',
    [NetworkComponentType.BASTION]: 'Azure Bastion',
    [NetworkComponentType.INTERNET]: 'Public Internet',
    [NetworkComponentType.NAT_GATEWAY]: 'NAT Gateway',
  }
  return labels[type] || type
}

export type ComponentCategory = 'Network' | 'Security' | 'Gateway' | 'Compute' | 'Storage' | 'Identity'

export const COMPONENT_CATEGORY_ORDER: ComponentCategory[] = [
  'Network',
  'Security',
  'Gateway',
  'Compute',
  'Storage',
  'Identity',
]

export const COMPONENTS_BY_CATEGORY: Record<ComponentCategory, NetworkComponentType[]> = {
  Network: [
    NetworkComponentType.VNET,
    NetworkComponentType.SUBNET,
    NetworkComponentType.NETWORK_IC,
    NetworkComponentType.IP_ADDRESS,
    NetworkComponentType.DNS_ZONE,
    NetworkComponentType.VNET_PEERING,
    NetworkComponentType.UDR,
    NetworkComponentType.NAT_GATEWAY,
  ],
  Security: [
    NetworkComponentType.NSG,
    NetworkComponentType.ASG,
    NetworkComponentType.FIREWALL,
    NetworkComponentType.BASTION,
    NetworkComponentType.SERVICE_ENDPOINT,
    NetworkComponentType.PRIVATE_ENDPOINT,
  ],
  Gateway: [
    NetworkComponentType.VPN_GATEWAY,
    NetworkComponentType.APP_GATEWAY,
    NetworkComponentType.NVA,
    NetworkComponentType.LOAD_BALANCER,
  ],
  Compute: [
    NetworkComponentType.VM,
    NetworkComponentType.VMSS,
    NetworkComponentType.AKS,
    NetworkComponentType.APP_SERVICE,
    NetworkComponentType.FUNCTIONS,
  ],
  Storage: [
    NetworkComponentType.STORAGE_ACCOUNT,
    NetworkComponentType.BLOB_STORAGE,
    NetworkComponentType.MANAGED_DISK,
  ],
  Identity: [
    NetworkComponentType.KEY_VAULT,
    NetworkComponentType.MANAGED_IDENTITY,
  ],
}

const COMPONENT_TO_CATEGORY = Object.entries(COMPONENTS_BY_CATEGORY).reduce((acc, [category, types]) => {
  types.forEach((type) => {
    acc[type] = category as ComponentCategory
  })
  return acc
}, {} as Record<NetworkComponentType, ComponentCategory>)

export function getComponentCategory(type: NetworkComponentType): ComponentCategory {
  return COMPONENT_TO_CATEGORY[type] || 'Network'
}
