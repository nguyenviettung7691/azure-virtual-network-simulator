/**
 * NAT Gateway validator: Azure NAT Gateway resource validation
 * https://docs.azure.cn/en-us/nat-gateway/nat-gateway-resource
 */
export function validateNatGateway(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    addError(errors, 'name', 'NAT Gateway name is required')
  } else {
    const name = data.name.trim()
    if (name.length < 1 || name.length > 80) {
      addError(errors, 'name', 'Name must be 1-80 characters')
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(name)) {
      addError(errors, 'name', 'Name must be alphanumeric or hyphen, start/end with alphanumeric')
    }
  }

  if (data.sku !== 'Standard') {
    addError(errors, 'sku', 'SKU must be Standard (only supported value)')
  }

  if (data.idleTimeoutInMinutes !== undefined && data.idleTimeoutInMinutes !== null) {
    const timeout = parseInt(String(data.idleTimeoutInMinutes), 10)
    if (isNaN(timeout) || timeout < 4 || timeout > 120) {
      addError(errors, 'idleTimeoutInMinutes', 'Idle timeout must be 4-120 minutes')
    }
  }

  if (data.availabilityZones && Array.isArray(data.availabilityZones)) {
    for (const zone of data.availabilityZones) {
      if (!['1', '2', '3'].includes(String(zone))) {
        addError(errors, 'availabilityZones', `Zone must be '1', '2', or '3', got '${zone}'`)
      }
    }
    if (data.availabilityZones.length === 1) {
      addError(errors, 'availabilityZones', 'Single-zone NAT Gateway is not zone-redundant', 'warning')
    }
  }

  const publicIpIds = Array.isArray(data.publicIpIds)
    ? data.publicIpIds.map((id: unknown) => String(id).trim()).filter(Boolean)
    : []
  const publicIpPrefixIds = Array.isArray(data.publicIpPrefixIds)
    ? data.publicIpPrefixIds.map((id: unknown) => String(id).trim()).filter(Boolean)
    : []

  if (publicIpIds.length + publicIpPrefixIds.length > 16) {
    addError(errors, 'publicIpIds', 'NAT Gateway supports up to 16 total IPv4 public IP capacity references')
  }

  for (const pipId of publicIpIds) {
    if (!nodeExists(pipId, nodes)) {
      addError(errors, 'publicIpIds', `Referenced Public IP does not exist: ${pipId}`)
      continue
    }
    const pip = nodes.find(n => n.id === pipId)?.data
    if (pip?.type !== NetworkComponentType.IP_ADDRESS) {
      addError(errors, 'publicIpIds', `Referenced resource is not a Public IP: ${pipId}`)
      continue
    }
    if (pip?.sku !== 'Standard') {
      addError(errors, 'publicIpIds', `Public IP must be Standard SKU (found: ${pip?.sku})`)
    }
    const natGateways = findNodesByType(NetworkComponentType.NAT_GATEWAY, nodes).filter(n => n.id !== data.id)
    for (const nat of natGateways) {
      if (Array.isArray(nat.data?.publicIpIds) && nat.data.publicIpIds.includes(pipId)) {
        addError(errors, 'publicIpIds', `Public IP is already attached to another NAT Gateway: ${nat.data?.name || nat.id}`)
        break
      }
    }
  }

  for (const prefixId of publicIpPrefixIds) {
    if (!nodeExists(prefixId, nodes)) {
      addError(errors, 'publicIpPrefixIds', `Public IP Prefix ID '${prefixId}' cannot be resolved in the diagram model`, 'warning')
    }
  }

  if (Array.isArray(data.subnetIds)) {
    if (data.subnetIds.length > 16) {
      addError(errors, 'subnetIds', 'A NAT Gateway can be attached to up to 16 subnets')
    }
    for (const subnetId of data.subnetIds) {
      if (!nodeExists(subnetId, nodes)) {
        addError(errors, 'subnetIds', `Referenced subnet does not exist: ${subnetId}`)
      } else {
        const subnet = nodes.find(n => n.id === subnetId)?.data
        if (subnet?.type !== NetworkComponentType.SUBNET) {
          addError(errors, 'subnetIds', `Referenced resource is not a Subnet: ${subnetId}`)
          continue
        }
        if (subnet?.natGatewayId && subnet.natGatewayId !== data.id) {
          addError(errors, 'subnetIds', `Subnet '${subnet.name}' is already attached to another NAT Gateway`)
        }
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}
/**
 * Per-component validation rules for Azure network components
 */

import type { AnyNetworkComponent } from '~/types/network'
import { NetworkComponentType, ManagedDiskType, ManagedDiskRedundancy, ManagedDiskRole, MANAGED_DISK_REDUNDANCY_BY_TYPE, MANAGED_DISK_SIZE_LIMITS } from '~/types/network'
import {
  getPremiumSsdV2PerformanceLimits,
  getUltraDiskPerformanceLimits,
  normalizeManagedDiskData,
} from '~/lib/managedDisk'
import type { ValidationResult, ValidatorFn } from '~/types/validation'
import {
  validateCIDRBlock,
  validateIPAddress,
  validatePortRange,
  validateDnsName,
  validateSubnetInVNet,
  validateSubnetName,
  validateSubnetCIDRSize,
  validatePriority,
  validateCapacity,
  validateProbeInterval,
  validateProbeCount,
  nodeExists,
  getVNetFromNic,
  findNodesByType,
  cidrOverlaps,
  validateRuleName,
  validateRuleDescription,
  validateServiceTag,
} from './validators'
import {
  KEY_VAULT_ACCESS_POLICY_PERMISSION_OPTIONS,
  isValidKeyVaultName,
  isValidKeyVaultObjectName,
  isValidKeyVaultObjectVersion,
  normalizeComponentKeyVaultReferences,
  parseKeyVaultReference,
} from './keyVault'
import {
  isKnownServiceEndpointService,
  normalizeServiceEndpointServiceName,
} from '~/lib/serviceEndpoints'

function addError(errors: any[], fieldName: string, message: string, severity: 'error' | 'warning' = 'error') {
  errors.push({ fieldName, message, severity })
}

const IDENTITY_CAPABLE_RESOURCE_TYPES = [
  NetworkComponentType.VM,
  NetworkComponentType.VMSS,
  NetworkComponentType.AKS,
  NetworkComponentType.APP_SERVICE,
  NetworkComponentType.FUNCTIONS,
]

function findNodeById(id: string | undefined, nodes: any[]) {
  if (!id) return undefined
  return nodes.find((n: any) => n.id === id)
}

function isIdentityCapableResourceType(type: NetworkComponentType | undefined): boolean {
  return !!type && IDENTITY_CAPABLE_RESOURCE_TYPES.includes(type)
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isUserAssignedIdentityResourceId(value: string): boolean {
  return /^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.ManagedIdentity\/userAssignedIdentities\/[^/]+$/i.test(value)
}

function validateUserAssignedIdentityReferences(data: any, nodes: any[], errors: any[]) {
  if (!Array.isArray(data.userAssignedIdentityIds)) return

  for (const identityId of data.userAssignedIdentityIds) {
    const identityNode = findNodeById(identityId, nodes)
    if (!identityNode) {
      addError(errors, 'userAssignedIdentityIds', `Referenced identity does not exist: ${identityId}`, 'warning')
      continue
    }

    if (identityNode.data?.type !== NetworkComponentType.MANAGED_IDENTITY) {
      addError(errors, 'userAssignedIdentityIds', `Referenced resource is not a managed identity: ${identityId}`)
      continue
    }

    if (identityNode.data?.identityType !== 'UserAssigned') {
      addError(errors, 'userAssignedIdentityIds', `System-assigned identity cannot be assigned through userAssignedIdentityIds: ${identityNode.data?.name || identityId}`)
    }
  }
}

function isPrivateIpv4Address(ip: string): boolean {
  const octets = ip.split('.').map(value => parseInt(value, 10))
  if (octets.length !== 4 || octets.some(value => Number.isNaN(value))) return false
  if (octets[0] === 10) return true
  if (octets[0] === 192 && octets[1] === 168) return true
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
  return false
}

function getSubnetNode(subnetId: string | undefined, nodes: any[]) {
  const node = findNodeById(subnetId, nodes)
  return node?.data?.type === NetworkComponentType.SUBNET ? node : undefined
}

function getKeyVaultNode(keyVaultId: string | undefined, nodes: any[]) {
  const node = findNodeById(keyVaultId, nodes)
  return node?.data?.type === NetworkComponentType.KEY_VAULT ? node : undefined
}

function hasAnyManagedIdentity(data: any): boolean {
  return data.enableManagedIdentity === true || (Array.isArray(data.userAssignedIdentityIds) && data.userAssignedIdentityIds.length > 0)
}

function validateAppLikeKeyVaultReference(data: any, nodes: any[], errors: any[]) {
  const normalized = normalizeComponentKeyVaultReferences(data, nodes)
  const hasKeyVaultReference = Boolean(
    normalized.keyVaultId
    || normalized.keyVaultSecretName
    || normalized.keyVaultSecretVersion
    || (typeof normalized.keyVaultSecretUri === 'string' && normalized.keyVaultSecretUri.trim()),
  )

  if (!hasKeyVaultReference) return normalized

  if (!normalized.keyVaultId) {
    addError(errors, 'keyVaultId', 'Key Vault reference could not be matched to a Key Vault node in the diagram', 'warning')
  }

  if (normalized.keyVaultId) {
    const keyVaultNode = getKeyVaultNode(normalized.keyVaultId, nodes)
    if (!keyVaultNode) {
      addError(errors, 'keyVaultId', 'Referenced Key Vault does not exist', 'warning')
    } else if (keyVaultNode.data?.networkDefaultAction === 'Deny') {
      if (!normalized.vnetIntegrationSubnetId) {
        addError(errors, 'keyVaultId', 'Selected Key Vault is network-restricted; VNet integration is recommended to make the reference reachable', 'warning')
      } else if (
        Array.isArray(keyVaultNode.data?.virtualNetworkRules)
        && keyVaultNode.data.virtualNetworkRules.length > 0
        && !keyVaultNode.data.virtualNetworkRules.includes(normalized.vnetIntegrationSubnetId)
      ) {
        addError(errors, 'keyVaultId', 'Selected Key Vault firewall does not include the app integration subnet', 'warning')
      }
    }
  }

  if ((normalized.keyVaultId || normalized.keyVaultSecretVersion) && !normalized.keyVaultSecretName) {
    addError(errors, 'keyVaultSecretName', 'Secret name is required when configuring a Key Vault reference', 'warning')
  }

  if (normalized.keyVaultSecretName && !isValidKeyVaultObjectName(String(normalized.keyVaultSecretName))) {
    addError(errors, 'keyVaultSecretName', 'Secret name must be 1-127 characters and contain only letters, numbers, or hyphens')
  }

  if (normalized.keyVaultSecretVersion && !isValidKeyVaultObjectVersion(String(normalized.keyVaultSecretVersion))) {
    addError(errors, 'keyVaultSecretVersion', 'Secret version should be a 32-character hexadecimal Key Vault object version', 'warning')
  }

  if ((normalized.keyVaultId || normalized.keyVaultSecretName) && !hasAnyManagedIdentity(normalized)) {
    addError(errors, 'enableManagedIdentity', 'Managed identity is recommended for App Service and Functions Key Vault references', 'warning')
  }

  const rawValue = typeof normalized.keyVaultSecretUri === 'string' ? normalized.keyVaultSecretUri.trim() : ''
  if (rawValue && !normalized.keyVaultId && !parseKeyVaultReference(rawValue)) {
    addError(errors, 'keyVaultSecretUri', 'Legacy Key Vault reference could not be parsed; keep the raw value or reselect the vault and secret', 'warning')
  }

  return normalized
}

/**
 * VNet validator: addressSpace must be non-empty, valid CIDR blocks, no duplicates
 * Also checks DNS servers format and warns about address space overlaps with other VNets
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

    // Check for overlaps with other VNets (warning, not error)
    const otherVnets = findNodesByType(NetworkComponentType.VNET, nodes).filter(
      n => n.id !== data.id
    )
    for (const otherVnet of otherVnets) {
      const otherCidrs = otherVnet.data?.addressSpace || []
      for (const thisCidr of data.addressSpace) {
        for (const otherCidr of otherCidrs) {
          if (cidrOverlaps(thisCidr, otherCidr)) {
            addError(
              errors,
              'addressSpace',
              `Address space ${thisCidr} overlaps with VNet "${otherVnet.data?.name}" (${otherCidr})`,
              'warning'
            )
            break // Only warn once per VNet pair
          }
        }
      }
    }
  }

  // DNS servers if provided must be valid IP addresses
  if (data.dnsServers && Array.isArray(data.dnsServers)) {
    for (let i = 0; i < data.dnsServers.length; i++) {
      const dns = data.dnsServers[i]
      if (dns && typeof dns === 'string' && dns.trim() !== '') {
        const check = validateIPAddress(dns.trim())
        if (!check.valid) {
          addError(errors, 'dnsServers', `DNS Server ${i + 1}: ${check.error!}`)
        }
      }
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

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Subnet validator: name starts with letter, addressPrefix valid CIDR and minimum /29,
 * must fit in parent VNet, must reference valid VNet, check delegation-PE conflicts
 */
function validateSubnet(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Name required and must start with letter
  if (!data.name || data.name.trim() === '') {
    addError(errors, 'name', 'Subnet name is required')
  } else {
    const nameCheck = validateSubnetName(data.name)
    if (!nameCheck.valid) {
      addError(errors, 'name', nameCheck.error!)
    }
  }

  // Address prefix required and must be valid CIDR with minimum /29 size
  if (!data.addressPrefix || data.addressPrefix.trim() === '') {
    addError(errors, 'addressPrefix', 'Address prefix is required')
  } else {
    const cidrCheck = validateCIDRBlock(data.addressPrefix)
    if (!cidrCheck.valid) {
      addError(errors, 'addressPrefix', cidrCheck.error!)
    } else {
      // Also validate minimum CIDR size (/29 for IPv4, /64 for IPv6)
      const sizeCheck = validateSubnetCIDRSize(data.addressPrefix)
      if (!sizeCheck.valid) {
        addError(errors, 'addressPrefix', sizeCheck.error!)
      }
    }
  }

  // IPv6 address prefix if provided must be valid CIDR
  if (data.addressPrefixIPv6 && data.addressPrefixIPv6.trim() !== '') {
    const ipv6Check = validateCIDRBlock(data.addressPrefixIPv6)
    if (!ipv6Check.valid) {
      addError(errors, 'addressPrefixIPv6', ipv6Check.error!)
    } else {
      const sizeCheck = validateSubnetCIDRSize(data.addressPrefixIPv6)
      if (!sizeCheck.valid) {
        addError(errors, 'addressPrefixIPv6', sizeCheck.error!)
      }
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

  // NAT Gateway ID if provided must exist
  if (data.natGatewayId && !nodeExists(data.natGatewayId, nodes)) {
    addError(errors, 'natGatewayId', 'Specified NAT Gateway does not exist', 'warning')
  }

  // Delegation and Private Endpoint conflict check (Azure constraint)
  // Delegated subnets cannot have private endpoints enabled
  if (
    data.delegations &&
    Array.isArray(data.delegations) &&
    data.delegations.length > 0 &&
    data.privateEndpointNetworkPolicies === 'Disabled'
  ) {
    addError(
      errors,
      'delegations',
      'Delegated subnets cannot have private endpoint network policies disabled. Enable policies or remove delegations.',
      'warning'
    )
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * IP Address validator: SKU constraints, allocation methods, zones, routing preference
 * ✓ Standard v1/v2 only (Basic retired Sep 30, 2025)
 * ✓ Zone redundancy per SKU type
 * ✓ Routing preference validation (Standard only)
 * ✓ Integration checks with LB/AppGateway/Bastion
 */
function validateIpAddress(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // SKU validation: must be Standard or Standard_v2 (no Basic)
  if (!data.sku || (data.sku !== 'Standard' && data.sku !== 'Standard_v2')) {
    addError(errors, 'sku', `SKU must be 'Standard' or 'Standard_v2'. Basic SKU was retired September 30, 2025.`)
  }

  // Allocation method validation
  if (!data.allocationMethod || (data.allocationMethod !== 'Static' && data.allocationMethod !== 'Dynamic')) {
    addError(errors, 'allocationMethod', 'Allocation method must be Static or Dynamic')
  } else if (data.allocationMethod === 'Dynamic') {
    addError(errors, 'allocationMethod', 'Dynamic IPs may change upon resource stop/start; Static recommended for DNS/firewall rules', 'warning')
  }

  // Tier validation
  if (data.tier && data.tier !== 'Regional' && data.tier !== 'Global') {
    addError(errors, 'tier', 'Tier must be Regional or Global')
  }
  if (data.tier === 'Global' && data.sku === 'Standard_v2') {
    addError(errors, 'tier', 'Global tier with Standard_v2 requires cross-region LB; confirm your topology supports this', 'warning')
  }

  // Availability Zones validation
  if (data.availabilityZones && Array.isArray(data.availabilityZones)) {
    for (const zone of data.availabilityZones) {
      if (zone !== '1' && zone !== '2' && zone !== '3') {
        addError(errors, 'availabilityZones', `Invalid zone ID: '${zone}'. Must be '1', '2', or '3'`)
      }
    }
    // Warning if < 2 zones (not zone-redundant)
    if (data.availabilityZones.length > 0 && data.availabilityZones.length < 2) {
      addError(errors, 'availabilityZones', 'Fewer than 2 zones: not zone-redundant (lower reliability)', 'warning')
    }
    // Warning if Standard v1 (may not be zone-redundant)
    if (data.availabilityZones.length > 0 && data.sku === 'Standard') {
      addError(errors, 'availabilityZones', 'Standard v1 zones are optional metadata; only Standard_v2 guarantees zone-redundancy', 'warning')
    }
  }
  // Info if Standard_v2 without explicit zones (always zone-redundant by default)
  if (data.sku === 'Standard_v2' && (!data.availabilityZones || data.availabilityZones.length === 0)) {
    addError(errors, 'availabilityZones', 'Standard_v2 is always zone-redundant by default', 'warning')
  }

  // Routing Preference validation (Standard only, not Standard_v2)
  if (data.routingPreference) {
    if (data.routingPreference !== 'Internet' && data.routingPreference !== 'Microsoft') {
      addError(errors, 'routingPreference', 'Routing preference must be Internet or Microsoft')
    }
    if (data.sku === 'Standard_v2') {
      addError(errors, 'routingPreference', 'Routing Preference Internet is not supported on Standard_v2')
    }
  }

  // IP address if provided must be valid format for the version
  if (data.ipAddress && data.ipAddress.trim() !== '') {
    const version = data.ipVersion || 'IPv4'
    const check = validateIPAddress(data.ipAddress, version as 'IPv4' | 'IPv6')
    if (!check.valid) {
      addError(errors, 'ipAddress', check.error!)
    }
    // Info: Cannot specify exact public IP
    addError(errors, 'ipAddress', 'Azure assigns the public IP from available pool; this field is for documentation only', 'warning')
  }

  // DNS label if provided must be valid
  if (data.dnsLabel && data.dnsLabel.trim() !== '') {
    const check = validateDnsName(data.dnsLabel)
    if (!check.valid) {
      addError(errors, 'dnsLabel', check.error!)
    }
  }

  // Integration check: warn if referenced by public LBs/AppGateway/Bastion that require Standard
  const referencingComponents = [
    ...findNodesByType(NetworkComponentType.LOAD_BALANCER, nodes),
    ...findNodesByType(NetworkComponentType.APP_GATEWAY, nodes),
    ...findNodesByType(NetworkComponentType.BASTION, nodes),
    ...findNodesByType(NetworkComponentType.FIREWALL, nodes),
  ]

  for (const comp of referencingComponents) {
    const refIds = []
    if (comp.data?.publicIpId === data.id) refIds.push(comp.data?.publicIpId)
    if (comp.data?.publicIpIds?.includes(data.id)) refIds.push(data.id)

    if (refIds.length > 0 && data.sku !== 'Standard' && data.sku !== 'Standard_v2') {
      addError(
        errors,
        'sku',
        `Referenced by "${comp.data?.name}" (${comp.data?.type}); ensure SKU is Standard with Static allocation`,
        'warning'
      )
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * NSG validator: rules have valid priorities, CIDR blocks, port ranges, names, descriptions,
 * service tags, and ASG references
 */
function validateNsg(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  if (data.securityRules && Array.isArray(data.securityRules)) {
    const priorities = new Set<number>()

    for (let i = 0; i < data.securityRules.length; i++) {
      const rule = data.securityRules[i]
      const ruleLabel = `Rule "${rule.name || i}"`

      // Validate rule name (required, max 80 chars, proper format)
      const nameCheck = validateRuleName(rule.name)
      if (!nameCheck.valid) {
        addError(errors, `rules[${i}].name`, `${ruleLabel}: ${nameCheck.error!}`)
      }

      // Validate rule description (optional, max 140 chars)
      if (rule.description) {
        const descCheck = validateRuleDescription(rule.description)
        if (!descCheck.valid) {
          addError(errors, `rules[${i}].description`, `${ruleLabel}: ${descCheck.error!}`)
        }
      }

      // Priority must be 100-4096 and unique
      const priorityCheck = validatePriority(rule.priority)
      if (!priorityCheck.valid) {
        addError(errors, `rules[${i}].priority`, `${ruleLabel}: ${priorityCheck.error!}`)
      } else if (priorities.has(rule.priority)) {
        addError(errors, `rules[${i}].priority`, `${ruleLabel}: Priority ${rule.priority} is duplicated`)
      } else {
        priorities.add(rule.priority)
      }

      // Validate source configuration based on sourceType
      const sourceType = rule.sourceType || 'IpCidr'
      
      if (sourceType === 'IpCidr') {
        // Source address prefix must be CIDR or special value
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
      } else if (sourceType === 'ServiceTag') {
        // Source must be a valid service tag
        const tagCheck = validateServiceTag(rule.sourceAddressPrefix)
        if (!tagCheck.valid) {
          addError(errors, `rules[${i}].sourceAddressPrefix`, `${ruleLabel}: ${tagCheck.error!}`)
        }
      } else if (sourceType === 'Asg') {
        // Source must reference valid ASG
        if (!rule.sourceAsgId) {
          addError(errors, `rules[${i}].sourceAsgId`, `${ruleLabel}: ASG ID is required when source type is "ASG"`)
        } else if (!nodeExists(rule.sourceAsgId, nodes)) {
          addError(errors, `rules[${i}].sourceAsgId`, `${ruleLabel}: Referenced ASG does not exist in diagram`, 'warning')
        }
      }

      // Validate destination configuration based on destinationType
      const destType = rule.destinationType || 'IpCidr'
      
      if (destType === 'IpCidr') {
        // Destination address prefix must be CIDR or special value
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
      } else if (destType === 'ServiceTag') {
        // Destination must be a valid service tag
        const tagCheck = validateServiceTag(rule.destinationAddressPrefix)
        if (!tagCheck.valid) {
          addError(errors, `rules[${i}].destinationAddressPrefix`, `${ruleLabel}: ${tagCheck.error!}`)
        }
      } else if (destType === 'Asg') {
        // Destination must reference valid ASG
        if (!rule.destinationAsgId) {
          addError(errors, `rules[${i}].destinationAsgId`, `${ruleLabel}: ASG ID is required when destination type is "ASG"`)
        } else if (!nodeExists(rule.destinationAsgId, nodes)) {
          addError(errors, `rules[${i}].destinationAsgId`, `${ruleLabel}: Referenced ASG does not exist in diagram`, 'warning')
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

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * UDR validator: routes have valid CIDR blocks or service tags, next hop validations, Azure constraints
 * 
 * Azure UDR Specification:
 * - Supported next hop types: VirtualNetworkGateway, VnetLocal, Internet, VirtualAppliance, None
 * - Address prefix: CIDR blocks (e.g., 10.0.0.0/8) OR service tags (e.g., "Storage", "AppService")
 * - VirtualAppliance: Requires next hop IP (private IP with direct connectivity) or resource reference
 * - None: Drops traffic; commonly used to override system routes and block specific prefixes
 * - 0.0.0.0/0: Special handling—overrides default Internet route; all traffic sent to specified next hop
 * - BGP Route Propagation: Can be disabled at route table level via disableBgpRoutePropagation
 * - Per-subnet association: Each subnet can have 0 or 1 route table (not validated here; checked in Subnet validator)
 * - Route limit: 400 routes per table (standard); 1,000 with Azure Virtual Network Manager (AVNM)
 */
function validateUdr(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Known Azure service tags for validation
  const serviceTagPatterns = [
    'AzureCloud', 'AzureCloud\\.',  // Regional: AzureCloud.eastus, etc.
    'Storage', 'Storage\\.',         // Regional: Storage.EastUS, etc.
    'AppService', 'AppService\\.',
    'AzureCosmosDB', 'AzureCosmosDB\\.',
    'EventHub', 'EventHub\\.',
    'ServiceBus', 'ServiceBus\\.',
    'Sql', 'Sql\\.',
    'VirtualNetworkServiceEndpoint',
    'Dynamics365ForMarketingEmail',
  ]
  const isServiceTag = (prefix: string) => 
    serviceTagPatterns.some(pattern => new RegExp(`^${pattern}`).test(prefix))

  if (data.routes && Array.isArray(data.routes)) {
    if (data.routes.length > 1000) {
      addError(errors, 'routes', 'Route table exceeds maximum of 1,000 routes (with AVNM); standard limit is 400 routes', 'warning')
    }

    for (let i = 0; i < data.routes.length; i++) {
      const route = data.routes[i]
      const routeLabel = `Route "${route.name || i}"`

      // Address prefix validation: CIDR OR service tag
      const isServiceTagPrefix = isServiceTag(route.addressPrefix)
      let addrCheckValid = isServiceTagPrefix

      if (!isServiceTagPrefix) {
        const addrCheck = validateCIDRBlock(route.addressPrefix)
        addrCheckValid = addrCheck.valid
        if (!addrCheckValid) {
          addError(
            errors,
            `routes[${i}].addressPrefix`,
            `${routeLabel}: Must be valid CIDR block (e.g., 10.0.0.0/8) or service tag (e.g., Storage, AppService)`
          )
        }
      }

      // Special handling for 0.0.0.0/0 prefix
      if (route.addressPrefix === '0.0.0.0/0') {
        if (route.nextHopType === 'VnetLocal') {
          addError(
            errors,
            `routes[${i}].nextHopType`,
            `${routeLabel}: Default route (0.0.0.0/0) cannot use VnetLocal as next hop. Use Virtual Appliance, Virtual Network Gateway, Internet, or None.`,
            'warning'
          )
        }
      }

      // Reserved prefix documentation (informational)
      if (addrCheckValid && !isServiceTagPrefix) {
        const reservedPrefixes = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10']
        if (reservedPrefixes.some(prefix => route.addressPrefix === prefix)) {
          // Info only; these are valid RFC 1918 and RFC 6598 reserved ranges
        }
      }

      // Next hop type specific validations
      if (route.nextHopType === 'VirtualAppliance') {
        const hasResourceRef = !!route.nextHopResourceId && nodeExists(route.nextHopResourceId, nodes)

        // Must provide either resource ID or IP address
        if (!hasResourceRef && (!route.nextHopIpAddress || route.nextHopIpAddress.trim() === '')) {
          addError(
            errors,
            `routes[${i}].nextHopIpAddress`,
            `${routeLabel}: Next hop IP or appliance resource is required for VirtualAppliance type`
          )
        } else if (route.nextHopIpAddress && route.nextHopIpAddress.trim() !== '') {
          const ipCheck = validateIPAddress(route.nextHopIpAddress)
          if (!ipCheck.valid) {
            addError(errors, `routes[${i}].nextHopIpAddress`, `${routeLabel}: ${ipCheck.error!}`)
          }

          // Warn if next hop IP doesn't have direct connectivity (should not route through gateway)
          if (ipCheck.valid && route.nextHopIpAddress.startsWith('10.') || route.nextHopIpAddress.startsWith('172.') || route.nextHopIpAddress.startsWith('192.')) {
            // Private IP detected; verify it belongs to an appliance with IP forwarding enabled (warn if not found)
            const applianceNic = nodes.find((n: any) => 
              n.data?.privateIpAddress === route.nextHopIpAddress
            )
            if (!applianceNic) {
              addError(
                errors,
                `routes[${i}].nextHopIpAddress`,
                `${routeLabel}: Private IP address not found as NIC in diagram; ensure appliance NIC is configured`,
                'warning'
              )
            } else if (applianceNic.data?.enableIpForwarding === false) {
              addError(
                errors,
                `routes[${i}].nextHopIpAddress`,
                `${routeLabel}: NIC "${applianceNic.data.name}" does not have IP Forwarding enabled; virtual appliances must have IP forwarding enabled to route traffic`,
                'warning'
              )
            }
          }
        }

        // Validate referenced appliance resource exists
        if (route.nextHopResourceId && !nodeExists(route.nextHopResourceId, nodes)) {
          addError(
            errors,
            `routes[${i}].nextHopResourceId`,
            `${routeLabel}: Referenced appliance resource does not exist`,
            'warning'
          )
        }

        // Info: VirtualAppliance next hops require same-subnet appliance (routing loop prevention)
        addError(
          errors,
          `routes[${i}].nextHopType`,
          `${routeLabel}: Ensure virtual appliance is deployed in a DIFFERENT subnet than the resources that route through it to prevent routing loops`,
          'info'
        )
      }

      // VirtualNetworkGateway next hop validation
      if (route.nextHopType === 'VirtualNetworkGateway') {
        // Info: Gateway must exist in this VNet
        const relatedVnet = nodes.find((n: any) => 
          n.data?.type === NetworkComponentType.VPN_GATEWAY || 
          n.data?.type === NetworkComponentType.APP_GATEWAY
        )
        if (!relatedVnet) {
          addError(
            errors,
            `routes[${i}].nextHopType`,
            `${routeLabel}: No VPN Gateway or ExpressRoute Gateway found in diagram; gateway must exist for this route type`,
            'warning'
          )
        }
      }

      // None next hop validation
      if (route.nextHopType === 'None') {
        // Info: Traffic to this prefix will be dropped
        // This is often used to override system routes and deny specific traffic
      }
    }
  }

  // Subnet associations validation
  if (data.subnetIds && Array.isArray(data.subnetIds)) {
    if (data.subnetIds.length === 0 && (!data.routes || data.routes.length > 0)) {
      // Info: Route table created but not associated to any subnet
      addError(
        errors,
        'subnetIds',
        'Route table is not associated with any subnet; it will not be used for routing until associated',
        'info'
      )
    }

    // Check that each referenced subnet exists
    for (const subnetId of data.subnetIds) {
      if (subnetId && !nodeExists(subnetId, nodes)) {
        addError(errors, 'subnetIds', `Referenced subnet does not exist`, 'warning')
        break // Only warn once
      }
    }

    // Check that each subnet is not already assigned to a different route table
    for (const subnetId of data.subnetIds) {
      const subnet = nodes.find((n: any) => n.id === subnetId && n.data?.type === NetworkComponentType.SUBNET)
      if (subnet?.data?.routeTableId && subnet.data.routeTableId !== data.id) {
        addError(
          errors,
          'subnetIds',
          `Subnet "${subnet.data.name}" is already associated with a different route table. Each subnet can have at most one route table.`,
          'warning'
        )
      }
    }
  }

  // BGP route propagation note: if disabled, dynamic routes from gateways won't be added
  if (data.disableBgpRoutePropagation === true) {
    const hasGatewaySubnet = nodes.some((n: any) => 
      n.data?.type === NetworkComponentType.SUBNET && 
      n.data?.name?.toLowerCase() === 'gatewaysubnet'
    )
    
    if (hasGatewaySubnet && data.subnetIds?.includes(nodes.find((n: any) => 
      n.data?.type === NetworkComponentType.SUBNET && 
      n.data?.name?.toLowerCase() === 'gatewaysubnet'
    )?.id)) {
      addError(
        errors,
        'disableBgpRoutePropagation',
        '⚠️ CRITICAL: BGP route propagation must NOT be disabled on GatewaySubnet. Disabling this will prevent the gateway from functioning properly.',
        'error'
      )
    } else if (data.disableBgpRoutePropagation === true) {
      addError(
        errors,
        'disableBgpRoutePropagation',
        'When disabled, dynamic BGP routes from VPN/ExpressRoute gateways will not be added to this route table',
        'info'
      )
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Load Balancer validator: SKU support (Standard/Gateway only, Basic retired),
 * health probes, load balancing rules, frontend/backend IP configs,
 * zone redundancy, and Well-Architected recommendations
 */
function validateLoadBalancer(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // SKU validation: Basic was retired Sept 30, 2025; only Standard and Gateway supported
  if (!data.sku || !['Standard', 'Gateway'].includes(data.sku)) {
    addError(errors, 'sku', 'SKU must be Standard or Gateway (Basic was retired September 30, 2025)')
  }

  // Tier validation: Global only supported for Standard SKU
  if (data.tier === 'Global' && data.sku === 'Gateway') {
    addError(errors, 'tier', 'Global tier is only supported for Standard SKU', 'warning')
  }

  // Idle timeout must be 4-30 minutes if set (Azure range)
  if (data.idleTimeoutInMinutes !== undefined && data.idleTimeoutInMinutes !== null) {
    const timeout = parseInt(String(data.idleTimeoutInMinutes), 10)
    if (isNaN(timeout) || timeout < 4 || timeout > 30) {
      addError(errors, 'idleTimeoutInMinutes', 'Idle timeout must be 4-30 minutes')
    }
  }

  // Availability Zones: if set, must be valid zone IDs ('1', '2', '3')
  if (data.availabilityZones && Array.isArray(data.availabilityZones)) {
    for (let i = 0; i < data.availabilityZones.length; i++) {
      const zone = String(data.availabilityZones[i]).trim()
      if (!['1', '2', '3'].includes(zone)) {
        addError(errors, 'availabilityZones', `Zone must be '1', '2', or '3', got '${zone}'`)
      }
    }
    // Well-Architected recommendation: 2+ zones for zone redundancy
    if (data.availabilityZones.length < 2 && data.availabilityZones.length > 0) {
      addError(errors, 'availabilityZones', 'Fewer than 2 availability zones; zone redundancy recommended for reliability', 'warning')
    }
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

      // Interval must be valid (5-300 seconds per Azure spec)
      const intervalCheck = validateProbeInterval(probe.intervalInSeconds)
      if (!intervalCheck.valid) {
        addError(errors, `healthProbes[${i}].intervalInSeconds`, `${probeLabel}: ${intervalCheck.error!}`)
      }

      // Number of probes must be valid (min 1 per Azure spec)
      const probeCountCheck = validateProbeCount(probe.numberOfProbes)
      if (!probeCountCheck.valid) {
        addError(errors, `healthProbes[${i}].numberOfProbes`, `${probeLabel}: ${probeCountCheck.error!}`)
      }

      // Protocol-specific validation: HTTP/HTTPS require requestPath; TCP does not
      if ((probe.protocol === 'Http' || probe.protocol === 'Https') && !probe.requestPath) {
        addError(errors, `healthProbes[${i}].requestPath`, `${probeLabel}: Request path required for ${probe.protocol}`, 'warning')
      }
    }
  }

  // Load balancing rules validation if present
  if (data.loadBalancingRules && Array.isArray(data.loadBalancingRules)) {
    for (let i = 0; i < data.loadBalancingRules.length; i++) {
      const rule = data.loadBalancingRules[i]
      const ruleLabel = `Rule "${rule.name || i}"`

      // Protocol must be valid (normalized to lowercase)
      if (!['Tcp', 'Udp', 'All'].includes(rule.protocol)) {
        addError(errors, `loadBalancingRules[${i}].protocol`, `${ruleLabel}: Protocol must be Tcp, Udp, or All`)
      }

      // Frontend port must be valid (1-65535)
      if (rule.frontendPort === undefined || rule.frontendPort === null) {
        addError(errors, `loadBalancingRules[${i}].frontendPort`, `${ruleLabel}: Frontend port is required`)
      } else {
        const fPortCheck = validatePortRange(rule.frontendPort)
        if (!fPortCheck.valid) {
          addError(errors, `loadBalancingRules[${i}].frontendPort`, `${ruleLabel}: ${fPortCheck.error!}`)
        }
      }

      // Backend port must be valid (1-65535)
      if (rule.backendPort === undefined || rule.backendPort === null) {
        addError(errors, `loadBalancingRules[${i}].backendPort`, `${ruleLabel}: Backend port is required`)
      } else {
        const bPortCheck = validatePortRange(rule.backendPort)
        if (!bPortCheck.valid) {
          addError(errors, `loadBalancingRules[${i}].backendPort`, `${ruleLabel}: ${bPortCheck.error!}`)
        }
      }

      // Frontend IP config must exist
      if (rule.frontendIpId && !findNodesByType(NetworkComponentType.LOAD_BALANCER, nodes).some(n => n.data?.frontendIpConfigs?.some((fe: any) => fe.id === rule.frontendIpId))) {
        addError(errors, `loadBalancingRules[${i}].frontendIpId`, `${ruleLabel}: Referenced frontend IP config does not exist`, 'warning')
      }

      // Backend pool must exist (reference check)
      if (rule.backendPoolId && !findNodesByType(NetworkComponentType.LOAD_BALANCER, nodes).some(n => n.data?.backendPools?.some((bp: any) => bp.id === rule.backendPoolId))) {
        addError(errors, `loadBalancingRules[${i}].backendPoolId`, `${ruleLabel}: Referenced backend pool does not exist`, 'warning')
      }

      // Idle timeout if set per rule must be 4-30 minutes (optional, future enhancement)
      if (rule.idleTimeoutInMinutes !== undefined && rule.idleTimeoutInMinutes !== null) {
        const timeout = parseInt(String(rule.idleTimeoutInMinutes), 10)
        if (isNaN(timeout) || timeout < 4 || timeout > 30) {
          addError(errors, `loadBalancingRules[${i}].idleTimeoutInMinutes`, `${ruleLabel}: Idle timeout must be 4-30 minutes`, 'warning')
        }
      }
    }
  }

  // Frontend IP configs validation
  if (data.frontendIpConfigs && Array.isArray(data.frontendIpConfigs)) {
    for (let i = 0; i < data.frontendIpConfigs.length; i++) {
      const feCfg = data.frontendIpConfigs[i]

      if (data.loadBalancerType === 'Public') {
        // Public LB: must have valid public IP
        if (feCfg.publicIpId) {
          if (!nodeExists(feCfg.publicIpId, nodes)) {
            addError(errors, 'frontendIpConfigs', 'Referenced public IP does not exist', 'warning')
          } else {
            // Public IP must be Standard SKU (per Azure requirement)
            const ipNode = findNodesByType(NetworkComponentType.IP_ADDRESS, nodes).find(n => n.id === feCfg.publicIpId)
            if (ipNode && ipNode.data?.sku && ipNode.data.sku !== 'Standard') {
              addError(errors, 'frontendIpConfigs', `Public Load Balancer requires Standard SKU public IP, got ${ipNode.data.sku}`, 'warning')
            }
            // Public IP should be Static allocation (per Azure requirement)
            if (ipNode && ipNode.data?.allocationMethod && ipNode.data.allocationMethod !== 'Static') {
              addError(errors, 'frontendIpConfigs', 'Public Load Balancer requires Static IP allocation', 'warning')
            }
          }
        } else {
          addError(errors, 'frontendIpConfigs', 'Public Load Balancer requires a public IP address', 'warning')
        }
      } else {
        // Internal LB: must have valid subnet
        if (feCfg.subnetId) {
          if (!nodeExists(feCfg.subnetId, nodes)) {
            addError(errors, 'frontendIpConfigs', 'Referenced subnet does not exist', 'warning')
          }
        } else {
          addError(errors, 'frontendIpConfigs', 'Internal Load Balancer requires a subnet', 'warning')
        }
      }
    }
  }

  // Backend pool sizing warning: Standard LB supports up to 5,000 endpoints per pool (Azure limit)
  if (data.sku === 'Standard' && data.backendPools && Array.isArray(data.backendPools)) {
    for (const pool of data.backendPools) {
      const nicCount = pool.nicIds?.length || 0
      if (nicCount > 4500) {
        addError(errors, 'backendPools', `Backend pool "${pool.name}" has ${nicCount} NICs; max 5,000 endpoints per pool (Standard LB limit)`, 'warning')
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * App Gateway v2 validator: capacity, autoscaling, idle timeout, health probes, 
 * availability zones, and Well-Architected Framework recommendations
 */
function validateAppGateway(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []
  const normalized = normalizeComponentKeyVaultReferences(data, nodes)

  // SKU must be v2 only (Standard_v2 or WAF_v2)
  if (!data.sku || !['Standard_v2', 'WAF_v2'].includes(data.sku)) {
    addError(errors, 'sku', 'SKU must be Standard_v2 or WAF_v2')
  }

  // Capacity/instances must be 1-32 (for fixed capacity mode)
  const capacityCheck = validateCapacity(data.capacity, 1, 32)
  if (!capacityCheck.valid) {
    addError(errors, 'capacity', capacityCheck.error!)
  }

  // Autoscaling: minInstances and maxInstances must be 1-125
  if (data.minInstances !== undefined) {
    const minCheck = validateCapacity(data.minInstances, 1, 125)
    if (!minCheck.valid) {
      addError(errors, 'minInstances', `Min instances: ${minCheck.error!}`)
    }
  }

  if (data.maxInstances !== undefined) {
    const maxCheck = validateCapacity(data.maxInstances, 1, 125)
    if (!maxCheck.valid) {
      addError(errors, 'maxInstances', `Max instances: ${maxCheck.error!}`)
    }
  }

  // If both autoscaling limits set, min must be <= max
  if (
    data.minInstances !== undefined &&
    data.maxInstances !== undefined &&
    data.minInstances > data.maxInstances
  ) {
    addError(errors, 'minInstances', 'Min instances cannot exceed max instances')
  }

  // Idle timeout must be 4-30 minutes (v2 supports up to 30 vs v1's 4 min)
  if (data.idleTimeoutInMinutes !== undefined) {
    const idleTimeout = parseInt(String(data.idleTimeoutInMinutes), 10)
    if (isNaN(idleTimeout) || idleTimeout < 4 || idleTimeout > 30) {
      addError(errors, 'idleTimeoutInMinutes', 'Idle timeout must be 4-30 minutes')
    }
  }

  // Subnet required (always required for v2)
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Subnet is required')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  } else {
    // Check subnet size recommendation (/24 recommended for v2 with up to 125 instances)
    const subnet = nodes.find(n => n.id === data.subnetId)
    if (subnet?.data?.addressPrefix) {
      const cidr = subnet.data.addressPrefix
      const parts = cidr.split('/')[1]
      if (parts && parseInt(parts) > 24) {
        addError(
          errors,
          'subnetId',
          'Subnet /24 or larger recommended for v2 autoscaling (supports 125+ instances)',
          'warning'
        )
      }
    }
  }

  // Frontend Type
  if (!data.frontendType || !['Public', 'Internal'].includes(data.frontendType)) {
    addError(errors, 'frontendType', 'Frontend type must be Public or Internal')
  }

  // Public frontend IP validation
  if (data.frontendType === 'Public') {
    if (!data.frontendIpId) {
      addError(errors, 'frontendIpId', 'Public IP is required for public frontend')
    } else if (!nodeExists(data.frontendIpId, nodes)) {
      addError(errors, 'frontendIpId', 'Referenced public IP does not exist')
    } else {
      // Validate public IP properties (SKU should be Standard, allocation should be Static)
      const pip = nodes.find(n => n.id === data.frontendIpId)
      if (pip?.data) {
        if (pip.data.sku !== 'Standard') {
          addError(
            errors,
            'frontendIpId',
            'Public IP SKU must be Standard (found: ' + pip.data.sku + ')',
            'warning'
          )
        }
        if (pip.data.allocationMethod !== 'Static') {
          addError(
            errors,
            'frontendIpId',
            'Public IP allocation must be Static (found: ' + pip.data.allocationMethod + ')',
            'warning'
          )
        }
      }
    }
  } else {
    // Internal frontend: frontendIpId should be optional or point to private IP
    if (data.frontendIpId && !nodeExists(data.frontendIpId, nodes)) {
      addError(errors, 'frontendIpId', 'Referenced frontend IP does not exist', 'warning')
    }
  }

  // Availability zones validation (zone redundancy best practice)
  if (data.availabilityZones && Array.isArray(data.availabilityZones)) {
    const validZones = ['1', '2', '3']
    for (const zone of data.availabilityZones) {
      if (!validZones.includes(String(zone))) {
        addError(errors, 'availabilityZones', `Invalid zone "${zone}"; must be 1, 2, or 3`)
      }
    }
  } else {
    // Warn if no availability zones (not zone-redundant)
    addError(
      errors,
      'availabilityZones',
      'No availability zones specified; 2+ zones recommended for zone redundancy',
      'warning'
    )
  }

  if (data.availabilityZones && data.availabilityZones.length === 1) {
    addError(
      errors,
      'availabilityZones',
      'Only 1 zone specified; 2+ zones recommended for zone redundancy',
      'warning'
    )
  }

  // Key Vault certificate validation (security best practice for TLS)
  if (!normalized.keyVaultCertificateName && !normalized.keyVaultCertificateId && data.frontendType === 'Public') {
    addError(
      errors,
      'keyVaultCertificateName',
      'Key Vault certificate recommended for TLS termination on public frontend',
      'warning'
    )
  }

  const hasKeyVaultCertificateConfig = Boolean(
    normalized.keyVaultId
    || normalized.keyVaultCertificateName
    || (typeof normalized.keyVaultCertificateId === 'string' && normalized.keyVaultCertificateId.trim()),
  )

  if (hasKeyVaultCertificateConfig) {
    if (!normalized.keyVaultId) {
      addError(errors, 'keyVaultId', 'Key Vault certificate reference could not be matched to a Key Vault node in the diagram', 'warning')
    } else {
      const keyVaultNode = getKeyVaultNode(normalized.keyVaultId, nodes)
      if (!keyVaultNode) {
        addError(errors, 'keyVaultId', 'Referenced Key Vault does not exist', 'warning')
      } else if (
        keyVaultNode.data?.networkDefaultAction === 'Deny'
        && keyVaultNode.data?.allowTrustedMicrosoftServices !== true
        && (!Array.isArray(keyVaultNode.data?.virtualNetworkRules) || !keyVaultNode.data.virtualNetworkRules.includes(data.subnetId))
      ) {
        addError(errors, 'keyVaultId', 'Selected Key Vault is network-restricted; allow trusted services or add the Application Gateway subnet to the vault firewall', 'warning')
      }
    }

    if (!normalized.keyVaultCertificateName) {
      addError(errors, 'keyVaultCertificateName', 'Certificate name is required when configuring a Key Vault certificate reference')
    } else if (!isValidKeyVaultObjectName(String(normalized.keyVaultCertificateName))) {
      addError(errors, 'keyVaultCertificateName', 'Certificate name must be 1-127 characters and contain only letters, numbers, or hyphens')
    }

    if (normalized.keyVaultCertificateVersion && !isValidKeyVaultObjectVersion(String(normalized.keyVaultCertificateVersion))) {
      addError(errors, 'keyVaultCertificateVersion', 'Certificate version should be a 32-character hexadecimal Key Vault object version', 'warning')
    }

    if (!normalized.keyVaultManagedIdentityId) {
      addError(errors, 'keyVaultManagedIdentityId', 'A user-assigned managed identity is required for Application Gateway Key Vault certificate integration')
    } else {
      const identityNode = findNodeById(normalized.keyVaultManagedIdentityId, nodes)
      if (!identityNode) {
        addError(errors, 'keyVaultManagedIdentityId', 'Referenced managed identity does not exist')
      } else if (identityNode.data?.type !== NetworkComponentType.MANAGED_IDENTITY) {
        addError(errors, 'keyVaultManagedIdentityId', 'Referenced resource is not a managed identity')
      } else if (identityNode.data?.identityType !== 'UserAssigned') {
        addError(errors, 'keyVaultManagedIdentityId', 'Application Gateway must use a user-assigned managed identity for Key Vault certificate integration')
      }
    }
  }

  // WAF mode validation
  if (data.enableWaf && (!data.wafMode || !['Detection', 'Prevention'].includes(data.wafMode))) {
    addError(errors, 'wafMode', 'WAF mode must be Detection or Prevention when WAF is enabled')
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

      // Interval must be valid (5-300 seconds)
      const intervalCheck = validateProbeInterval(probe.intervalInSeconds)
      if (!intervalCheck.valid) {
        addError(errors, `healthProbes[${i}].intervalInSeconds`, `${probeLabel}: ${intervalCheck.error!}`)
      }

      // Number of probes must be valid (unhealthy threshold)
      const probeCountCheck = validateProbeCount(probe.numberOfProbes)
      if (!probeCountCheck.valid) {
        addError(errors, `healthProbes[${i}].numberOfProbes`, `${probeLabel}: ${probeCountCheck.error!}`)
      }
    }
  }

  // Load balancing rules validation
  if (data.loadBalancingRules && Array.isArray(data.loadBalancingRules)) {
    for (let i = 0; i < data.loadBalancingRules.length; i++) {
      const rule = data.loadBalancingRules[i]
      const ruleLabel = `Rule "${rule.name || i}"`

      if (!rule.frontendPort || !rule.backendPort) {
        addError(errors, `loadBalancingRules[${i}]`, `${ruleLabel}: Frontend and backend ports required`)
      }

      if (rule.frontendPort) {
        const portCheck = validatePortRange(rule.frontendPort)
        if (!portCheck.valid) {
          addError(errors, `loadBalancingRules[${i}].frontendPort`, `${ruleLabel}: ${portCheck.error!}`)
        }
      }

      if (rule.backendPort) {
        const portCheck = validatePortRange(rule.backendPort)
        if (!portCheck.valid) {
          addError(errors, `loadBalancingRules[${i}].backendPort`, `${ruleLabel}: ${portCheck.error!}`)
        }
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

  // Gateway transit mutual exclusivity: cannot enable both allowGatewayTransit and useRemoteGateways
  if (data.allowGatewayTransit && data.useRemoteGateways) {
    addError(
      errors,
      'allowGatewayTransit',
      'Cannot enable both "Allow Gateway Transit" and "Use Remote Gateways" on the same peering. Enable only one option.'
    )
  }

  // Check for address space overlap between peered VNets (warning only)
  if (data.localVnetId && data.remoteVnetId && data.localVnetId !== data.remoteVnetId) {
    const localVnet = nodes.find(n => n.id === data.localVnetId)?.data
    const remoteVnet = nodes.find(n => n.id === data.remoteVnetId)?.data

    if (localVnet?.addressSpace && remoteVnet?.addressSpace) {
      const localCidrs = localVnet.addressSpace || []
      const remoteCidrs = remoteVnet.addressSpace || []

      for (const localCidr of localCidrs) {
        for (const remoteCidr of remoteCidrs) {
          if (cidrOverlaps(localCidr, remoteCidr)) {
            addError(
              errors,
              'remoteVnetId',
              `Address space overlap detected: ${localCidr} overlaps with remote VNet's ${remoteCidr}. Peered VNets should have non-overlapping address spaces.`,
              'warning'
            )
            break
          }
        }
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * VPN Gateway validator: subnet required, GatewaySubnet name enforced, deprecation warnings
 */
function validateVpnGateway(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet required
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Gateway subnet is required')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  } else {
    // Validate GatewaySubnet name
    const subnet = nodes.find((n: any) => n.id === data.subnetId)?.data
    if (subnet && subnet.name !== 'GatewaySubnet') {
      addError(errors, 'subnetId', `Azure requires subnet name 'GatewaySubnet', but got '${subnet.name}'`)
    }
  }

  // Basic SKU warning (no SLA)
  if (data.sku === 'Basic') {
    addError(errors, 'sku', 'Basic SKU has no SLA; use VpnGw1 or higher for production', 'warning')
  }

  // Non-AZ SKU deprecation warning (Sep 30, 2026 retirement)
  const nonAzSkus = ['VpnGw1', 'VpnGw2', 'VpnGw3', 'VpnGw4', 'VpnGw5']
  if (nonAzSkus.includes(data.sku)) {
    addError(
      errors,
      'sku',
      'Non-AZ SKU retiring Sep 30, 2026; prefer VpnGw1AZ-5AZ for new deployments',
      'warning'
    )
  }

  // Active-Active + BGP consistency check
  if (data.activeActive && !data.bgpSettings?.asn) {
    addError(
      errors,
      'bgpSettings',
      'BGP recommended for active-active mode; configure BGP ASN for high availability',
      'warning'
    )
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * NVA validator: subnet required, IP forwarding, marketplace image, availability zones, public IP
 */
function validateNva(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet required
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Subnet is required')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  }

  // Public IP reference must exist if set
  if (data.publicIpId && !nodeExists(data.publicIpId, nodes)) {
    addError(errors, 'publicIpId', 'Referenced public IP does not exist')
  }

  // IP forwarding should be enabled — required for NVA routing
  if (!data.enableIpForwarding) {
    addError(
      errors,
      'enableIpForwarding',
      'IP forwarding should be enabled. Without it, Azure drops packets not destined for the NVA\'s own IP address.',
      'warning',
    )
  }

  // VM size should be specified
  if (!data.vmSize || (data.vmSize as string).trim() === '') {
    addError(errors, 'vmSize', 'VM size should be specified (e.g. Standard_D4s_v3, Standard_F8s_v2)', 'warning')
  }

  // Marketplace image info — warn only when all three are empty
  if (
    (!data.publisher || (data.publisher as string).trim() === '') &&
    (!data.offer || (data.offer as string).trim() === '') &&
    (!data.sku || (data.sku as string).trim() === '')
  ) {
    addError(
      errors,
      'publisher',
      'Azure Marketplace image info (publisher, offer, SKU) should be provided for actual deployment',
      'warning',
    )
  }

  // Availability zones must be valid values
  if (data.availabilityZones && Array.isArray(data.availabilityZones) && data.availabilityZones.length > 0) {
    const validZones = ['1', '2', '3']
    const invalidZones = (data.availabilityZones as string[]).filter(z => !validZones.includes(z))
    if (invalidZones.length > 0) {
      addError(
        errors,
        'availabilityZones',
        `Invalid availability zones: ${invalidZones.join(', ')}. Valid values are 1, 2, 3.`,
        'warning',
      )
    }
  }

  return { isValid: errors.filter((e: any) => e.severity === 'error').length === 0, errors }
}

/**
 * Helper: Check if prefix is a special Azure value (service tag or wildcard)
 */
function isSpecialPrefix(prefix: string): boolean {
  if (!prefix || typeof prefix !== 'string') return false
  
  // Wildcard
  if (prefix === '*') return true
  
  // Known service tags (non-exhaustive; expanded from original list)
  const serviceTagsList = [
    'VirtualNetwork',
    'Internet',
    'AzureLoadBalancer',
    'AzureTrafficManager',
    'AzureEventHub',
    'AzureServiceBus',
    'AzureStorageAccount',
    'AzureCosmosDB',
    'AzureApplied',
    'AzurePlatformDNS',
    'AzurePlatformIMDS',
    'AzurePlatformLKM',
    'AppService',
    'AppServiceManagement',
    'Storage',
    'StorageAccount',
    'KeyVault',
    'Sql',
    'SqlManagement',
    'AzureContainerRegistry',
    'AzureActiveDirectory',
    'AzureResourceManager',
    'AzureSqlDatabase',
    'AzureMonitor',
  ]
  
  return serviceTagsList.includes(prefix)
}

/**
 * Compute validators (VM, VMSS, AKS, App Service, Functions)
 */
function validateCompute(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Subnet reference (most compute types need it)
  if (data.type !== NetworkComponentType.VM && data.subnetId && !nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist', 'warning')
  }

  validateUserAssignedIdentityReferences(data, nodes, errors)

  // VM-specific
  if (data.type === NetworkComponentType.VM) {
    if (!data.size || data.size.trim() === '') {
      addError(errors, 'size', 'VM size is required')
    }

    if (!data.adminUsername || data.adminUsername.trim() === '') {
      addError(errors, 'adminUsername', 'Admin username is required')
    }

    if (!data.os || !['Windows', 'Linux'].includes(data.os)) {
      addError(errors, 'os', 'OS must be Windows or Linux')
    }

    const nicIds = Array.isArray(data.nicIds) ? data.nicIds : []
    if (nicIds.length === 0) {
      addError(errors, 'nicIds', 'At least one NIC must be attached to the VM')
    } else {
      const nicNodes = nicIds
        .map((nicId: string) => nodes.find((n: any) => n.id === nicId))
        .filter(Boolean)

      if (nicNodes.length !== nicIds.length) {
        addError(errors, 'nicIds', 'One or more attached NICs do not exist')
      }

      const invalidTypeNic = nicNodes.find((nic: any) => nic?.data?.type !== NetworkComponentType.NETWORK_IC)
      if (invalidTypeNic) {
        addError(errors, 'nicIds', 'Attached resources must be Network Interface (NIC) components')
      }

      const nicSubnets = nicNodes
        .map((nic: any) => nic?.data?.subnetId)
        .filter((id: string | undefined) => !!id)

      if (nicSubnets.length !== nicNodes.length) {
        addError(errors, 'nicIds', 'Each attached NIC must be connected to a subnet')
      }

      const firstNicSubnetId = nicSubnets[0]

      if (data.subnetId && firstNicSubnetId && data.subnetId !== firstNicSubnetId) {
        addError(errors, 'subnetId', 'VM subnet must match the subnet of the first attached NIC')
      }

      if (data.subnetId && !nodeExists(data.subnetId, nodes)) {
        addError(errors, 'subnetId', 'Referenced subnet does not exist')
      }

      const nicVnetIds = nicSubnets
        .map((subnetId: string) => nodes.find((n: any) => n.id === subnetId))
        .map((subnetNode: any) => subnetNode?.data?.vnetId || subnetNode?.parentNode)
        .filter((id: string | undefined) => !!id)

      const uniqueVnetIds = Array.from(new Set(nicVnetIds))
      if (uniqueVnetIds.length > 1) {
        addError(errors, 'nicIds', 'All NICs attached to a VM must be in the same VNet')
      }
    }

    if (data.availabilityZone && !['1', '2', '3'].includes(String(data.availabilityZone))) {
      addError(errors, 'availabilityZone', 'Availability zone must be 1, 2, or 3')
    }

    if (data.diskType && !['Standard_LRS', 'StandardSSD_LRS', 'Premium_LRS'].includes(String(data.diskType))) {
      addError(errors, 'diskType', 'Disk type must be Standard_LRS, StandardSSD_LRS, or Premium_LRS')
    }

    if (!data.imagePublisher || !data.imageOffer || !data.imageSku) {
      addError(errors, 'imagePublisher', 'Image publisher/offer/SKU are recommended for deployment realism', 'warning')
    }
  }

  // VMSS-specific
  if (data.type === NetworkComponentType.VMSS) {
    // Required fields
    if (!data.sku || data.sku.trim() === '') {
      addError(errors, 'sku', 'VM SKU is required')
    }

    if (!data.os || !['Windows', 'Linux'].includes(data.os)) {
      addError(errors, 'os', 'OS must be Windows or Linux')
    }

    if (!data.orchestrationMode || !['Flexible', 'Uniform'].includes(data.orchestrationMode)) {
      addError(errors, 'orchestrationMode', 'Orchestration mode is required and must be Flexible or Uniform')
    }

    // Capacity validation (0-1000 allowed; allows empty scale set)
    if (data.capacity === undefined || data.capacity === null) {
      addError(errors, 'capacity', 'Initial capacity is required')
    } else if (data.capacity < 0 || data.capacity > 1000) {
      addError(errors, 'capacity', 'Capacity must be between 0 and 1000')
    }

    // Subnet validation
    if (!data.subnetId || data.subnetId.trim() === '') {
      addError(errors, 'subnetId', 'Subnet is required')
    } else if (!nodeExists(data.subnetId, nodes)) {
      addError(errors, 'subnetId', 'Referenced subnet does not exist')
    }

    // Image validation (recommended but not required)
    if (!data.imagePublisher || !data.imageOffer || !data.imageSku) {
      addError(errors, 'imagePublisher', 'Image publisher/offer/SKU are recommended for deployment realism', 'warning')
    }

    // Availability zones validation
    if (Array.isArray(data.availabilityZones) && data.availabilityZones.length > 0) {
      const invalidZones = data.availabilityZones.filter((z: any) => !['1', '2', '3'].includes(String(z)))
      if (invalidZones.length > 0) {
        addError(errors, 'availabilityZones', 'Availability zones must contain only 1, 2, or 3', 'warning')
      }
      if (data.availabilityZones.length < 2) {
        addError(errors, 'availabilityZones', 'Fewer than 2 availability zones reduces SLA from 99.99% to 99.95%; consider adding more zones for reliability', 'warning')
      }
    }

    // Scale-in policy validation (Flexible mode feature)
    if (data.scaleInPolicy && !['FIFO', 'OldestVM', 'NewestVM'].includes(data.scaleInPolicy)) {
      addError(errors, 'scaleInPolicy', 'Scale-in policy must be FIFO, OldestVM, or NewestVM', 'warning')
    }

    // Autoscaling validation
    if (data.autoscaleEnabled) {
      const minCap = data.minCapacity ?? 0
      const maxCap = data.maxCapacity ?? 1000

      if (minCap < 0 || minCap > 1000) {
        addError(errors, 'minCapacity', 'Min capacity must be between 0 and 1000')
      }

      if (maxCap < 0 || maxCap > 1000) {
        addError(errors, 'maxCapacity', 'Max capacity must be between 0 and 1000')
      }

      if (minCap > maxCap) {
        addError(errors, 'minCapacity', 'Min capacity must be <= max capacity')
      }

      if (minCap === maxCap) {
        addError(errors, 'minCapacity', 'Min and max capacity are equal; autoscaling will not take effect', 'warning')
      }
    }

    // Orchestration mode-specific warnings
    if (data.orchestrationMode === 'Uniform') {
      if (data.overprovision !== false) {
        addError(errors, 'overprovision', 'Default overprovision=true creates extra VMs during deployment; consider implications for strict instance count requirements', 'warning')
      }
    }
  }

  // AKS-specific
  if (data.type === NetworkComponentType.AKS) {
    const supportedK8sVersions = ['1.28', '1.29', '1.30', '1.31', '1.32', '1.33', '1.34', '1.35']

    // Required field checks (Error severity)
    if (!data.kubernetesVersion || data.kubernetesVersion.trim() === '') {
      addError(errors, 'kubernetesVersion', 'Kubernetes version is required')
    } else {
      const version = data.kubernetesVersion.trim()
      const isSupported = supportedK8sVersions.some(v => version.startsWith(v))
      if (!isSupported) {
        addError(errors, 'kubernetesVersion', `Kubernetes version must be one of: ${supportedK8sVersions.join(', ')} (N-2 support policy)`)
      }
    }

    if (!data.networkPlugin || !['kubenet', 'azure', 'azure-overlay'].includes(data.networkPlugin)) {
      addError(errors, 'networkPlugin', 'Network plugin must be kubenet, azure, or azure-overlay')
    }

    if (!data.apiServerAccess || !['Public', 'Private'].includes(data.apiServerAccess)) {
      addError(errors, 'apiServerAccess', 'API server access must be Public or Private')
    }

    if (data.pricingTier && !['Free', 'Standard', 'Premium'].includes(data.pricingTier)) {
      addError(errors, 'pricingTier', 'Pricing tier must be Free, Standard, or Premium')
    }

    // Subnet validation
    if (!data.subnetId || data.subnetId.trim() === '') {
      addError(errors, 'subnetId', 'Subnet is required')
    } else if (!nodeExists(data.subnetId, nodes)) {
      addError(errors, 'subnetId', 'Referenced subnet does not exist')
    }

    // Node count validation
    if (data.nodeCount !== undefined && data.nodeCount !== null) {
      if (data.nodeCount < 1 || data.nodeCount > 1000) {
        addError(errors, 'nodeCount', 'Node count must be between 1 and 1000')
      }
    }

    // System node pool validation
    if (data.systemNodePoolSize !== undefined && data.systemNodePoolSize !== null) {
      if (data.systemNodePoolSize < 1 || data.systemNodePoolSize > 1000) {
        addError(errors, 'systemNodePoolSize', 'System node pool size must be between 1 and 1000')
      }
    }

    // Autoscaler validation
    if (data.enableClusterAutoscaler) {
      const minNodes = data.minNodeCount ?? 1
      const maxNodes = data.maxNodeCount ?? 1000

      if (minNodes < 1 || minNodes > 1000) {
        addError(errors, 'minNodeCount', 'Min node count must be between 1 and 1000')
      }

      if (maxNodes < 1 || maxNodes > 1000) {
        addError(errors, 'maxNodeCount', 'Max node count must be between 1 and 1000')
      }

      if (minNodes > maxNodes) {
        addError(errors, 'minNodeCount', 'Min node count must be <= max node count')
      }
    }

    // Availability zones validation
    if (Array.isArray(data.availabilityZones) && data.availabilityZones.length > 0) {
      const invalidZones = data.availabilityZones.filter((z: any) => !['1', '2', '3'].includes(String(z)))
      if (invalidZones.length > 0) {
        addError(errors, 'availabilityZones', 'Availability zones must contain only 1, 2, or 3', 'warning')
      }
      if (data.availabilityZones.length < 2) {
        addError(errors, 'availabilityZones', 'Fewer than 2 availability zones: SLA 99.95% (single zone) vs 99.99% (2+ zones); consider adding zones', 'warning')
      }
    } else {
      addError(errors, 'availabilityZones', 'Availability zones not set: cluster is zone-unaware (99.95% SLA); recommend 2+ zones for 99.99% SLA', 'warning')
    }

    // OS validation
    if (data.osSku && !['Ubuntu', 'AzureLinux', 'Windows2022'].includes(data.osSku)) {
      addError(errors, 'osSku', 'OS SKU must be Ubuntu, AzureLinux, or Windows2022')
    }

    // Network policy validation
    if (data.enableNetworkPolicy && data.networkPolicyProvider && !['azure', 'calico'].includes(data.networkPolicyProvider)) {
      addError(errors, 'networkPolicyProvider', 'Network policy provider must be azure or calico')
    }

    // Outbound type validation
    if (data.outboundType && !['loadBalancer', 'userDefinedRouting', 'managedNAT'].includes(data.outboundType)) {
      addError(errors, 'outboundType', 'Outbound type must be loadBalancer, userDefinedRouting, or managedNAT')
    }

    // Load balancer SKU validation
    if (data.loadBalancerSku && !['Basic', 'Standard'].includes(data.loadBalancerSku)) {
      addError(errors, 'loadBalancerSku', 'Load balancer SKU must be Basic or Standard')
    }

    // Well-Architected warnings
    if (!data.nodeCount || data.nodeCount < 2) {
      addError(errors, 'nodeCount', 'User node pool should have >= 2 nodes for high availability; consider min 2-3 for production', 'warning')
    }

    if (data.systemNodePoolSize && data.systemNodePoolSize < 3) {
      addError(errors, 'systemNodePoolSize', 'System node pool recommended with >= 3 nodes for production reliability; smaller pools risk service disruption', 'warning')
    }

    if (data.enableClusterAutoscaler !== false) {
      // Autoscaler enabled (default true) - no warning
    } else {
      addError(errors, 'enableClusterAutoscaler', 'Cluster autoscaler recommended for production workloads to handle demand spikes; consider enabling', 'warning')
    }

    if (data.apiServerAccess === 'Public') {
      addError(errors, 'apiServerAccess', 'Public API server access reduces security posture; Private clusters recommended for production workloads', 'warning')
    }

    if (data.enableNetworkPolicy !== true) {
      addError(errors, 'enableNetworkPolicy', 'Network policies recommended for additional security and network microsegmentation; currently disabled', 'warning')
    }

    if (data.enableMonitoring !== true) {
      addError(errors, 'enableMonitoring', 'Monitoring via Container Insights recommended for observability, troubleshooting, and compliance; currently disabled', 'warning')
    }

    if (data.pricingTier === 'Free') {
      addError(errors, 'pricingTier', 'Free tier has no SLA and is recommended for dev/test only; use Standard for production workloads', 'warning')
    }

    if (data.kubernetesVersion) {
      const version = data.kubernetesVersion.trim()
      const latestStable = '1.35' // Update this as new versions release
      if (!version.startsWith(latestStable)) {
        addError(errors, 'kubernetesVersion', `Consider upgrading to latest Kubernetes version (${latestStable}) for latest security patches and features`, 'warning')
      }
    }

    if (!data.nodeVmSize || data.nodeVmSize.trim() === '') {
      addError(errors, 'nodeVmSize', 'Node VM size is recommended; e.g., Standard_D4s_v5', 'warning')
    } else {
      const vmSize = data.nodeVmSize.toUpperCase()
      // Simple check for common minimum sizes (D2, B2, etc. are too small)
      if (vmSize.includes('_B1') || vmSize.includes('_D2S') || vmSize.includes('_D2_')) {
        addError(errors, 'nodeVmSize', 'VM size too small; recommend minimum D2s_v3 or larger (4GB RAM+) for AKS nodes', 'warning')
      }
    }

    if (!data.enableRbac) {
      addError(errors, 'enableRbac', 'RBAC is required for Kubernetes authentication and authorization; must be enabled', 'warning')
    }

    if (data.networkPlugin === 'kubenet') {
      addError(errors, 'networkPlugin', 'Kubenet plugin is basic networking; Azure CNI recommended for production workloads with advanced networking needs', 'warning')
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Storage validators (Storage Account, Blob Storage, Managed Disk)
 */
function validateStorage(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Managed Disk comprehensive validation
  if (data.type === NetworkComponentType.MANAGED_DISK) {
    data = normalizeManagedDiskData(data)

    // Disk type validation (required)
    if (!data.diskType || !Object.values(ManagedDiskType).includes(data.diskType)) {
      addError(errors, 'diskType', `Disk type is required and must be one of: ${Object.values(ManagedDiskType).join(', ')}`)
    }

    // Redundancy validation (required)
    if (!data.redundancy || !Object.values(ManagedDiskRedundancy).includes(data.redundancy)) {
      addError(errors, 'redundancy', `Redundancy is required and must be LRS or ZRS`)
    }

    // Redundancy compatibility with disk type
    const managedDiskType = data.diskType as ManagedDiskType | undefined
    if (managedDiskType && data.redundancy && MANAGED_DISK_REDUNDANCY_BY_TYPE[managedDiskType]) {
      const validRedundancies = MANAGED_DISK_REDUNDANCY_BY_TYPE[managedDiskType]
      if (!validRedundancies.includes(data.redundancy)) {
        addError(errors, 'redundancy', `Redundancy ${data.redundancy} is not supported for ${data.diskType}; supported options: ${validRedundancies.join(', ')}`)
      }
    }

    // Disk role validation (required)
    if (!data.diskRole || !Object.values(ManagedDiskRole).includes(data.diskRole)) {
      addError(errors, 'diskRole', `Disk role is required and must be ${Object.values(ManagedDiskRole).join(' or ')}`)
    }

    // OS disk cannot use Ultra or Premium SSD v2
    if (data.diskRole === ManagedDiskRole.OS) {
      if (data.diskType === ManagedDiskType.ULTRA) {
        addError(errors, 'diskType', 'Ultra Disks cannot be used as OS disks (data disks only)')
      }
      if (data.diskType === ManagedDiskType.PREMIUM_SSD_V2) {
        addError(errors, 'diskType', 'Premium SSD v2 cannot be used as OS disks; use Premium SSD, Standard SSD, or Standard HDD')
      }
    }

    // Standard HDD as OS disk (deprecating Sept 8, 2028)
    if (data.diskRole === ManagedDiskRole.OS && data.diskType === ManagedDiskType.STANDARD_HDD) {
      addError(errors, 'diskType', 'Standard HDD as OS disk is retiring September 8, 2028; migrate to Premium SSD or Standard SSD before retirement', 'warning')
    }

    // Disk size validation with per-type ranges
    if (data.diskSizeGb === undefined || data.diskSizeGb === null) {
      addError(errors, 'diskSizeGb', 'Disk size is required')
    } else if (managedDiskType && MANAGED_DISK_SIZE_LIMITS[managedDiskType]) {
      const { min, max } = MANAGED_DISK_SIZE_LIMITS[managedDiskType]
      if (!Number.isInteger(Number(data.diskSizeGb))) {
        addError(errors, 'diskSizeGb', 'Disk size must be a whole number of GiB')
      } else if (data.diskSizeGb < min || data.diskSizeGb > max) {
        addError(errors, 'diskSizeGb', `Disk size must be ${min}-${max} GB for ${data.diskType}`)
      }
    }

    // IOPS/throughput validation (only valid for Ultra and Premium SSD v2)
    const performanceConfigDiskTypes = [ManagedDiskType.ULTRA, ManagedDiskType.PREMIUM_SSD_V2]
    if (data.iops !== undefined && data.iops !== null && !performanceConfigDiskTypes.includes(data.diskType)) {
      addError(errors, 'iops', `IOPS configuration is only applicable to ${performanceConfigDiskTypes.join(' and ')}`, 'warning')
    }
    if (data.throughput !== undefined && data.throughput !== null && !performanceConfigDiskTypes.includes(data.diskType)) {
      addError(errors, 'throughput', `Throughput configuration is only applicable to ${performanceConfigDiskTypes.join(' and ')}`, 'warning')
    }

    // Ultra Disk IOPS/throughput constraints (1000 IOPS/GiB, up to 400,000 IOPS; 0.25 MB/s per IOPS)
    if (data.diskType === ManagedDiskType.ULTRA && data.diskSizeGb) {
      const limits = getUltraDiskPerformanceLimits(Number(data.diskSizeGb))
      if (data.iops !== undefined && data.iops !== null) {
        if (data.iops < limits.minIops || data.iops > limits.maxIops) {
          addError(errors, 'iops', `Ultra Disk IOPS must be ${limits.minIops}-${limits.maxIops} (1000 IOPS/GiB up to 400,000 max)`, 'warning')
        }
      }
      if (data.throughput !== undefined && data.throughput !== null && data.iops) {
        const maxThroughput = Math.min(limits.maxThroughput, data.iops * 0.25)
        if (data.throughput < 1 || data.throughput > maxThroughput) {
          addError(errors, 'throughput', `Ultra Disk throughput must be 1-${maxThroughput} MB/s (0.25 MB/s per IOPS)`, 'warning')
        }
      }
    }

    // Premium SSD v2 IOPS/throughput constraints (3000 baseline, +500 IOPS/GiB up to 80,000; 125 MB/s baseline, +0.25 MB/s per IOPS up to 2000)
    if (data.diskType === ManagedDiskType.PREMIUM_SSD_V2 && data.diskSizeGb) {
      const iopsForThroughput = data.iops !== undefined && data.iops !== null ? Number(data.iops) : 3000
      const limits = getPremiumSsdV2PerformanceLimits(Number(data.diskSizeGb), iopsForThroughput)
      if (data.iops !== undefined && data.iops !== null) {
        if (data.iops < limits.minIops || data.iops > limits.maxIops) {
          addError(errors, 'iops', `Premium SSD v2 IOPS must be ${limits.minIops}-${limits.maxIops} (baseline 3000 + 500 per GiB above 6 GiB)`, 'warning')
        }
      }
      if (data.throughput !== undefined && data.throughput !== null) {
        if (data.throughput < limits.minThroughput || data.throughput > limits.maxThroughput) {
          addError(errors, 'throughput', `Premium SSD v2 throughput must be ${limits.minThroughput}-${limits.maxThroughput} MB/s (baseline 125, up to 750 MB/s at 3000 IOPS, max 2000)`, 'warning')
        }
      }
    }

    // Data disk without attachment (warning, not error)
    if (data.diskRole === ManagedDiskRole.DATA && !data.attachedToVmId) {
      addError(errors, 'attachedToVmId', 'Data disk should be attached to a VM; currently unattached', 'warning')
    }

    // Attached VM validation (if set, must exist and be a VM)
    if (data.attachedToVmId) {
      const attachedVmNode = nodes.find((n: any) => n.id === data.attachedToVmId)
      if (!attachedVmNode) {
        addError(errors, 'attachedToVmId', 'Referenced VM does not exist')
      } else if (attachedVmNode.data?.type !== NetworkComponentType.VM) {
        addError(errors, 'attachedToVmId', 'Attached resource must be a Virtual Machine')
      } else if (data.diskRole === ManagedDiskRole.OS && data.osType && attachedVmNode.data?.os && data.osType !== attachedVmNode.data.os) {
        addError(errors, 'osType', `OS disk type (${data.osType}) must match attached VM OS (${attachedVmNode.data.os})`)
      }
    }

    if (data.diskRole === ManagedDiskRole.OS && data.attachedToVmId) {
      const duplicateOsDisk = findNodesByType(NetworkComponentType.MANAGED_DISK, nodes)
        .filter((node: any) => node.id !== data.id)
        .map((node: any) => normalizeManagedDiskData(node.data || {}))
        .find((disk: any) => disk.diskRole === ManagedDiskRole.OS && disk.attachedToVmId === data.attachedToVmId)

      if (duplicateOsDisk) {
        addError(errors, 'attachedToVmId', `VM already has an OS disk modeled: ${duplicateOsDisk.name || duplicateOsDisk.id}`)
      }
    }
  }

  if (data.type === NetworkComponentType.STORAGE_ACCOUNT || data.type === NetworkComponentType.BLOB_STORAGE) {
    const validAccountKinds = ['BlobStorage', 'BlockBlobStorage', 'FileStorage', 'Storage', 'StorageV2']
    const validReplicationsByKind: Record<string, string[]> = {
      StorageV2: ['LRS', 'GRS', 'RAGRS', 'ZRS', 'GZRS', 'RAGZRS'],
      BlobStorage: ['LRS', 'GRS', 'RAGRS'],
      Storage: ['LRS', 'GRS', 'RAGRS'],
      BlockBlobStorage: ['LRS', 'ZRS'],
      FileStorage: ['LRS', 'ZRS'],
    }

    if (!data.accountKind || !validAccountKinds.includes(data.accountKind)) {
      addError(errors, 'accountKind', `Account kind is required and must be one of: ${validAccountKinds.join(', ')}`)
    }

    if (data.accountKind && validReplicationsByKind[data.accountKind]) {
      const validReplications = validReplicationsByKind[data.accountKind]
      if (!data.replication || !validReplications.includes(data.replication)) {
        addError(errors, 'replication', `Replication for ${data.accountKind} must be one of: ${validReplications.join(', ')}`)
      }
    }

    if (data.accountKind === 'Storage' || data.accountKind === 'BlobStorage') {
      addError(errors, 'accountKind', `${data.accountKind} is a legacy storage account type; use StorageV2 for new deployments`, 'warning')
    }

    if (!data.enableHttpsOnly) {
      addError(errors, 'enableHttpsOnly', 'Require secure transfer (HTTPS only) is recommended for storage accounts', 'warning')
    }

    const validTlsVersions = ['TLS1_0', 'TLS1_1', 'TLS1_2']
    if (data.minTlsVersion && !validTlsVersions.includes(data.minTlsVersion)) {
      addError(errors, 'minTlsVersion', `Minimum TLS version must be one of: ${validTlsVersions.join(', ')}`)
    }
    if (!data.minTlsVersion) {
      addError(errors, 'minTlsVersion', 'Minimum TLS version is recommended; Azure defaults to TLS 1.2', 'warning')
    }
    if (data.minTlsVersion && ['TLS1_0', 'TLS1_1'].includes(data.minTlsVersion)) {
      addError(errors, 'minTlsVersion', `TLS ${data.minTlsVersion} is deprecated; use TLS 1.2`, 'warning')
    }

    if (data.allowBlobPublicAccess && data.accountKind === 'FileStorage') {
      addError(errors, 'allowBlobPublicAccess', 'Blob public access is not applicable to Azure Files storage accounts', 'warning')
    }

    if (data.accessTier) {
      const accessTierKinds = ['StorageV2', 'BlobStorage']
      if (!accessTierKinds.includes(data.accountKind)) {
        addError(errors, 'accessTier', `Access tier is only applicable to ${accessTierKinds.join(' and ')} account kinds`, 'warning')
      }
    } else if (['StorageV2', 'BlobStorage'].includes(data.accountKind)) {
      addError(errors, 'accessTier', 'Access tier is recommended for blob-capable storage accounts', 'warning')
    }

    if (Array.isArray(data.ipRules)) {
      if (data.ipRules.length > 400) {
        addError(errors, 'ipRules', 'Maximum 400 IP address rules are supported', 'warning')
      }
      for (const rule of data.ipRules) {
        if (!rule) continue
        const trimmedRule = String(rule).trim()
        const ipCheck = trimmedRule.includes('/')
          ? validateCIDRBlock(trimmedRule)
          : validateIPAddress(trimmedRule, 'IPv4')
        if (!ipCheck.valid) {
          addError(errors, 'ipRules', `Invalid IP rule: ${trimmedRule}`, 'warning')
          break
        }
      }
    }

    if (Array.isArray(data.virtualNetworkRules)) {
      if (data.virtualNetworkRules.length > 400) {
        addError(errors, 'virtualNetworkRules', 'Maximum 400 virtual network rules are supported', 'warning')
      }
      for (const subnetId of data.virtualNetworkRules) {
        if (subnetId && !nodeExists(subnetId, nodes)) {
          addError(errors, 'virtualNetworkRules', 'Referenced subnet does not exist', 'warning')
          break
        }
      }
    }

    // Shared key access validation (Security best practice)
    if (data.allowSharedKeyAccess !== false) {
      addError(errors, 'allowSharedKeyAccess', 'Shared key authorization is allowed; Azure recommends disabling shared keys and using Microsoft Entra ID (RBAC) instead', 'warning')
    }

    // Public endpoint + network firewall warning
    if (data.allowPublicEndpoint !== false && data.networkDefaultAction === 'Allow') {
      addError(errors, 'allowPublicEndpoint', 'Storage account is publicly accessible (public endpoint enabled, default Allow); consider restricting access via firewall or disabling public endpoint', 'warning')
    }

    // Soft delete validation (Data protection)
    if (data.enableSoftDelete) {
      if (data.softDeleteRetentionDays === undefined || data.softDeleteRetentionDays === null) {
        addError(errors, 'softDeleteRetentionDays', 'Soft delete retention days is required when soft delete is enabled', 'error')
      } else if (data.softDeleteRetentionDays < 1 || data.softDeleteRetentionDays > 365) {
        addError(errors, 'softDeleteRetentionDays', 'Soft delete retention must be 1-365 days', 'error')
      } else if (data.softDeleteRetentionDays < 7) {
        addError(errors, 'softDeleteRetentionDays', 'Azure recommends minimum 7 days retention for compliance and recovery', 'warning')
      }
    }

    // Warn if soft delete enabled without HTTPS + strong TLS
    if (data.enableSoftDelete && !data.enableHttpsOnly) {
      addError(errors, 'enableHttpsOnly', 'HTTPS-only is critical when soft delete is enabled to protect sensitive recovery operations', 'warning')
    }
    if (data.enableSoftDelete && data.minTlsVersion && ['TLS1_0', 'TLS1_1'].includes(data.minTlsVersion)) {
      addError(errors, 'minTlsVersion', 'TLS 1.2+ is critical when soft delete is enabled to protect sensitive recovery operations', 'warning')
    }
  }

  // Virtual network rules validation for non-storage resources
  if (data.type !== NetworkComponentType.STORAGE_ACCOUNT && data.type !== NetworkComponentType.BLOB_STORAGE && data.virtualNetworkRules && Array.isArray(data.virtualNetworkRules)) {
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
 * Key Vault validator: naming, networking, access policies, and soft delete behavior
 */
function validateKeyVault(data: any, nodes: any[] = []): ValidationResult {
  const errors: any[] = []

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    addError(errors, 'name', 'Key Vault name is required')
  } else if (!isValidKeyVaultName(data.name)) {
    addError(errors, 'name', 'Key Vault name must be 3-24 characters, alphanumeric or hyphen, start/end with alphanumeric, and not contain consecutive hyphens')
  }

  if (!data.sku || !['Standard', 'Premium'].includes(data.sku)) {
    addError(errors, 'sku', 'SKU must be Standard or Premium')
  }

  if (!data.networkDefaultAction || !['Allow', 'Deny'].includes(data.networkDefaultAction)) {
    addError(errors, 'networkDefaultAction', 'Network default action must be Allow or Deny')
  }

  if (!data.tenantId) {
    addError(errors, 'tenantId', 'Tenant ID is recommended for access policy authoring and cross-checking', 'warning')
  } else if (!isGuid(String(data.tenantId))) {
    addError(errors, 'tenantId', 'Tenant ID should be a valid GUID', 'warning')
  }

  if (data.enablePurgeProtection && data.enableSoftDelete === false) {
    addError(errors, 'enablePurgeProtection', 'Purge protection requires soft delete to be enabled')
  }

  if (data.enableSoftDelete === false && data.softDeleteRetentionDays !== undefined && data.softDeleteRetentionDays !== null) {
    addError(errors, 'softDeleteRetentionDays', 'Soft delete retention days apply only when soft delete is enabled', 'warning')
  }

  if (data.enableSoftDelete !== false) {
    if (data.softDeleteRetentionDays === undefined || data.softDeleteRetentionDays === null) {
      addError(errors, 'softDeleteRetentionDays', 'Soft delete retention days is required', 'error')
    } else {
      const retentionDays = parseInt(String(data.softDeleteRetentionDays), 10)
      if (Number.isNaN(retentionDays) || retentionDays < 7 || retentionDays > 90) {
        addError(errors, 'softDeleteRetentionDays', 'Soft delete retention must be 7-90 days')
      }
    }
  }

  if (Array.isArray(data.virtualNetworkRules)) {
    if (data.virtualNetworkRules.length > 200) {
      addError(errors, 'virtualNetworkRules', 'A Key Vault supports at most 200 virtual network rules')
    }

    for (const subnetId of data.virtualNetworkRules) {
      const subnetNode = getSubnetNode(subnetId, nodes)
      if (!subnetNode) {
        addError(errors, 'virtualNetworkRules', 'Referenced subnet does not exist')
        break
      }

      const serviceEndpoints = Array.isArray(subnetNode.data?.serviceEndpoints) ? subnetNode.data.serviceEndpoints : []
      if (!serviceEndpoints.includes('Microsoft.KeyVault')) {
        addError(errors, 'virtualNetworkRules', `Subnet "${subnetNode.data?.name || subnetId}" does not declare the Microsoft.KeyVault service endpoint`, 'warning')
      }
    }
  }

  if (Array.isArray(data.ipRules)) {
    if (data.ipRules.length > 1000) {
      addError(errors, 'ipRules', 'A Key Vault supports at most 1000 IPv4 rules')
    }

    for (const rule of data.ipRules) {
      if (!rule) continue
      const trimmedRule = String(rule).trim()
      if (!trimmedRule) continue
      if (trimmedRule.includes(':')) {
        addError(errors, 'ipRules', 'Only IPv4 addresses or IPv4 CIDR ranges are supported in Key Vault IP rules')
        break
      }

      const ipValue = trimmedRule.includes('/') ? trimmedRule.split('/')[0] : trimmedRule
      const check = trimmedRule.includes('/')
        ? validateCIDRBlock(trimmedRule)
        : validateIPAddress(trimmedRule, 'IPv4')
      if (!check.valid) {
        addError(errors, 'ipRules', `Invalid Key Vault IP rule: ${trimmedRule}`)
        break
      }
      if (isPrivateIpv4Address(ipValue)) {
        addError(errors, 'ipRules', `Private RFC1918 addresses are not allowed in Key Vault IP rules: ${trimmedRule}`)
        break
      }
    }
  }

  const accessPolicies = Array.isArray(data.accessPolicies) ? data.accessPolicies : []
  if (accessPolicies.length > 16) {
    addError(errors, 'accessPolicies', 'A Key Vault supports at most 16 access policies')
  }
  if (accessPolicies.length === 0) {
    addError(errors, 'accessPolicies', 'No access policies are configured; this legacy-mode vault would not grant data-plane access to any principal', 'warning')
  }

  const seenObjectIds = new Set<string>()
  accessPolicies.forEach((policy: any, index: number) => {
    const prefix = `accessPolicies[${index}]`
    const objectId = String(policy?.objectId || '').trim()
    const tenantId = String(policy?.tenantId || '').trim()
    const permissions = policy?.permissions || {}

    if (!tenantId) {
      addError(errors, `${prefix}.tenantId`, 'Access policy tenantId is required')
    } else if (!isGuid(tenantId)) {
      addError(errors, `${prefix}.tenantId`, 'Access policy tenantId should be a valid GUID')
    }

    if (!objectId) {
      addError(errors, `${prefix}.objectId`, 'Access policy objectId is required')
    } else if (!isGuid(objectId)) {
      addError(errors, `${prefix}.objectId`, 'Access policy objectId should be a valid GUID')
    } else if (seenObjectIds.has(objectId.toLowerCase())) {
      addError(errors, `${prefix}.objectId`, 'Access policy objectId must be unique within a Key Vault')
    } else {
      seenObjectIds.add(objectId.toLowerCase())
    }

    const permissionGroups = ['keys', 'secrets', 'certificates'] as const
    let hasPermission = false
    permissionGroups.forEach((group) => {
      const values = Array.isArray(permissions[group]) ? permissions[group] : []
      if (values.length > 0) hasPermission = true
      const allowed = KEY_VAULT_ACCESS_POLICY_PERMISSION_OPTIONS[group] as readonly string[]
      values.forEach((value: string) => {
        if (!allowed.includes(value)) {
          addError(errors, `${prefix}.permissions.${group}`, `Unsupported ${group} permission: ${value}`)
        }
      })
    })

    if (!hasPermission) {
      addError(errors, `${prefix}.permissions`, 'Access policy must grant at least one key, secret, or certificate permission')
    }
  })

  if (
    data.networkDefaultAction === 'Deny'
    && (!Array.isArray(data.virtualNetworkRules) || data.virtualNetworkRules.length === 0)
    && (!Array.isArray(data.ipRules) || data.ipRules.length === 0)
    && data.allowTrustedMicrosoftServices !== true
  ) {
    addError(errors, 'networkDefaultAction', 'Firewall is enabled but no subnet rules, IP rules, or trusted-service bypass are configured', 'warning')
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Identity validators (Managed Identity only)
 */
function validateIdentity(data: any, nodes: any[] = []): ValidationResult {
  const errors: any[] = []

  // Managed Identity validation
  if (data.type === NetworkComponentType.MANAGED_IDENTITY) {
    if (!['SystemAssigned', 'UserAssigned'].includes(data.identityType)) {
      addError(errors, 'identityType', 'Identity type must be SystemAssigned or UserAssigned')
    }

    for (const fieldName of ['clientId', 'principalId', 'tenantId']) {
      const value = data[fieldName]
      if (value && !isGuid(String(value))) {
        addError(errors, fieldName, `${fieldName} should be a valid GUID`, 'warning')
      }
    }

    if (data.identityType === 'SystemAssigned') {
      if (!data.assignedToId) {
        addError(errors, 'assignedToId', 'System-assigned identity should be attached to a parent resource (e.g., VM, App Service)', 'warning')
      } else {
        const assignedNode = findNodeById(data.assignedToId, nodes)
        if (!assignedNode) {
          addError(errors, 'assignedToId', 'Assigned resource does not exist', 'warning')
        } else if (!isIdentityCapableResourceType(assignedNode.data?.type)) {
          addError(errors, 'assignedToId', 'Assigned resource must be a VM, VMSS, AKS, App Service, or Azure Functions component', 'warning')
        } else if (assignedNode.data?.enableManagedIdentity !== true) {
          addError(errors, 'assignedToId', 'Assigned resource does not have system-assigned managed identity enabled', 'warning')
        }
      }
    }

    if (data.identityType === 'UserAssigned') {
      if (data.isolationScope && !['Regional', 'None'].includes(data.isolationScope)) {
        addError(errors, 'isolationScope', 'Isolation scope must be Regional or None', 'warning')
      }
      if (data.resourceId && !isUserAssignedIdentityResourceId(String(data.resourceId))) {
        addError(errors, 'resourceId', 'User-assigned identity resource ID should use /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/{name}', 'warning')
      }

      const assigned = nodes.some(n => {
        const d = n.data || {};
        return Array.isArray(d.userAssignedIdentityIds) && d.userAssignedIdentityIds.includes(data.id);
      });
      if (!assigned) {
        addError(errors, 'userAssignedIdentityIds', 'User-assigned identity is not assigned to any resource (informational)', 'warning');
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * DNS Zone validator
 * Enforces Azure DNS zone configuration rules: zone naming, record constraints, and limits
 * 
 * Azure DNS Specification:
 * - Zone naming: Must be valid domain name; private zones must have 2+ labels (e.g., contoso.com)
 * - Record types: A, AAAA, CNAME, MX, PTR, SRV, TXT, CAA, NS, SOA, SPF (TXT), DS, TLSA
 * - TTL range: 1 to 2,147,483,647 seconds
 * - Record set limits: 10,000 per public zone, 25,000 per private zone
 * - CNAME/SOA constraints: Single record only; cannot coexist with other records of same name
 * - VNet links: Private zones support up to 1,000 VNet links
 * - Wildcard records: Supported (use '*' as record name)
 */
function validateDnsZone(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Zone name validation: required and must be valid domain format
  if (!data.zoneName || data.zoneName.trim() === '') {
    addError(errors, 'zoneName', 'Zone name is required')
  } else {
    const check = validateDnsName(data.zoneName)
    if (!check.valid) {
      addError(errors, 'zoneName', check.error!)
    }
    // Private zone naming constraint: must have 2+ labels (e.g., contoso.com, not "local")
    if (data.zoneType === 'Private') {
      const labels = data.zoneName.split('.').filter((l: string) => l.length > 0)
      if (labels.length < 2) {
        addError(
          errors,
          'zoneName',
          'Private DNS zones must have at least 2 labels (e.g., contoso.com). Single-label names like "local" are not allowed.'
        )
      }
    }
  }

  // Record validation: TTL range, type-specific constraints, and record set counts
  if (data.recordSets && Array.isArray(data.recordSets)) {
    const recordsByName = new Map<string, typeof data.recordSets[0][]>()
    
    for (let i = 0; i < data.recordSets.length; i++) {
      const record = data.recordSets[i]
      
      // TTL range validation (1 to 2,147,483,647 seconds per Azure limits)
      if (record.ttl !== undefined && record.ttl !== null) {
        if (record.ttl < 1 || record.ttl > 2147483647) {
          addError(
            errors,
            `recordSets[${i}].ttl`,
            `TTL must be between 1 and 2,147,483,647 seconds. Got: ${record.ttl}`,
            'warning'
          )
        }
      }

      // Group records by name to check CNAME/SOA single-record constraints
      if (!recordsByName.has(record.name)) {
        recordsByName.set(record.name, [])
      }
      recordsByName.get(record.name)!.push(record)

      // CNAME and SOA can only have 1 record and cannot coexist with other records of same name
      if (record.type === 'CNAME' && recordsByName.get(record.name)!.length > 1) {
        addError(
          errors,
          `recordSets[${i}].type`,
          `CNAME records can only have 1 record for name "${record.name}". Cannot coexist with other records of the same name.`,
          'warning'
        )
      }
      if (record.type === 'SOA' && recordsByName.get(record.name)!.length > 1) {
        addError(
          errors,
          `recordSets[${i}].type`,
          `SOA records can only have 1 record for name "${record.name}". Cannot coexist with other records of the same name.`,
          'warning'
        )
      }
    }

    // Record set count warning (approaching Azure limits per zone type)
    const publicZoneLimit = 10000
    const privateZoneLimit = 25000
    const limit = data.zoneType === 'Public' ? publicZoneLimit : privateZoneLimit
    const warningThreshold = Math.floor(limit * 0.9) // Warn at 90%

    if (data.recordSets.length >= warningThreshold) {
      addError(
        errors,
        'recordSets',
        `Record set count approaching limit: ${data.recordSets.length}/${limit} (${data.zoneType} zone). Consider splitting into child zones.`,
        'warning'
      )
    }
  }

  // Private zone VNet links validation
  if (data.zoneType === 'Private') {
    if (!data.vnetLinks || data.vnetLinks.length === 0) {
      addError(errors, 'vnetLinks', 'Private zone should be linked to at least one VNet', 'warning')
    } else {
      // Check all VNet links exist
      for (const vnetId of data.vnetLinks) {
        if (vnetId && !nodeExists(vnetId, nodes)) {
          addError(errors, 'vnetLinks', 'Referenced VNet does not exist', 'warning')
          break
        }
      }
      // Warn if approaching VNet link limit (1000 per Azure)
      if (data.vnetLinks.length >= 900) {
        addError(
          errors,
          'vnetLinks',
          `VNet link count approaching limit: ${data.vnetLinks.length}/1000. Consider creating additional private zones.`,
          'warning'
        )
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

  // SKU validation
  const validSkus = ['Basic', 'Standard', 'Premium']
  if (!data.sku || !validSkus.includes(data.sku)) {
    addError(errors, 'sku', 'Valid SKU is required: Basic, Standard, or Premium')
  }

  // Public IP handling: optional for Forced Tunnel mode, otherwise required
  if (data.forcedTunneling) {
    // Forced tunnel mode: public IPs are optional (management handled via management NIC)
    if (data.publicIpIds && data.publicIpIds.length > 0) {
      for (const ipId of data.publicIpIds) {
        if (ipId && !nodeExists(ipId, nodes)) {
          addError(errors, 'publicIpIds', 'Referenced public IP does not exist', 'warning')
          break
        }
      }
    }
  } else {
    // Standard mode: at least one public IP required for data plane NAT
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
  }

  // Public IP count limit (max 250 across all SKUs)
  if (data.publicIpIds && data.publicIpIds.length > 250) {
    addError(errors, 'publicIpIds', 'Maximum 250 public IP addresses supported', 'warning')
  } else if (data.publicIpIds && data.publicIpIds.length >= 220) {
    addError(errors, 'publicIpIds', `Public IP count approaching limit: ${data.publicIpIds.length}/250`, 'warning')
  }

  // Threat Intelligence mode: Basic SKU restricted to Alert mode
  if (data.sku === 'Basic') {
    if (data.threatIntelMode && data.threatIntelMode !== 'Alert') {
      addError(errors, 'threatIntelMode', 'Basic SKU supports Alert mode only', 'warning')
    }
  }

  // Forced Tunneling: Standard/Premium only, optional subnet if enabled
  if (data.forcedTunneling && data.sku === 'Basic') {
    addError(errors, 'forcedTunneling', 'Forced Tunneling is not supported on Basic SKU')
  }
  if (data.forcedTunneling && data.subnetId && !nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced Subnet does not exist', 'warning')
  }

  // DNS Proxy: Standard/Premium only
  if (data.dnsProxyEnabled && data.sku === 'Basic') {
    addError(errors, 'dnsProxyEnabled', 'DNS Proxy is not supported on Basic SKU')
  }

  // Custom DNS servers: Standard/Premium only, validate IPv4 format
  if (data.customDnsServers && data.customDnsServers.length > 0) {
    if (data.sku === 'Basic') {
      addError(errors, 'customDnsServers', 'Custom DNS is not supported on Basic SKU')
    } else {
      for (const dns of data.customDnsServers) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
        if (!ipv4Regex.test(dns)) {
          addError(errors, 'customDnsServers', `Invalid IPv4 format: ${dns}`, 'warning')
          break
        }
      }
    }
  }

  // IDPS: Premium only
  if (data.idpsMode && data.idpsMode !== 'Off' && data.sku !== 'Premium') {
    addError(errors, 'idpsMode', 'IDPS is supported on Premium SKU only')
  }

  // TLS Inspection: Premium only
  if (data.tlsInspectionEnabled && data.sku !== 'Premium') {
    addError(errors, 'tlsInspectionEnabled', 'TLS Inspection is supported on Premium SKU only')
  }

  // Scale Units: Premium only, range 1-100
  if (data.scaleUnits !== undefined && data.scaleUnits !== null) {
    if (data.sku !== 'Premium') {
      addError(errors, 'scaleUnits', 'Scale Units are configurable on Premium SKU only', 'warning')
    } else if (data.scaleUnits < 1 || data.scaleUnits > 100) {
      addError(errors, 'scaleUnits', 'Scale Units must be between 1 and 100 for Premium SKU')
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Bastion validator
 * Enforces Azure Bastion configuration rules across all four SKUs (Developer, Basic, Standard, Premium)
 */
function validateBastion(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Helper: Find node data by ID
  const getNodeData = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.data
  }

  // ===== SKU-Specific Constraints =====

  // DEVELOPER SKU: Shared infrastructure, no subnet or public IP required
  if (data.sku === 'Developer') {
    if (data.subnetId) {
      addError(errors, 'subnetId', 'Developer SKU uses shared infrastructure; subnet not applicable', 'warning')
    }
    if (data.publicIpId) {
      addError(errors, 'publicIpId', 'Developer SKU uses shared infrastructure; public IP not applicable', 'warning')
    }
    if (data.scaleUnits) {
      addError(errors, 'scaleUnits', 'Developer SKU has fixed capacity; scaling not applicable', 'warning')
    }
    if (data.enableTunneling || data.enableIpConnect || data.enableShareableLink || data.customInboundPorts) {
      addError(errors, 'advanced', 'Developer SKU does not support advanced features', 'warning')
    }
    if (data.isPrivateOnly || data.enableSessionRecording) {
      addError(errors, 'advanced', 'Developer SKU does not support Premium features', 'warning')
    }
    return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
  }

  // BASIC+ SKUs: Require dedicated subnet
  if (!data.subnetId) {
    addError(errors, 'subnetId', 'Subnet is required for this SKU')
  } else if (!nodeExists(data.subnetId, nodes)) {
    addError(errors, 'subnetId', 'Referenced subnet does not exist')
  } else {
    // Validate subnet naming and sizing for Basic+
    const subnet = getNodeData(data.subnetId)
    if (subnet && subnet.name !== 'AzureBastionSubnet') {
      addError(errors, 'subnetId', 'Subnet should be named "AzureBastionSubnet" for best practices', 'warning')
    }
    // Check subnet size (CIDR prefix); extract from addressPrefix like "10.0.0.0/26"
    if (subnet && subnet.addressPrefix) {
      const prefixMatch = subnet.addressPrefix.match(/\/(\d+)$/)
      if (prefixMatch) {
        const prefix = parseInt(prefixMatch[1], 10)
        if (prefix > 26) { // /27 or smaller (larger number = smaller subnet)
          addError(errors, 'subnetId', 'AzureBastionSubnet must be /26 or larger (/25, /24, etc); /27 or smaller is too small')
        }
      }
    }
  }

  // BASIC+ SKUs: Require public IP (except Premium private-only)
  if (data.sku !== 'Premium' || !data.isPrivateOnly) {
    if (!data.publicIpId) {
      addError(errors, 'publicIpId', 'Public IP is required for this deployment')
    } else if (!nodeExists(data.publicIpId, nodes)) {
      addError(errors, 'publicIpId', 'Referenced public IP does not exist')
    } else {
      // Validate public IP SKU and allocation method
      const publicIp = getNodeData(data.publicIpId)
      if (publicIp) {
        if (publicIp.sku !== 'Standard') {
          addError(errors, 'publicIpId', 'Public IP must have Standard SKU (not Basic)', 'warning')
        }
        if (publicIp.allocationMethod !== 'Static') {
          addError(errors, 'publicIpId', 'Public IP must have Static allocation method', 'warning')
        }
      }
    }
  }

  // BASIC SKU: Fixed 2 instances (don't enforce in form but warn if set to other value)
  if (data.sku === 'Basic') {
    if (data.scaleUnits !== undefined && data.scaleUnits !== null && data.scaleUnits !== 2) {
      addError(errors, 'scaleUnits', 'Basic SKU has fixed capacity of 2 instances', 'warning')
    }
    // Warn if advanced features are set
    if (data.enableTunneling || data.enableIpConnect || data.enableShareableLink || data.customInboundPorts) {
      addError(errors, 'advanced', 'Advanced features are not available in Basic SKU', 'warning')
    }
    if (data.isPrivateOnly || data.enableSessionRecording) {
      addError(errors, 'advanced', 'Premium features are not available in Basic SKU', 'warning')
    }
  }

  // STANDARD SKU: Configurable scaling 2-50
  if (data.sku === 'Standard') {
    if (data.scaleUnits !== undefined && data.scaleUnits !== null) {
      if (data.scaleUnits < 2 || data.scaleUnits > 50) {
        addError(errors, 'scaleUnits', 'Scale units must be 2-50 for Standard SKU', 'warning')
      }
    }
    // Standard supports advanced features but not Premium features
    if (data.isPrivateOnly) {
      addError(errors, 'isPrivateOnly', 'Private-only deployment requires Premium SKU')
    }
    if (data.enableSessionRecording) {
      addError(errors, 'enableSessionRecording', 'Session recording requires Premium SKU')
    }
  }

  // PREMIUM SKU: Configurable scaling 2-50, supports all features
  if (data.sku === 'Premium') {
    if (data.scaleUnits !== undefined && data.scaleUnits !== null) {
      if (data.scaleUnits < 2 || data.scaleUnits > 50) {
        addError(errors, 'scaleUnits', 'Scale units must be 2-50 for Premium SKU', 'warning')
      }
    }
    // Private-only is valid for Premium only
    if (data.isPrivateOnly && data.publicIpId) {
      addError(errors, 'publicIpId', 'Cannot have public IP when using private-only deployment')
    }
  }

  // STANDARD+: Custom inbound ports validation
  if ((data.sku === 'Standard' || data.sku === 'Premium') && data.customInboundPorts) {
    if (!Array.isArray(data.customInboundPorts)) {
      addError(errors, 'customInboundPorts', 'Custom ports must be a valid comma-separated list', 'warning')
    } else if (data.customInboundPorts.length === 0) {
      addError(errors, 'customInboundPorts', 'If specified, custom ports must include at least one valid port number', 'warning')
    } else {
      const invalidPorts = data.customInboundPorts.filter((p: number) => typeof p !== 'number' || p < 1 || p > 65535)
      if (invalidPorts.length > 0) {
        addError(errors, 'customInboundPorts', 'Invalid port numbers detected; must be 1-65535', 'warning')
      }
    }
  }

  // Availability zones validation (all dedicated SKUs)
  if (data.sku !== 'Developer' && data.availabilityZones) {
    if (!Array.isArray(data.availabilityZones) || data.availabilityZones.length === 0) {
      addError(errors, 'availabilityZones', 'If specified, availability zones must be a non-empty list', 'warning')
    } else {
      // Validate that zones are reasonable (1, 2, 3)
      const validZones = data.availabilityZones.filter((z: string) => ['1', '2', '3'].includes(z.toString()))
      if (validZones.length !== data.availabilityZones.length) {
        addError(errors, 'availabilityZones', 'Availability zones should be 1, 2, or 3; support varies by region', 'warning')
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Network IC validator (NIC, Service Endpoint, Private Endpoint)
 */
function validateNetworkIC(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  // Helper: Check if IP address fits within a CIDR block (IPv4 only)
  const ipFitsInCidr = (ip: string, cidr: string): boolean => {
    try {
      const [cidrIp, prefixStr] = cidr.split('/')
      const prefix = parseInt(prefixStr, 10)
      const ipOctets = ip.split('.').map(o => parseInt(o, 10))
      const cidrOctets = cidrIp.split('.').map(o => parseInt(o, 10))
      const ipBits = (ipOctets[0] << 24) | (ipOctets[1] << 16) | (ipOctets[2] << 8) | ipOctets[3]
      const cidrBits = (cidrOctets[0] << 24) | (cidrOctets[1] << 16) | (cidrOctets[2] << 8) | cidrOctets[3]
      const mask = -1 << (32 - prefix)
      return (ipBits & mask) === (cidrBits & mask)
    } catch {
      return false
    }
  }

  // Helper: Check if IP is a reserved address (network, gateway, broadcast)
  const isReservedAddress = (ip: string, cidr: string): boolean => {
    try {
      const [cidrIp, prefixStr] = cidr.split('/')
      const prefix = parseInt(prefixStr, 10)
      const cidrOctets = cidrIp.split('.').map(o => parseInt(o, 10))
      const ipOctets = ip.split('.').map(o => parseInt(o, 10))
      // Network address (all host bits 0)
      const cidrBits = (cidrOctets[0] << 24) | (cidrOctets[1] << 16) | (cidrOctets[2] << 8) | cidrOctets[3]
      const ipBits = (ipOctets[0] << 24) | (ipOctets[1] << 16) | (ipOctets[2] << 8) | ipOctets[3]
      const mask = -1 << (32 - prefix)
      const networkAddr = cidrBits & mask
      const broadcastAddr = networkAddr | ~mask
      // Check if IP is network address, gateway (.1), or broadcast
      return ipBits === networkAddr || ipBits === (networkAddr | 1) || ipBits === broadcastAddr
    } catch {
      return false
    }
  }

  // Service Endpoint-specific validation
  if (data.type === NetworkComponentType.SERVICE_ENDPOINT) {
    const normalizedService = normalizeServiceEndpointServiceName(data.service)

    if (!normalizedService) {
      addError(errors, 'service', 'Service is required')
    } else if (!isKnownServiceEndpointService(normalizedService)) {
      addError(
        errors,
        'service',
        `Unknown service endpoint value "${normalizedService}". Confirm it is supported in the selected region.`,
        'warning',
      )
    }

    if (!data.subnetId) {
      addError(errors, 'subnetId', 'Subnet is required')
    } else {
      const subnetNode = findNodeById(data.subnetId, nodes)
      if (!subnetNode) {
        addError(errors, 'subnetId', 'Referenced subnet does not exist')
      } else if (subnetNode.data?.type !== NetworkComponentType.SUBNET) {
        addError(errors, 'subnetId', 'Referenced subnet must be a Subnet component')
      }
    }

    // Azure SQL service endpoints should use a same-region VNet/service resource pairing.
    if (normalizedService === 'Microsoft.Sql' && data.subnetId && Array.isArray(data.locations) && data.locations.length > 0) {
      const subnet = findNodeById(data.subnetId, nodes)?.data
      const vnet = subnet?.vnetId ? findNodeById(subnet.vnetId, nodes)?.data : undefined
      const subnetRegion = vnet?.region || undefined
      const locationSet = new Set((data.locations || []).map((l: string) => String(l || '').toLowerCase()))
      if (subnetRegion && !locationSet.has(String(subnetRegion).toLowerCase())) {
        addError(
          errors,
          'locations',
          `Microsoft.Sql service endpoint should use same-region resources. Subnet region "${subnetRegion}" is not in [${data.locations.join(', ')}].`,
          'warning',
        )
      }
    }

    return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
  }

  // NIC-specific validation
  if (data.type === NetworkComponentType.NETWORK_IC) {
    // 1. Subnet validation (required)
    if (!data.subnetId) {
      addError(errors, 'subnetId', 'Subnet is required')
    } else if (!nodeExists(data.subnetId, nodes)) {
      addError(errors, 'subnetId', 'Referenced subnet does not exist', 'warning')
    } else {
      // 2. Private IP validation (if Static)
      if (data.privateIpAllocationMethod === 'Static' && data.privateIpAddress) {
        const ipValidation = validateIPAddress(data.privateIpAddress, 'IPv4')
        if (!ipValidation.valid) {
          addError(errors, 'privateIpAddress', `Invalid IP format: ${ipValidation.error}`)
        } else {
          const subnet = nodes.find(n => n.id === data.subnetId)?.data
          if (subnet?.addressPrefix) {
            if (!ipFitsInCidr(data.privateIpAddress, subnet.addressPrefix)) {
              addError(errors, 'privateIpAddress', 
                `Private IP ${data.privateIpAddress} does not fit within subnet CIDR ${subnet.addressPrefix}`)
            } else if (isReservedAddress(data.privateIpAddress, subnet.addressPrefix)) {
              addError(errors, 'privateIpAddress',
                `Private IP ${data.privateIpAddress} is a reserved subnet address (network, gateway .1, or broadcast)`, 'warning')
            }
          }
        }
      }
    }

    // 3. Public IP validation (if present)
    if (data.publicIpId && !nodeExists(data.publicIpId, nodes)) {
      addError(errors, 'publicIpId', 'Referenced public IP does not exist', 'warning')
    }

    // 4. NSG validation (if present)
    if (data.nsgId && !nodeExists(data.nsgId, nodes)) {
      addError(errors, 'nsgId', 'Referenced NSG does not exist', 'warning')
    }

    // 5. ASG validation (if present)
    if (data.asgIds && Array.isArray(data.asgIds)) {
      for (const asgId of data.asgIds) {
        if (!nodeExists(asgId, nodes)) {
          addError(errors, 'asgIds', `Referenced ASG does not exist`, 'warning')
          break // Only report once
        }
      }
    }

    // 6. DNS servers validation (if present)
    if (data.dnsServers && Array.isArray(data.dnsServers) && data.dnsServers.length > 0) {
      for (const dnsIp of data.dnsServers) {
        const dnsValidation = validateIPAddress(dnsIp, 'IPv4')
        if (!dnsValidation.valid) {
          addError(errors, 'dnsServers', `DNS server "${dnsIp}" is not a valid IPv4 address`, 'warning')
          break // Only report first invalid DNS
        }
      }
    }
  }

  // Private Endpoint validation
  if (data.type === NetworkComponentType.PRIVATE_ENDPOINT) {
    if (!data.connectionName || !String(data.connectionName).trim()) {
      addError(errors, 'connectionName', 'Connection name is required')
    }

    if (!data.subnetId) {
      addError(errors, 'subnetId', 'Subnet is required')
    } else {
      const subnetNode = findNodeById(data.subnetId, nodes)
      if (!subnetNode) {
        addError(errors, 'subnetId', 'Referenced subnet does not exist')
      } else if (subnetNode.data?.type !== NetworkComponentType.SUBNET) {
        addError(errors, 'subnetId', 'Referenced subnet must be a Subnet component')
      } else {
        const subnetData = subnetNode.data

        if (data.privateIpAddress) {
          const ipValidation = validateIPAddress(data.privateIpAddress, 'IPv4')
          if (!ipValidation.valid) {
            addError(errors, 'privateIpAddress', `Invalid IP format: ${ipValidation.error}`)
          } else if (subnetData?.addressPrefix) {
            if (!ipFitsInCidr(data.privateIpAddress, subnetData.addressPrefix)) {
              addError(errors, 'privateIpAddress',
                `Private IP ${data.privateIpAddress} does not fit within subnet CIDR ${subnetData.addressPrefix}`)
            } else if (isReservedAddress(data.privateIpAddress, subnetData.addressPrefix)) {
              addError(errors, 'privateIpAddress',
                `Private IP ${data.privateIpAddress} is a reserved subnet address (network, gateway .1, or broadcast)`, 'warning')
            }
          }
        }

        if (subnetData?.privateEndpointNetworkPolicies === 'Enabled') {
          addError(
            errors,
            'subnetId',
            'Subnet private endpoint network policies are Enabled. Verify this matches your intended NSG/UDR behavior for private endpoint traffic.',
            'warning',
          )
        }
      }
    }

    if (!data.privateLinkServiceId) {
      addError(errors, 'privateLinkServiceId', 'Target private-link resource is required')
    } else {
      const targetNode = findNodeById(data.privateLinkServiceId, nodes)
      if (!targetNode) {
        addError(errors, 'privateLinkServiceId', 'Referenced private-link resource does not exist')
      } else {
        const allowedTargetTypes = new Set<NetworkComponentType>([
          NetworkComponentType.STORAGE_ACCOUNT,
          NetworkComponentType.BLOB_STORAGE,
          NetworkComponentType.KEY_VAULT,
          NetworkComponentType.APP_SERVICE,
          NetworkComponentType.FUNCTIONS,
          NetworkComponentType.AKS,
        ])

        if (!allowedTargetTypes.has(targetNode.data?.type)) {
          addError(
            errors,
            'privateLinkServiceId',
            `Target resource type ${targetNode.data?.type || 'Unknown'} isn't in the simulator's supported private-link target list`,
            'warning',
          )
        }
      }
    }

    if (!Array.isArray(data.groupIds) || data.groupIds.length === 0) {
      addError(errors, 'groupIds', 'At least one sub-resource group ID is required')
    } else {
      const normalizedGroupIds = data.groupIds.map((g: string) => String(g || '').trim()).filter(Boolean)
      if (normalizedGroupIds.length === 0) {
        addError(errors, 'groupIds', 'At least one sub-resource group ID is required')
      }

      const knownGroupIdByType: Partial<Record<NetworkComponentType, string[]>> = {
        [NetworkComponentType.STORAGE_ACCOUNT]: ['blob', 'file', 'queue', 'table', 'web', 'dfs'],
        [NetworkComponentType.BLOB_STORAGE]: ['blob'],
        [NetworkComponentType.KEY_VAULT]: ['vault'],
        [NetworkComponentType.APP_SERVICE]: ['sites'],
        [NetworkComponentType.FUNCTIONS]: ['sites'],
        [NetworkComponentType.AKS]: ['management'],
      }

      const targetType = findNodeById(data.privateLinkServiceId, nodes)?.data?.type as NetworkComponentType | undefined
      if (targetType && knownGroupIdByType[targetType]) {
        const knownGroupIds = knownGroupIdByType[targetType] || []
        const invalidGroupId = normalizedGroupIds.find((g: string) => !knownGroupIds.includes(g))
        if (invalidGroupId) {
          addError(
            errors,
            'groupIds',
            `Group ID "${invalidGroupId}" may not match target type ${targetType}. Validate subresource names from Azure service documentation.`,
            'warning',
          )
        }
      }
    }

    if (data.dnsZoneGroupId) {
      const dnsZoneNode = findNodeById(data.dnsZoneGroupId, nodes)
      if (!dnsZoneNode) {
        addError(errors, 'dnsZoneGroupId', 'Referenced DNS zone does not exist', 'warning')
      } else if (dnsZoneNode.data?.type !== NetworkComponentType.DNS_ZONE) {
        addError(errors, 'dnsZoneGroupId', 'DNS zone group must reference a DNS Zone component', 'warning')
      } else if (dnsZoneNode.data?.zoneType !== 'Private') {
        addError(errors, 'dnsZoneGroupId', 'DNS zone group should reference a Private DNS zone', 'warning')
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * App Service validator: tiers, SKU mapping, security (TLS, managed identity), networking, monitoring
 */
function validateAppService(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []
  const normalized = validateAppLikeKeyVaultReference(data, nodes, errors)

  // Tier validation
  const validTiers = ['Free', 'Shared', 'Basic', 'Standard', 'Premium', 'PremiumV2', 'PremiumV3', 'PremiumV4', 'Isolated', 'IsolatedV2']
  if (!data.tier || !validTiers.includes(data.tier)) {
    addError(errors, 'tier', `Tier must be one of: ${validTiers.join(', ')}`)
  }

  // SKU validation and tier-to-SKU mapping
  const skuTierMap: Record<string, string[]> = {
    'F1': ['Free'],
    'D1': ['Shared'],
    'B1': ['Basic'], 'B2': ['Basic'], 'B3': ['Basic'],
    'S1': ['Standard'], 'S2': ['Standard'], 'S3': ['Standard'],
    'P1v2': ['Premium'], 'P2v2': ['Premium'], 'P3v2': ['Premium'],
    'P1v3': ['PremiumV3'], 'P2v3': ['PremiumV3'], 'P3v3': ['PremiumV3'],
    'P1v4': ['PremiumV4'], 'P2v4': ['PremiumV4'], 'P3v4': ['PremiumV4'],
    'P1': ['Premium'],
    'I1v2': ['IsolatedV2'], 'I2v2': ['IsolatedV2'], 'I3v2': ['IsolatedV2'],
  }

  if (!data.sku || data.sku.trim() === '') {
    addError(errors, 'sku', 'SKU is required')
  } else if (!(data.sku in skuTierMap)) {
    addError(errors, 'sku', `Invalid SKU: ${data.sku}. Valid SKUs: ${Object.keys(skuTierMap).join(', ')}`)
  } else if (data.tier && !skuTierMap[data.sku].includes(data.tier)) {
    addError(errors, 'sku', `SKU ${data.sku} is not valid for tier ${data.tier}. Valid SKUs for ${data.tier}: ${skuTierMap[data.sku].join(', ')}`)
  }

  // OS validation
  if (!data.os || !['Windows', 'Linux'].includes(data.os)) {
    addError(errors, 'os', 'OS must be Windows or Linux')
  }

  // Runtime stack validation (warn if empty for deployment realism)
  if (!data.runtimeStack || data.runtimeStack.trim() === '') {
    addError(errors, 'runtimeStack', 'Runtime stack is recommended (e.g., DOTNET|8.0, NODE|20-lts)', 'warning')
  }

  // TLS version validation
  const validTlsVersions = ['1.0', '1.1', '1.2', '1.3']
  if (data.minTlsVersion && !validTlsVersions.includes(data.minTlsVersion)) {
    addError(errors, 'minTlsVersion', `Minimum TLS version must be one of: ${validTlsVersions.join(', ')}`)
  }
  if (data.minTlsVersion && ['1.0', '1.1'].includes(data.minTlsVersion)) {
    addError(errors, 'minTlsVersion', `TLS ${data.minTlsVersion} is deprecated; use TLS 1.2 or 1.3 (security best practice)`, 'warning')
  }

  validateUserAssignedIdentityReferences(normalized, nodes, errors)

  // VNet integration validation
  if (normalized.vnetIntegrationSubnetId) {
    if (!nodeExists(normalized.vnetIntegrationSubnetId, nodes)) {
      addError(errors, 'vnetIntegrationSubnetId', 'Referenced subnet does not exist', 'warning')
    }
  }

  // Private endpoint validation
  if (normalized.enablePrivateEndpoint && !normalized.privateEndpointId) {
    addError(errors, 'enablePrivateEndpoint', 'Private endpoint enabled but no endpoint ID set', 'warning')
  }
  if (normalized.privateEndpointId) {
    const peNode = findNodeById(normalized.privateEndpointId, nodes)
    if (!peNode) {
      addError(errors, 'privateEndpointId', 'Referenced private endpoint does not exist', 'warning')
    } else if (peNode.data?.type !== NetworkComponentType.PRIVATE_ENDPOINT) {
      addError(errors, 'privateEndpointId', 'Referenced node is not a Private Endpoint component', 'warning')
    }
  }

  // Application Insights validation
  if (normalized.applicationInsightsResourceId && !nodeExists(normalized.applicationInsightsResourceId, nodes)) {
    addError(errors, 'applicationInsightsResourceId', 'Referenced Application Insights resource does not exist', 'warning')
  }

  // Health check validation
  if (normalized.enableHealthCheck && !normalized.healthCheckPath) {
    addError(errors, 'healthCheckPath', 'Health check path is required when health check is enabled', 'warning')
  }

  // Tier-specific warnings
  if (data.tier === 'Free' || data.tier === 'Shared') {
    if (normalized.customDomain) {
      addError(errors, 'customDomain', `${normalized.tier} tier does not support custom domains`, 'warning')
    }
    if (normalized.enableManagedIdentity) {
      addError(errors, 'enableManagedIdentity', `Managed identity not meaningful on ${normalized.tier} tier (shared compute)`, 'warning')
    }
    if (Array.isArray(normalized.userAssignedIdentityIds) && normalized.userAssignedIdentityIds.length > 0) {
      addError(errors, 'userAssignedIdentityIds', `User-assigned managed identity is not meaningful on ${normalized.tier} tier (shared compute)`, 'warning')
    }
    if (normalized.vnetIntegrationSubnetId) {
      addError(errors, 'vnetIntegrationSubnetId', `${normalized.tier} tier does not support VNet integration`, 'warning')
    }
  }

  // Easy Auth validation
  if (normalized.enableEasyAuth && !normalized.easyAuthProvider) {
    addError(errors, 'easyAuthProvider', 'Easy Auth provider must be specified when Easy Auth is enabled', 'warning')
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

function normalizeFunctionsHosting(data: any): { hostingOption?: string; planSku?: string; os?: string } {
  const hostingOption = data.hostingOption
  const planSku = data.planSku || data.hostingPlanSku
  const os = data.os

  if (hostingOption) {
    return { hostingOption, planSku, os }
  }

  if (data.hostingPlanSku) {
    if (data.hostingPlanSku === 'Y1') return { hostingOption: 'Consumption', planSku: data.hostingPlanSku, os }
    if (String(data.hostingPlanSku).startsWith('EP')) return { hostingOption: 'Premium', planSku: data.hostingPlanSku, os }
    return { hostingOption: 'Dedicated', planSku: data.hostingPlanSku, os }
  }

  if (data.tier) {
    if (['Free', 'Shared'].includes(data.tier)) return { hostingOption: 'Consumption', planSku, os }
    if (String(data.tier).startsWith('Premium')) return { hostingOption: 'Premium', planSku, os }
    return { hostingOption: 'Dedicated', planSku, os }
  }

  return { hostingOption: undefined, planSku, os }
}

/**
 * Functions validator: similar to App Service with Functions-specific constraints
 */
function validateFunctions(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []
  const normalizedData = validateAppLikeKeyVaultReference(data, nodes, errors)
  const hosting = normalizeFunctionsHosting(data)
  const hostingOption = hosting.hostingOption
  const planSku = hosting.planSku
  const os = hosting.os

  const validHostingOptions = ['FlexConsumption', 'Premium', 'Dedicated', 'ContainerApps', 'Consumption']
  if (!hostingOption || !validHostingOptions.includes(hostingOption)) {
    addError(errors, 'hostingOption', `Hosting option must be one of: ${validHostingOptions.join(', ')}`)
  }

  const premiumSkus = ['EP1', 'EP2', 'EP3']
  const dedicatedSkus = [
    'B1', 'B2', 'B3', 'S1', 'S2', 'S3',
    'P1v2', 'P2v2', 'P3v2',
    'P1v3', 'P2v3', 'P3v3',
    'P1v4', 'P2v4', 'P3v4',
    'I1v2', 'I2v2', 'I3v2',
  ]

  if (hostingOption === 'Consumption' && planSku && planSku !== 'Y1') {
    addError(errors, 'planSku', 'Consumption plan must use Y1 SKU')
  }
  if (hostingOption === 'Premium' && planSku && !premiumSkus.includes(planSku)) {
    addError(errors, 'planSku', `Premium plan SKU must be one of: ${premiumSkus.join(', ')}`)
  }
  if (hostingOption === 'Dedicated' && planSku && !dedicatedSkus.includes(planSku)) {
    addError(errors, 'planSku', `Dedicated plan SKU must be one of: ${dedicatedSkus.join(', ')}`)
  }
  if (hostingOption === 'ContainerApps' && planSku) {
    addError(errors, 'planSku', 'Container Apps hosting does not use App Service plan SKUs', 'warning')
  }

  if ((hostingOption === 'Premium' || hostingOption === 'Dedicated' || hostingOption === 'Consumption') && !planSku) {
    addError(errors, 'planSku', `Plan SKU is required for ${hostingOption} hosting`)
  }

  if (os && !['Windows', 'Linux'].includes(os)) {
    addError(errors, 'os', 'OS must be Windows or Linux')
  }
  if ((hostingOption === 'FlexConsumption' || hostingOption === 'ContainerApps') && os === 'Windows') {
    addError(errors, 'os', `${hostingOption} supports Linux only`)
  }

  // Runtime stack validation
  const validRuntimes = ['dotnet', 'node', 'python', 'java', 'powershell']
  if (!data.runtimeStack || !validRuntimes.includes(data.runtimeStack)) {
    addError(errors, 'runtimeStack', `Runtime stack must be one of: ${validRuntimes.join(', ')}`)
  }

  // Runtime version required
  if (!data.runtimeVersion || data.runtimeVersion.trim() === '') {
    addError(errors, 'runtimeVersion', 'Runtime version is required (e.g., 8.0, 20, 3.11, 21)')
  }

  // Storage account validation (required for Functions)
  if (!data.storageAccountId) {
    addError(errors, 'storageAccountId', 'Storage account is required (holds function code and state)')
  } else if (!nodeExists(data.storageAccountId, nodes)) {
    addError(errors, 'storageAccountId', 'Referenced storage account does not exist')
  } else {
    const storageNode = nodes.find((n: any) => n.id === data.storageAccountId)
    if (storageNode?.data?.type === NetworkComponentType.BLOB_STORAGE) {
      addError(errors, 'storageAccountId', 'Blob-only storage is not suitable as the default Functions host storage account; use a general-purpose storage account', 'warning')
    }
  }

  // TLS version validation
  const validTlsVersions = ['1.0', '1.1', '1.2', '1.3']
  if (data.minTlsVersion && !validTlsVersions.includes(data.minTlsVersion)) {
    addError(errors, 'minTlsVersion', `Minimum TLS version must be one of: ${validTlsVersions.join(', ')}`)
  }
  if (data.minTlsVersion && ['1.0', '1.1'].includes(data.minTlsVersion)) {
    addError(errors, 'minTlsVersion', `TLS ${data.minTlsVersion} is deprecated; use TLS 1.2 or 1.3 (security best practice)`, 'warning')
  }
  if (!data.enableHttps) {
    addError(errors, 'enableHttps', 'HTTPS-only is recommended for secure HTTP endpoints', 'warning')
  }

  validateUserAssignedIdentityReferences(normalizedData, nodes, errors)

  // VNet integration validation
  if (normalizedData.vnetIntegrationSubnetId) {
    if (!nodeExists(normalizedData.vnetIntegrationSubnetId, nodes)) {
      addError(errors, 'vnetIntegrationSubnetId', 'Referenced subnet does not exist', 'warning')
    }
    if (hostingOption === 'Premium') {
      addError(errors, 'vnetIntegrationSubnetId', 'Premium plan networking capabilities vary by scenario; verify VNet integration support for your selected configuration', 'warning')
    }
  }

  // Private endpoint validation
  if (normalizedData.enablePrivateEndpoint && !normalizedData.privateEndpointId) {
    addError(errors, 'enablePrivateEndpoint', 'Private endpoint enabled but no endpoint ID set', 'warning')
  }
  if (normalizedData.privateEndpointId) {
    const peNode = findNodeById(normalizedData.privateEndpointId, nodes)
    if (!peNode) {
      addError(errors, 'privateEndpointId', 'Referenced private endpoint does not exist', 'warning')
    } else if (peNode.data?.type !== NetworkComponentType.PRIVATE_ENDPOINT) {
      addError(errors, 'privateEndpointId', 'Referenced node is not a Private Endpoint component', 'warning')
    }
  }
  if (normalizedData.enablePrivateEndpoint && (hostingOption === 'Premium' || hostingOption === 'Consumption')) {
    addError(errors, 'enablePrivateEndpoint', `${hostingOption} hosting may not support private endpoints in all scenarios; verify Azure networking support matrix`, 'warning')
  }

  // Application Insights validation
  if (normalizedData.applicationInsightsResourceId && !nodeExists(normalizedData.applicationInsightsResourceId, nodes)) {
    addError(errors, 'applicationInsightsResourceId', 'Referenced Application Insights resource does not exist', 'warning')
  }

  // Easy Auth validation
  if (normalizedData.enableEasyAuth && !normalizedData.easyAuthProvider) {
    addError(errors, 'easyAuthProvider', 'Easy Auth provider must be specified when Easy Auth is enabled', 'warning')
  }

  if (hostingOption === 'Consumption') {
    addError(errors, 'hostingOption', 'Consumption plan is legacy; new serverless workloads should use Flex Consumption', 'warning')
    if (os === 'Linux') {
      addError(errors, 'os', 'Linux Consumption is retiring; migrate to Flex Consumption', 'warning')
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * ASG validator: name required; member NICs must exist and belong to the same VNet
 */
function validateAsg(data: any, nodes: any[]): ValidationResult {
  const errors: any[] = []

  if (!data.name || data.name.trim() === '') {
    addError(errors, 'name', 'ASG name is required')
  }

  if (data.nicIds && Array.isArray(data.nicIds) && data.nicIds.length > 0) {
    const vnetId = getVNetFromNic(data.nicIds[0], nodes)
    for (const nicId of data.nicIds) {
      if (!nodeExists(nicId, nodes)) {
        addError(errors, 'nicIds', 'Referenced NIC does not exist', 'warning')
        break
      }
      const nicVnet = getVNetFromNic(nicId, nodes)
      if (vnetId && nicVnet && nicVnet !== vnetId) {
        addError(
          errors,
          'nicIds',
          'Cannot add NICs from different VNets to the same ASG',
        )
        break
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}

/**
 * Dispatcher: get validator for component type
 */
export function getValidator(type: NetworkComponentType): ValidatorFn<AnyNetworkComponent> | null {
  const validators: Partial<Record<NetworkComponentType, ValidatorFn<AnyNetworkComponent>>> = {
    [NetworkComponentType.VNET]: (data, allNodes) => validateVNet(data, allNodes || []),
    [NetworkComponentType.SUBNET]: (data, allNodes) => validateSubnet(data, allNodes || []),
    [NetworkComponentType.IP_ADDRESS]: (data, allNodes) => validateIpAddress(data, allNodes || []),
    [NetworkComponentType.NSG]: (data, allNodes) => validateNsg(data, allNodes || []),
    [NetworkComponentType.UDR]: (data, allNodes) => validateUdr(data, allNodes || []),
    [NetworkComponentType.LOAD_BALANCER]: (data, allNodes) => validateLoadBalancer(data, allNodes || []),
    [NetworkComponentType.APP_GATEWAY]: (data, allNodes) => validateAppGateway(data, allNodes || []),
    [NetworkComponentType.VNET_PEERING]: (data, allNodes) => validateVnetPeering(data, allNodes || []),
    [NetworkComponentType.VPN_GATEWAY]: (data, allNodes) => validateVpnGateway(data, allNodes || []),
    [NetworkComponentType.NVA]: (data, allNodes) => validateNva(data, allNodes || []),
    [NetworkComponentType.VM]: (data, allNodes) => validateCompute(data, allNodes || []),
    [NetworkComponentType.VMSS]: (data, allNodes) => validateCompute(data, allNodes || []),
    [NetworkComponentType.AKS]: (data, allNodes) => validateCompute(data, allNodes || []),
    [NetworkComponentType.APP_SERVICE]: (data, allNodes) => validateAppService(data, allNodes || []),
    [NetworkComponentType.FUNCTIONS]: (data, allNodes) => validateFunctions(data, allNodes || []),
    [NetworkComponentType.STORAGE_ACCOUNT]: (data, allNodes) => validateStorage(data, allNodes || []),
    [NetworkComponentType.BLOB_STORAGE]: (data, allNodes) => validateStorage(data, allNodes || []),
    [NetworkComponentType.MANAGED_DISK]: (data, allNodes) => validateStorage(data, allNodes || []),
    [NetworkComponentType.KEY_VAULT]: (data, allNodes) => validateKeyVault(data, allNodes || []),
    [NetworkComponentType.MANAGED_IDENTITY]: (data, allNodes) => validateIdentity(data, allNodes || []),
    [NetworkComponentType.DNS_ZONE]: (data, allNodes) => validateDnsZone(data, allNodes || []),
    [NetworkComponentType.FIREWALL]: (data, allNodes) => validateFirewall(data, allNodes || []),
    [NetworkComponentType.BASTION]: (data, allNodes) => validateBastion(data, allNodes || []),
    [NetworkComponentType.NAT_GATEWAY]: (data, allNodes) => validateNatGateway(data, allNodes || []),
    [NetworkComponentType.NETWORK_IC]: (data, allNodes) => validateNetworkIC(data, allNodes || []),
    [NetworkComponentType.SERVICE_ENDPOINT]: (data, allNodes) => validateNetworkIC(data, allNodes || []),
    [NetworkComponentType.PRIVATE_ENDPOINT]: (data, allNodes) => validateNetworkIC(data, allNodes || []),
    [NetworkComponentType.ASG]: (data, allNodes) => validateAsg(data, allNodes || []),
  }

  return validators[type] || null
}



