import { NetworkComponentType } from '~/types/network'

export function getNodeTypeForComponent(componentType: NetworkComponentType): string {
  const map: Partial<Record<NetworkComponentType, string>> = {
    [NetworkComponentType.VNET]: 'vnet-node',
    [NetworkComponentType.SUBNET]: 'subnet-node',
    [NetworkComponentType.NSG]: 'nsg-node',
    [NetworkComponentType.ASG]: 'asg-node',
    [NetworkComponentType.IP_ADDRESS]: 'ip-address-node',
    [NetworkComponentType.DNS_ZONE]: 'dns-zone-node',
    [NetworkComponentType.VPN_GATEWAY]: 'vpn-gateway-node',
    [NetworkComponentType.APP_GATEWAY]: 'app-gateway-node',
    [NetworkComponentType.NVA]: 'nva-node',
    [NetworkComponentType.LOAD_BALANCER]: 'load-balancer-node',
    [NetworkComponentType.UDR]: 'udr-node',
    [NetworkComponentType.VNET_PEERING]: 'vnet-peering-node',
    [NetworkComponentType.VM]: 'compute-node',
    [NetworkComponentType.VMSS]: 'compute-node',
    [NetworkComponentType.AKS]: 'compute-node',
    [NetworkComponentType.APP_SERVICE]: 'compute-node',
    [NetworkComponentType.FUNCTIONS]: 'compute-node',
    [NetworkComponentType.STORAGE_ACCOUNT]: 'storage-node',
    [NetworkComponentType.BLOB_STORAGE]: 'storage-node',
    [NetworkComponentType.MANAGED_DISK]: 'storage-node',
    [NetworkComponentType.MANAGED_IDENTITY]: 'identity-node',
    [NetworkComponentType.KEY_VAULT]: 'identity-node',
    [NetworkComponentType.NETWORK_IC]: 'network-ic-node',
    [NetworkComponentType.FIREWALL]: 'compute-node',
    [NetworkComponentType.BASTION]: 'compute-node',
    [NetworkComponentType.PRIVATE_ENDPOINT]: 'compute-node',
    [NetworkComponentType.SERVICE_ENDPOINT]: 'compute-node',
    [NetworkComponentType.INTERNET]: 'internet-node',
  }
  return map[componentType] || 'compute-node'
}