import { NetworkComponentType } from '../types/network'

type AzureIconCollection = {
  prefix: string
  dir: string
}

export const AZURE_ICON_COLLECTIONS: AzureIconCollection[] = [
  { prefix: 'azure-toolbar', dir: 'assets/azure-toolbar-icons' },
]

export const AZURE_COMPONENT_ICON_NAMES: Record<NetworkComponentType, string> = {
  [NetworkComponentType.VNET]: 'azure-toolbar:10061-icon-service-virtual-networks',
  [NetworkComponentType.SUBNET]: 'azure-toolbar:02742-icon-service-subnet',
  [NetworkComponentType.NETWORK_IC]: 'azure-toolbar:10080-icon-service-network-interfaces',
  [NetworkComponentType.NSG]: 'azure-toolbar:10067-icon-service-network-security-groups',
  [NetworkComponentType.ASG]: 'azure-toolbar:10244-icon-service-application-security-groups',
  [NetworkComponentType.IP_ADDRESS]: 'azure-toolbar:10069-icon-service-public-ip-addresses',
  [NetworkComponentType.DNS_ZONE]: 'azure-toolbar:10064-icon-service-dns-zones',
  [NetworkComponentType.VNET_PEERING]: 'azure-toolbar:01285-icon-service-peerings',
  [NetworkComponentType.UDR]: 'azure-toolbar:10082-icon-service-route-tables',
  [NetworkComponentType.VPN_GATEWAY]: 'azure-toolbar:10063-icon-service-virtual-network-gateways',
  [NetworkComponentType.APP_GATEWAY]: 'azure-toolbar:10076-icon-service-application-gateways',
  [NetworkComponentType.NVA]: 'azure-toolbar:034412066-icon-service-vnet-appliance',
  [NetworkComponentType.LOAD_BALANCER]: 'azure-toolbar:10062-icon-service-load-balancers',
  [NetworkComponentType.VM]: 'azure-toolbar:10021-icon-service-virtual-machine',
  [NetworkComponentType.VMSS]: 'azure-toolbar:10034-icon-service-vm-scale-sets',
  [NetworkComponentType.AKS]: 'azure-toolbar:10023-icon-service-kubernetes-services',
  [NetworkComponentType.APP_SERVICE]: 'azure-toolbar:10035-icon-service-app-services',
  [NetworkComponentType.FUNCTIONS]: 'azure-toolbar:10029-icon-service-function-apps',
  [NetworkComponentType.STORAGE_ACCOUNT]: 'azure-toolbar:10086-icon-service-storage-accounts',
  [NetworkComponentType.BLOB_STORAGE]: 'azure-toolbar:10780-icon-service-blob-block',
  [NetworkComponentType.MANAGED_DISK]: 'azure-toolbar:10032-icon-service-disks',
  [NetworkComponentType.KEY_VAULT]: 'azure-toolbar:10245-icon-service-key-vaults',
  [NetworkComponentType.MANAGED_IDENTITY]: 'azure-toolbar:10227-icon-service-managed-identities',
  [NetworkComponentType.SERVICE_ENDPOINT]: 'azure-toolbar:10085-icon-service-service-endpoint-policies',
  [NetworkComponentType.PRIVATE_ENDPOINT]: 'azure-toolbar:02579-icon-service-private-endpoints',
  [NetworkComponentType.FIREWALL]: 'azure-toolbar:10084-icon-service-firewalls',
  [NetworkComponentType.BASTION]: 'azure-toolbar:02422-icon-service-bastions',
  [NetworkComponentType.INTERNET]: 'azure-toolbar:globe',
}

export const AZURE_TOPBAR_COMPONENT_ICONS = AZURE_COMPONENT_ICON_NAMES

export const AZURE_TOPBAR_ICON_NAMES = Object.values(AZURE_COMPONENT_ICON_NAMES)

export const AZURE_DIAGRAM_ICON_NAMES = AZURE_TOPBAR_ICON_NAMES

export function getAzureComponentIcon(type: NetworkComponentType): string {
  return AZURE_COMPONENT_ICON_NAMES[type] || AZURE_COMPONENT_ICON_NAMES[NetworkComponentType.VNET]
}

export function getAzureTopBarIcon(type: NetworkComponentType): string {
  return getAzureComponentIcon(type)
}