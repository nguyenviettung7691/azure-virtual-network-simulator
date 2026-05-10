/**
 * Reusable validators for Azure components
 */

/**
 * Validates a CIDR block (e.g., "10.0.0.0/16", "192.168.1.0/24")
 */
export function validateCIDRBlock(cidr: string): { valid: boolean; error?: string } {
  if (!cidr || typeof cidr !== 'string') {
    return { valid: false, error: 'CIDR block is required' }
  }

  const trimmed = cidr.trim()
  // IPv4 CIDR format: xxx.xxx.xxx.xxx/yy
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$|^(::\/\d{1,3}|([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}\/\d{1,3})$/

  if (!cidrRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid CIDR format (expected 10.0.0.0/16 or ::1/128)' }
  }

  // Check IPv4 octets if IPv4
  if (trimmed.includes('.')) {
    const parts = trimmed.split('/')
    const [octetStr, prefixStr] = parts
    const octets = octetStr.split('.')
    const prefix = parseInt(prefixStr, 10)

    // Validate octets are 0-255
    for (const octet of octets) {
      const num = parseInt(octet, 10)
      if (isNaN(num) || num < 0 || num > 255) {
        return { valid: false, error: `Invalid IPv4 octet: ${octet}` }
      }
    }

    // Validate prefix length 0-32 for IPv4
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      return { valid: false, error: 'IPv4 prefix length must be 0-32' }
    }
  }

  return { valid: true }
}

/**
 * Validates an IP address (IPv4 or IPv6)
 */
export function validateIPAddress(
  ip: string,
  version?: 'IPv4' | 'IPv6'
): { valid: boolean; error?: string } {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address is required' }
  }

  const trimmed = ip.trim()

  // IPv4 validation
  if (!version || version === 'IPv4') {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipv4Regex.test(trimmed)) {
      const octets = trimmed.split('.')
      for (const octet of octets) {
        const num = parseInt(octet, 10)
        if (isNaN(num) || num < 0 || num > 255) {
          return { valid: false, error: `Invalid IPv4 octet: ${octet}` }
        }
      }
      return { valid: true }
    }
  }

  // IPv6 validation (simplified)
  if (!version || version === 'IPv6') {
    // Basic IPv6 format check (allows :: notation)
    const ipv6Regex = /^(([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}|::1|::)$/
    if (ipv6Regex.test(trimmed)) {
      return { valid: true }
    }
  }

  return { valid: false, error: `Invalid IP address format` }
}

/**
 * Validates a port range (single port "80", range "80-443", or wildcard "*")
 */
export function validatePortRange(port: string | number): { valid: boolean; error?: string } {
  if (port === undefined || port === null || port === '') {
    return { valid: false, error: 'Port range is required' }
  }

  const portStr = String(port).trim()

  // Allow wildcard
  if (portStr === '*') {
    return { valid: true }
  }

  // Check range format "start-end" or single port
  const rangeRegex = /^(\d+)(-\d+)?$/
  if (!rangeRegex.test(portStr)) {
    return { valid: false, error: 'Invalid port format (use single port, range 80-443, or *)' }
  }

  const parts = portStr.split('-')
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (isNaN(num) || num < 1 || num > 65535) {
      return { valid: false, error: `Port must be 1-65535, got ${part}` }
    }
  }

  // If range, check start <= end
  if (parts.length === 2) {
    const start = parseInt(parts[0], 10)
    const end = parseInt(parts[1], 10)
    if (start > end) {
      return { valid: false, error: `Port range start (${start}) must be <= end (${end})` }
    }
  }

  return { valid: true }
}

/**
 * Validates a DNS name/label (e.g., "sample-web", "sample.internal")
 */
export function validateDnsName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'DNS name is required' }
  }

  const trimmed = name.trim()

  // DNS name can contain alphanumerics, hyphens, and dots
  // Must start/end with alphanumeric
  const dnsRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)$/

  if (!dnsRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid DNS name (alphanumerics, hyphens, dots; max 63 chars per label)',
    }
  }

  return { valid: true }
}

/**
 * Validates that a subnet CIDR fits within the parent VNet CIDR blocks
 */
export function validateSubnetInVNet(
  subnetCIDR: string,
  vnetCIDRs: string[]
): { valid: boolean; error?: string } {
  const subnetCheck = validateCIDRBlock(subnetCIDR)
  if (!subnetCheck.valid) {
    return subnetCheck
  }

  if (!vnetCIDRs || vnetCIDRs.length === 0) {
    return { valid: false, error: 'Parent VNet must have at least one address space' }
  }

  for (const vnetCIDR of vnetCIDRs) {
    const vnetCheck = validateCIDRBlock(vnetCIDR)
    if (!vnetCheck.valid) continue

    // Simple check: both must be IPv4 or both IPv6
    const subnetIsIPv4 = subnetCIDR.includes('.')
    const vnetIsIPv4 = vnetCIDR.includes('.')

    if (subnetIsIPv4 !== vnetIsIPv4) continue

    if (subnetIsIPv4) {
      // IPv4: check if subnet IP is within VNet prefix
      if (cidrContainsCidr(vnetCIDR, subnetCIDR)) {
        return { valid: true }
      }
    } else {
      // IPv6: simplified, just accept if formats are valid
      return { valid: true }
    }
  }

  return { valid: false, error: `Subnet ${subnetCIDR} does not fit in parent VNet address spaces` }
}

/**
 * Helper: Check if parentCIDR contains childCIDR (IPv4 only)
 */
function cidrContainsCidr(parentCIDR: string, childCIDR: string): boolean {
  try {
    const [parentIp, parentPrefixStr] = parentCIDR.split('/')
    const [childIp, childPrefixStr] = childCIDR.split('/')

    const parentPrefix = parseInt(parentPrefixStr, 10)
    const childPrefix = parseInt(childPrefixStr, 10)

    if (childPrefix < parentPrefix) {
      return false // Child prefix is larger (covers more IPs)
    }

    const parentOctets = parentIp.split('.').map(o => parseInt(o, 10))
    const childOctets = childIp.split('.').map(o => parseInt(o, 10))

    const parentBits = (parentOctets[0] << 24) | (parentOctets[1] << 16) | (parentOctets[2] << 8) | parentOctets[3]
    const childBits = (childOctets[0] << 24) | (childOctets[1] << 16) | (childOctets[2] << 8) | childOctets[3]

    const mask = -1 << (32 - parentPrefix)
    return (parentBits & mask) === (childBits & mask)
  } catch {
    return false
  }
}

/**
 * Validates NSG rule priority (must be 100-4096)
 */
export function validatePriority(priority: number | undefined): { valid: boolean; error?: string } {
  if (priority === undefined || priority === null) {
    return { valid: false, error: 'Priority is required' }
  }

  const num = parseInt(String(priority), 10)
  if (isNaN(num) || num < 100 || num > 4096) {
    return { valid: false, error: 'Priority must be 100-4096' }
  }

  return { valid: true }
}

/**
 * Validates capacity/count within range
 */
export function validateCapacity(
  capacity: number | undefined,
  min: number,
  max: number
): { valid: boolean; error?: string } {
  if (capacity === undefined || capacity === null) {
    return { valid: false, error: `Capacity is required (${min}-${max})` }
  }

  const num = parseInt(String(capacity), 10)
  if (isNaN(num) || num < min || num > max) {
    return { valid: false, error: `Capacity must be ${min}-${max}, got ${num}` }
  }

  return { valid: true }
}

/**
 * Validates health probe interval in seconds
 */
export function validateProbeInterval(
  intervalSeconds: number | undefined
): { valid: boolean; error?: string } {
  if (intervalSeconds === undefined || intervalSeconds === null) {
    return { valid: false, error: 'Probe interval is required' }
  }

  const num = parseInt(String(intervalSeconds), 10)
  if (isNaN(num) || num < 5 || num > 300) {
    return { valid: false, error: 'Probe interval must be 5-300 seconds' }
  }

  return { valid: true }
}

/**
 * Validates number of probes (unhealthy threshold)
 */
export function validateProbeCount(
  count: number | undefined
): { valid: boolean; error?: string } {
  if (count === undefined || count === null) {
    return { valid: false, error: 'Unhealthy probe threshold is required' }
  }

  const num = parseInt(String(count), 10)
  if (isNaN(num) || num < 1 || num > 2147483647) {
    return { valid: false, error: 'Unhealthy probe threshold must be >= 1' }
  }

  return { valid: true }
}

/**
 * Check if component exists in nodes array
 */
export function nodeExists(nodeId: string | undefined, nodes: any[]): boolean {
  if (!nodeId || !nodes) return false
  return nodes.some(n => n.id === nodeId)
}

/**
 * Find nodes by type
 */
export function findNodesByType(type: string, nodes: any[]): any[] {
  if (!nodes) return []
  return nodes.filter(n => n.data?.type === type)
}
