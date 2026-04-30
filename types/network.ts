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
}

export interface NetworkComponent {
  id: string
  name: string
  type: NetworkComponentType
  description?: string
  tags?: Record<string, string>
  createdAt: string
  parentId?: string
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
  vnetId: string
  nsgId?: string
  routeTableId?: string
  serviceEndpoints?: string[]
  delegations?: string[]
  privateEndpointNetworkPolicies?: 'Enabled' | 'Disabled'
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
}

export interface AsgComponent extends NetworkComponent {
  type: NetworkComponentType.ASG
  nicIds?: string[]
}

export interface IpAddressComponent extends NetworkComponent {
  type: NetworkComponentType.IP_ADDRESS
  ipAddress?: string
  allocationMethod: 'Static' | 'Dynamic'
  sku: 'Basic' | 'Standard'
  ipVersion: 'IPv4' | 'IPv6'
  associatedTo?: string
  dnsLabel?: string
}

export interface DnsZoneComponent extends NetworkComponent {
  type: NetworkComponentType.DNS_ZONE
  zoneName: string
  zoneType: 'Public' | 'Private'
  vnetLinks?: string[]
  recordSets?: DnsRecord[]
}

export interface DnsRecord {
  name: string
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'PTR' | 'SRV' | 'TXT'
  ttl: number
  values: string[]
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
  nextHopIpAddress?: string
}

export interface VpnGatewayComponent extends NetworkComponent {
  type: NetworkComponentType.VPN_GATEWAY
  sku: 'Basic' | 'VpnGw1' | 'VpnGw2' | 'VpnGw3' | 'VpnGw4' | 'VpnGw5'
  vpnType: 'PolicyBased' | 'RouteBased'
  enableBgp?: boolean
  activeActive?: boolean
  gatewayIpId?: string
  subnetId?: string
}

export interface AppGatewayComponent extends NetworkComponent {
  type: NetworkComponentType.APP_GATEWAY
  sku: 'Standard_v2' | 'WAF_v2' | 'Standard' | 'WAF'
  tier: 'Standard' | 'Standard_v2' | 'WAF' | 'WAF_v2'
  capacity: number
  enableHttp2?: boolean
  enableWaf?: boolean
  wafMode?: 'Detection' | 'Prevention'
  frontendIpId?: string
  subnetId?: string
  backendPools?: string[]
}

export interface NvaComponent extends NetworkComponent {
  type: NetworkComponentType.NVA
  vmSize: string
  publisher: string
  offer: string
  sku: string
  version: string
  subnetId?: string
  enableIpForwarding?: boolean
}

export interface LoadBalancerComponent extends NetworkComponent {
  type: NetworkComponentType.LOAD_BALANCER
  sku: 'Basic' | 'Standard' | 'Gateway'
  tier: 'Regional' | 'Global'
  loadBalancerType: 'Public' | 'Internal'
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
  availabilityZone?: string
  diskType?: 'Standard_LRS' | 'Premium_LRS' | 'StandardSSD_LRS'
}

export interface VmssComponent extends NetworkComponent {
  type: NetworkComponentType.VMSS
  sku: string
  capacity: number
  os: 'Windows' | 'Linux'
  imagePublisher: string
  imageOffer: string
  imageSku: string
  subnetId?: string
  upgradePolicy?: 'Automatic' | 'Manual' | 'Rolling'
  autoscaleEnabled?: boolean
  minCapacity?: number
  maxCapacity?: number
}

export interface AksComponent extends NetworkComponent {
  type: NetworkComponentType.AKS
  kubernetesVersion: string
  nodeCount: number
  nodeVmSize: string
  networkPlugin: 'kubenet' | 'azure' | 'none'
  serviceCidr?: string
  dnsServiceIp?: string
  subnetId?: string
  enableRbac?: boolean
  enablePrivateCluster?: boolean
}

export interface AppServiceComponent extends NetworkComponent {
  type: NetworkComponentType.APP_SERVICE
  sku: string
  tier: 'Free' | 'Shared' | 'Basic' | 'Standard' | 'Premium' | 'Isolated'
  os: 'Windows' | 'Linux'
  runtimeStack?: string
  vnetIntegrationSubnetId?: string
  customDomain?: string
  enableHttps?: boolean
}

export interface FunctionsComponent extends NetworkComponent {
  type: NetworkComponentType.FUNCTIONS
  storageAccountId?: string
  runtimeStack: 'dotnet' | 'node' | 'python' | 'java' | 'powershell'
  runtimeVersion: string
  hostingPlanSku: string
  vnetIntegrationSubnetId?: string
  enablePrivateEndpoint?: boolean
}

export interface StorageAccountComponent extends NetworkComponent {
  type: NetworkComponentType.STORAGE_ACCOUNT
  accountKind: 'BlobStorage' | 'BlockBlobStorage' | 'FileStorage' | 'Storage' | 'StorageV2'
  replication: 'LRS' | 'GRS' | 'RAGRS' | 'ZRS' | 'GZRS' | 'RAGZRS'
  accessTier?: 'Hot' | 'Cool' | 'Archive'
  enableHttpsOnly?: boolean
  minTlsVersion?: 'TLS1_0' | 'TLS1_1' | 'TLS1_2'
  allowBlobPublicAccess?: boolean
  networkDefaultAction?: 'Allow' | 'Deny'
  virtualNetworkRules?: string[]
  ipRules?: string[]
}

export interface ManagedDiskComponent extends NetworkComponent {
  type: NetworkComponentType.MANAGED_DISK
  diskSizeGb: number
  sku: 'Standard_LRS' | 'Premium_LRS' | 'StandardSSD_LRS' | 'UltraSSD_LRS'
  osType?: 'Windows' | 'Linux'
  attachedToVmId?: string
}

export interface KeyVaultComponent extends NetworkComponent {
  type: NetworkComponentType.KEY_VAULT
  sku: 'Standard' | 'Premium'
  tenantId?: string
  enableSoftDelete?: boolean
  softDeleteRetentionDays?: number
  enablePurgeProtection?: boolean
  networkDefaultAction?: 'Allow' | 'Deny'
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

export interface ManagedIdentityComponent extends NetworkComponent {
  type: NetworkComponentType.MANAGED_IDENTITY
  identityType: 'SystemAssigned' | 'UserAssigned'
  clientId?: string
  principalId?: string
  assignedToId?: string
}

export interface ServiceEndpointComponent extends NetworkComponent {
  type: NetworkComponentType.SERVICE_ENDPOINT
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
  sku: 'Standard' | 'Premium'
  tier: 'Standard' | 'Premium'
  vnetId?: string
  publicIpIds?: string[]
  firewallPolicies?: string[]
  threatIntelMode?: 'Alert' | 'Deny' | 'Off'
}

export interface BastionComponent extends NetworkComponent {
  type: NetworkComponentType.BASTION
  sku: 'Basic' | 'Standard'
  subnetId?: string
  publicIpId?: string
  scaleUnits?: number
  enableTunneling?: boolean
  enableIpConnect?: boolean
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
  [NetworkComponentType.PRIVATE_ENDPOINT]: 'mdi:lock-network',
  [NetworkComponentType.FIREWALL]: 'mdi:wall-fire',
  [NetworkComponentType.BASTION]: 'mdi:castle',
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
  }
  return labels[type] || type
}
