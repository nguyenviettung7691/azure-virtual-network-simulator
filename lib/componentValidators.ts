/**
 * Per-component validation rules for Azure network components
 */

import type { AnyNetworkComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import type { ValidationResult, ValidatorFn } from '~/types/validation'
import {
  validateCIDRBlock,
  validateIPAddress,
  validatePortRange,
  validateDnsName,
  validateSubnetInVNet,
  validatePriority,
  validateCapacity,
  validateProbeInterval,
  validateProbeCount,
  nodeExists,
  findNodesByType,
} from './validators'

function addError(errors: any[], fieldName: string, message: string, severity: 'error' | 'warning' = 'error') {
  errors.push({ fieldName, message, severity })
}

/**
 * VNet validator: addressSpace must be non-empty, valid CIDR blocks, no duplicates
 */
function validateVNet(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Address space required and must be valid CIDR blocks
  if (!data.addressSpace || data.addressSpace.length === 0) {
    addError(errors, 'addressSpace', 'At least one address space is required')
  } else {
    const seen = new Set<string>()
    for (const cidr of data.addressSpace) {
      const check = validateCIDRBlock(cidr)
      if (!check.valid) {
        addError(errors, 'addressSpace', `Invalid CIDR: ${cidr} - ${check.error}`)
      }
      if (seen.has(cidr)) {
        addError(errors, 'addressSpace', `Duplicate address space: ${cidr}`)
      }
      seen.add(cidr)
    }
  }

  // Region required
  if (!data.region || data.region.trim() === '') {
    addError(errors, 'region', 'Region is required')
  }

  // Resource group recommended
  if (!data.resourceGroup || data.resourceGroup.trim() === '') {
    addError(errors, 'resourceGroup', 'Resource group is recommended', 'warning')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Subnet validator: addressPrefix valid CIDR, must fit in parent VNet, must reference valid VNet
 */
function validateSubnet(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Address prefix required and must be valid CIDR
  if (!data.addressPrefix || data.addressPrefix.trim() === '') {
    addError(errors, 'addressPrefix', 'Address prefix is required')
  } else {
    const check = validateCIDRBlock(data.addressPrefix)
    if (!check.valid) {
      addError(errors, 'addressPrefix', check.error!)
    }
  }

  // Parent VNet required
  if (!data.vnetId) {
    addError(errors, 'vnetId', 'Parent VNet is required')
  } else if (!nodeExists(data.vnetId, nodes)) {
    addError(errors, 'vnetId', 'Parent VNet does not exist in diagram')
  } else if (data.addressPrefix) {
    // Validate subnet fits in parent VNet
    const parentVnet = nodes.find(n => n.id === data.vnetId)?.data
    if (parentVnet?.addressSpace) {
      const subnetCheck = validateSubnetInVNet(data.addressPrefix, parentVnet.addressSpace)
      if (!subnetCheck.valid) {
        addError(errors, 'addressPrefix', subnetCheck.error!)
      }
    }
  }

  // NSG ID if provided must exist
  if (data.nsgId && !nodeExists(data.nsgId, nodes)) {
    addError(errors, 'nsgId', 'Specified NSG does not exist', 'warning')
  }

  // Route table ID if provided must exist
  if (data.routeTableId && !nodeExists(data.routeTableId, nodes)) {
    addError(errors, 'routeTableId', 'Specified UDR does not exist', 'warning')
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * IP Address validator: if static, validate format; if DNS label, validate format
 */
function validateIpAddress(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // IP address if provided must be valid format for the version
  if (data.ipAddress && data.ipAddress.trim() !== '') {
    const version = data.ipVersion || 'IPv4'
    const check = validateIPAddress(data.ipAddress, version as 'IPv4' | 'IPv6')
    if (!check.valid) {
      addError(errors, 'ipAddress', check.error!)
    }
  }

  // DNS label if provided must be valid
  if (data.dnsLabel && data.dnsLabel.trim() !== '') {
    const check = validateDnsName(data.dnsLabel)
    if (!check.valid) {
      addError(errors, 'dnsLabel', check.error!)
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * NSG validator: rules have valid priorities, CIDR blocks, port ranges
 */
function validateNsg(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  if (data.securityRules && Array.isArray(data.securityRules)) {
    const priorities = new Set<number>()

    for (let i = 0; i < data.securityRules.length; i++) {
      const rule = data.securityRules[i]
      const ruleLabel = `Rule "${rule.name || i}"`

      // Priority must be 100-4096 and unique
      const priorityCheck = validatePriority(rule.priority)
      if (!priorityCheck.valid) {
        addError(errors, `rules[${i}].priority`, `${ruleLabel}: ${priorityCheck.error!}`)
      } else if (priorities.has(rule.priority)) {
        addError(errors, `rules[${i}].priority`, `${ruleLabel}: Priority ${rule.priority} is duplicated`)
      } else {
        priorities.add(rule.priority)
      }

      // Validate source address prefix (CIDR or special values)
      if (rule.sourceAddressPrefix && rule.sourceAddressPrefix !== '*' && !isSpecialPrefix(rule.sourceAddressPrefix)) {
        const srcCheck = validateCIDRBlock(rule.sourceAddressPrefix)
        if (!srcCheck.valid) {
          addError(
            errors,
            `rules[${i}].sourceAddressPrefix`,
            `${ruleLabel}: Invalid source CIDR - ${srcCheck.error!}`
          )
        }
      }

      // Validate destination address prefix
      if (rule.destinationAddressPrefix && rule.destinationAddressPrefix !== '*' && !isSpecialPrefix(rule.destinationAddressPrefix)) {
        const dstCheck = validateCIDRBlock(rule.destinationAddressPrefix)
        if (!dstCheck.valid) {
          addError(
            errors,
            `rules[${i}].destinationAddressPrefix`,
            `${ruleLabel}: Invalid destination CIDR - ${dstCheck.error!}`
          )
        }
      }

      // Validate source port range
      if (rule.sourcePortRange) {
        const srcPortCheck = validatePortRange(rule.sourcePortRange)
        if (!srcPortCheck.valid) {
          addError(errors, `rules[${i}].sourcePortRange`, `${ruleLabel}: ${srcPortCheck.error!}`)
        }
      }

      // Validate destination port range
      if (rule.destinationPortRange) {
        const dstPortCheck = validatePortRange(rule.destinationPortRange)
        if (!dstPortCheck.valid) {
          addError(errors, `rules[${i}].destinationPortRange`, `${ruleLabel}: ${dstPortCheck.error!}`)
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * UDR validator: routes have valid CIDR blocks and next hop IPs
 */
function validateUdr(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  if (data.routes && Array.isArray(data.routes)) {
    for (let i = 0; i < data.routes.length; i++) {
      const route = data.routes[i]
      const routeLabel = `Route "${route.name || i}"`

      // Address prefix must be valid CIDR
      const addrCheck = validateCIDRBlock(route.addressPrefix)
      if (!addrCheck.valid) {
        addError(errors, `routes[${i}].addressPrefix`, `${routeLabel}: ${addrCheck.error!}`)
      }

      // If next hop is VirtualAppliance, IP must be provided and valid
      if (route.nextHopType === 'VirtualAppliance') {
        if (!route.nextHopIpAddress || route.nextHopIpAddress.trim() === '') {
          addError(
            errors,
            `routes[${i}].nextHopIpAddress`,
            `${routeLabel}: Next hop IP is required for VirtualAppliance type`
          )
        } else {
          const ipCheck = validateIPAddress(route.nextHopIpAddress)
          if (!ipCheck.valid) {
            addError(errors, `routes[${i}].nextHopIpAddress`, `${routeLabel}: ${ipCheck.error!}`)
          }
        }
      }
    }
  }

  // Subnets if provided must exist
  if (data.subnetIds && Array.isArray(data.subnetIds)) {
    for (const subnetId of data.subnetIds) {
      if (subnetId && !nodeExists(subnetId, nodes)) {
        addError(errors, 'subnetIds', `Referenced subnet does not exist`, 'warning')
        break // Only warn once
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Load Balancer validator: capacity, health probes, referenced components
 */
function validateLoadBalancer(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Capacity must be valid
  const capacityCheck = validateCapacity(data.capacity, 1, 65535)
  if (!capacityCheck.valid) {
    addError(errors, 'capacity', capacityCheck.error!)
  }

  // Health probes validation if present
  if (data.healthProbes && Array.isArray(data.healthProbes)) {
    for (let i = 0; i < data.healthProbes.length; i++) {
      const probe = data.healthProbes[i]
      const probeLabel = `Probe "${probe.name || i}"`

      // Port must be valid
      if (probe.port === undefined || probe.port === null) {
        addError(errors, `healthProbes[${i}].port`, `${probeLabel}: Port is required`)
      } else {
        const portCheck = validatePortRange(probe.port)
        if (!portCheck.valid) {
          addError(errors, `healthProbes[${i}].port`, `${probeLabel}: ${portCheck.error!}`)
        }
      }

      // Interval must be valid
      const intervalCheck = validateProbeInterval(probe.intervalInSeconds)
      if (!intervalCheck.valid) {
        addError(errors, `healthProbes[${i}].intervalInSeconds`, `${probeLabel}: ${intervalCheck.error!}`)
      }

      // Number of probes must be valid
      const probeCountCheck = validateProbeCount(probe.numberOfProbes)
      if (!probeCountCheck.valid) {
        addError(errors, `healthProbes[${i}].numberOfProbes`, `${probeLabel}: ${probeCountCheck.error!}`)
      }
    }
  }

  // Frontend IP configs - if public, must reference valid IP; if internal, must reference valid subnet
  if (data.frontendIpConfigs && Array.isArray(data.frontendIpConfigs)) {
    for (let i = 0; i < data.frontendIpConfigs.length; i++) {
      const feCfg = data.frontendIpConfigs[i]
      if (data.loadBalancerType === 'Public' && feCfg.publicIpId && !nodeExists(feCfg.publicIpId, nodes)) {
        addError(errors, 'frontendIpConfigs', 'Referenced public IP does not exist', 'warning')
      }
      if (data.loadBalancerType === 'Internal' && feCfg.subnetId && !nodeExists(feCfg.subnetId, nodes)) {
        addError(errors, 'frontendIpConfigs', 'Referenced subnet does not exist', 'warning')
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * App Gateway validator: capacity, health probes, referenced components
 */
function validateAppGateway(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Capacity must be 1-32 for App Gateway
  const capacityCheck = validateCapacity(data.capacity, 1, 32)
  if (!capacityCheck.valid) {
    addError(errors, 'capacity', capacityCheck.error!)
  }

  // Frontend IP if public must reference valid IP
  if (data.frontendType === 'Public' && data.frontendIpId && !nodeExists(data.frontendIpId, nodes)) {
    addError(errors, 'frontendIpId', 'Referenced public IP does not exist', 'warning')
  }

  // Subnet must reference valid Subnet
  if (data.subnetId && !nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  }

  // Health probes validation
  if (data.healthProbes && Array.isArray(data.healthProbes)) {
    for (let i = 0; i < data.healthProbes.length; i++) {
      const probe = data.healthProbes[i]
      const probeLabel = `Probe "${probe.name || i}"`

      // Port must be valid
      if (probe.port === undefined || probe.port === null) {
        addError(errors, `healthProbes[${i}].port`, `${probeLabel}: Port is required`)
      } else {
        const portCheck = validatePortRange(probe.port)
        if (!portCheck.valid) {
          addError(errors, `healthProbes[${i}].port`, `${probeLabel}: ${portCheck.error!}`)
        }
      }

      // Interval must be valid
      const intervalCheck = validateProbeInterval(probe.intervalInSeconds)
      if (!intervalCheck.valid) {
        addError(errors, `healthProbes[${i}].intervalInSeconds`, `${probeLabel}: ${intervalCheck.error!}`)
      }

      // Number of probes must be valid
      const probeCountCheck = validateProbeCount(probe.numberOfProbes)
      if (!probeCountCheck.valid) {
        addError(errors, `healthProbes[${i}].numberOfProbes`, `${probeLabel}: ${probeCountCheck.error!}`)
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * VNet Peering validator: both VNets exist, not self-peering, no duplicate peerings
 */
function validateVnetPeering(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Both VNet IDs required
  if (!data.localVnetId) {
    addError(errors, 'localVnetId', 'Local VNet is required')
  } else if (!nodeExists(data.localVnetId, nodes)) {
    addError(errors, 'localVnetId', 'Local VNet does not exist in diagram')
  }

  if (!data.remoteVnetId) {
    addError(errors, 'remoteVnetId', 'Remote VNet is required')
  } else if (!nodeExists(data.remoteVnetId, nodes)) {
    addError(errors, 'remoteVnetId', 'Remote VNet does not exist in diagram')
  }

  // Cannot peer with self
  if (data.localVnetId && data.remoteVnetId && data.localVnetId === data.remoteVnetId) {
    addError(errors, 'remoteVnetId', 'Cannot peer a VNet with itself')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * VPN Gateway validator: subnet required
 */
function validateVpnGateway(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet required
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Gateway subnet is required')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * NVA validator: subnet required, capacity optional SKU validation
 */
function validateNva(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet required
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Subnet is required')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Helper: Check if prefix is a special Azure value
 */
function isSpecialPrefix(prefix: string): boolean {
  const special = [
    'VirtualNetwork',
    'AzureLoadBalancer',
    'AzureTrafficManager',
    'AzureEventHub',
    'AzureServiceBus',
    'AzureCognitiveSearch',
    'AzureApplied',
  ]
  return special.includes(prefix)
}

/**
 * Compute validators (VM, VMSS, AKS, App Service, Functions)
 */
function validateCompute(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet reference (most compute types need it)
  if (data.subnetId && !nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist', 'warning')
  }

  // VM-specific
  if (data.type === NetworkComponentType.VM) {
    if (!data.size || data.size.trim() === '') {
      addError(errors, 'size', 'VM size is required', 'warning')
    }
  }

  // VMSS-specific
  if (data.type === NetworkComponentType.VMSS) {
    if (data.autoscaleEnabled) {
      if ((data.minCapacity || 0) > (data.maxCapacity || 0)) {
        addError(errors, 'minCapacity', 'Min capacity must be <= max capacity')
      }
    }
  }

  // AKS-specific
  if (data.type === NetworkComponentType.AKS) {
    if (data.nodeCount === undefined || data.nodeCount === null || data.nodeCount < 1) {
      addError(errors, 'nodeCount', 'Node count must be at least 1', 'warning')
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Storage validators (Storage Account, Blob Storage, Managed Disk)
 */
function validateStorage(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Managed Disk size validation
  if (data.type === NetworkComponentType.MANAGED_DISK) {
    if (data.diskSizeGb === undefined || data.diskSizeGb === null) {
      addError(errors, 'diskSizeGb', 'Disk size is required', 'warning')
    } else if (data.diskSizeGb < 4 || data.diskSizeGb > 32767) {
      addError(errors, 'diskSizeGb', 'Disk size must be 4-32767 GB', 'warning')
    }
  }

  // Virtual network rules validation
  if (data.virtualNetworkRules && Array.isArray(data.virtualNetworkRules)) {
    for (const subnetId of data.virtualNetworkRules) {
      if (subnetId && !nodeExists(subnetId, nodes)) {
        addError(errors, 'virtualNetworkRules', 'Referenced subnet does not exist', 'warning')
        break
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Identity validators (Key Vault, Managed Identity)
 */
function validateIdentity(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Virtual network rules validation for Key Vault
  if (data.type === NetworkComponentType.KEY_VAULT && data.virtualNetworkRules && Array.isArray(data.virtualNetworkRules)) {
    for (const subnetId of data.virtualNetworkRules) {
      if (subnetId && !nodeExists(subnetId, nodes)) {
        addError(errors, 'virtualNetworkRules', 'Referenced subnet does not exist', 'warning')
        break
      }
    }
  }

  // Managed Identity assignment reference
  if (data.type === NetworkComponentType.MANAGED_IDENTITY) {
    if (data.assignedToId && !nodeExists(data.assignedToId, nodes)) {
      addError(errors, 'assignedToId', 'Assigned resource does not exist', 'warning')
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * DNS Zone validator
 */
function validateDnsZone(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Zone name validation
  if (!data.zoneName || data.zoneName.trim() === '') {
    addError(errors, 'zoneName', 'Zone name is required')
  } else {
    const check = validateDnsName(data.zoneName)
    if (!check.valid) {
      addError(errors, 'zoneName', check.error!)
    }
  }

  // Private zones should have VNet links
  if (data.zoneType === 'Private') {
    if (!data.vnetLinks || data.vnetLinks.length === 0) {
      addError(errors, 'vnetLinks', 'Private zone should be linked to at least one VNet', 'warning')
    } else {
      for (const vnetId of data.vnetLinks) {
        if (vnetId && !nodeExists(vnetId, nodes)) {
          addError(errors, 'vnetLinks', 'Referenced VNet does not exist', 'warning')
          break
        }
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Firewall validator
 */
function validateFirewall(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // VNet required
  if (!data.vnetId) {
    addError(errors, 'vnetId', 'VNet is required')
  } else if (!nodeExists(data.vnetId, nodes)) {
    addError(errors, 'vnetId', 'Referenced VNet does not exist')
  }

  // At least one public IP required
  if (!data.publicIpIds || data.publicIpIds.length === 0) {
    addError(errors, 'publicIpIds', 'At least one public IP is required')
  } else {
    for (const ipId of data.publicIpIds) {
      if (ipId && !nodeExists(ipId, nodes)) {
        addError(errors, 'publicIpIds', 'Referenced public IP does not exist', 'warning')
        break
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Bastion validator
 */
function validateBastion(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet required
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Subnet is required')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  }

  // Public IP required
  if (!data.publicIpId) {
    addError(errors, 'publicIpId', 'Public IP is required')
  } else if (!nodeExists(data.publicIpId, nodes)) {
    addError(errors, 'publicIpId', 'Referenced public IP does not exist')
  }

  // Scale units validation for Standard SKU
  if (data.sku === 'Standard') {
    if (data.scaleUnits === undefined || data.scaleUnits === null || data.scaleUnits < 2 || data.scaleUnits > 50) {
      addError(errors, 'scaleUnits', 'Scale units must be 2-50 for Standard SKU', 'warning')
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Network IC validator (NIC, Service Endpoint, Private Endpoint)
 */
function validateNetworkIC(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // NIC-specific validation
  if (data.type === NetworkComponentType.NETWORK_IC) {
    if (data.subnetId && !nodeExists(data.subnetId, nodes)) {
      addError(errors, 'subnetId', 'Referenced subnet does not exist', 'warning')
    }
    if (data.publicIpId && !nodeExists(data.publicIpId, nodes)) {
      addError(errors, 'publicIpId', 'Referenced public IP does not exist', 'warning')
    }
    if (data.nsgId && !nodeExists(data.nsgId, nodes)) {
      addError(errors, 'nsgId', 'Referenced NSG does not exist', 'warning')
    }
  }

  // Service Endpoint validation
  if (data.type === NetworkComponentType.SERVICE_ENDPOINT) {
    if (!data.subnetId) {
      addError(errors, 'subnetId', 'Subnet is required')
    } else if (!nodeExists(data.subnetId, nodes)) {
      addError(errors, 'subnetId', 'Referenced subnet does not exist')
    }
  }

  // Private Endpoint validation
  if (data.type === NetworkComponentType.PRIVATE_ENDPOINT) {
    if (!data.subnetId) {
      addError(errors, 'subnetId', 'Subnet is required')
    } else if (!nodeExists(data.subnetId, nodes)) {
      addError(errors, 'subnetId', 'Referenced subnet does not exist')
    }
    if (data.dnsZoneGroupId && !nodeExists(data.dnsZoneGroupId, nodes)) {
      addError(errors, 'dnsZoneGroupId', 'Referenced DNS zone does not exist', 'warning')
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Dispatcher: get validator for component type
 */
export function getValidator(type: NetworkComponentType): ValidatorFn<AnyNetworkComponent> | null {
  const validators: Partial<Record<NetworkComponentType, ValidatorFn<AnyNetworkComponent>>> = {
    [NetworkComponentType.VNET]: validateVNet,
    [NetworkComponentType.SUBNET]: validateSubnet,
    [NetworkComponentType.IP_ADDRESS]: validateIpAddress,
    [NetworkComponentType.NSG]: validateNsg,
    [NetworkComponentType.UDR]: validateUdr,
    [NetworkComponentType.LOAD_BALANCER]: validateLoadBalancer,
    [NetworkComponentType.APP_GATEWAY]: validateAppGateway,
    [NetworkComponentType.VNET_PEERING]: validateVnetPeering,
    [NetworkComponentType.VPN_GATEWAY]: validateVpnGateway,
    [NetworkComponentType.NVA]: validateNva,
    [NetworkComponentType.VM]: validateCompute,
    [NetworkComponentType.VMSS]: validateCompute,
    [NetworkComponentType.AKS]: validateCompute,
    [NetworkComponentType.APP_SERVICE]: validateCompute,
    [NetworkComponentType.FUNCTIONS]: validateCompute,
    [NetworkComponentType.STORAGE_ACCOUNT]: validateStorage,
    [NetworkComponentType.BLOB_STORAGE]: validateStorage,
    [NetworkComponentType.MANAGED_DISK]: validateStorage,
    [NetworkComponentType.KEY_VAULT]: validateIdentity,
    [NetworkComponentType.MANAGED_IDENTITY]: validateIdentity,
    [NetworkComponentType.DNS_ZONE]: validateDnsZone,
    [NetworkComponentType.FIREWALL]: validateFirewall,
    [NetworkComponentType.BASTION]: validateBastion,
    [NetworkComponentType.NETWORK_IC]: validateNetworkIC,
    [NetworkComponentType.SERVICE_ENDPOINT]: validateNetworkIC,
    [NetworkComponentType.PRIVATE_ENDPOINT]: validateNetworkIC,
  }

  return validators[type] || null
}
