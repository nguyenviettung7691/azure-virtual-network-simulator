import {
  ManagedDiskRedundancy,
  ManagedDiskRole,
  ManagedDiskType,
  NetworkComponentType,
  MANAGED_DISK_REDUNDANCY_BY_TYPE,
} from '~/types/network'

export interface PremiumSsdV2PerformanceLimits {
  minIops: number
  maxIops: number
  minThroughput: number
  maxThroughput: number
}

export interface UltraDiskPerformanceLimits {
  minIops: number
  maxIops: number
  minThroughput: number
  maxThroughput: number
}

const LEGACY_SKU_MAP: Record<string, { diskType: ManagedDiskType; redundancy: ManagedDiskRedundancy }> = {
  Premium_LRS: { diskType: ManagedDiskType.PREMIUM_SSD, redundancy: ManagedDiskRedundancy.LRS },
  Premium_ZRS: { diskType: ManagedDiskType.PREMIUM_SSD, redundancy: ManagedDiskRedundancy.ZRS },
  StandardSSD_LRS: { diskType: ManagedDiskType.STANDARD_SSD, redundancy: ManagedDiskRedundancy.LRS },
  StandardSSD_ZRS: { diskType: ManagedDiskType.STANDARD_SSD, redundancy: ManagedDiskRedundancy.ZRS },
  Standard_LRS: { diskType: ManagedDiskType.STANDARD_HDD, redundancy: ManagedDiskRedundancy.LRS },
  UltraSSD_LRS: { diskType: ManagedDiskType.ULTRA, redundancy: ManagedDiskRedundancy.LRS },
  PremiumV2_LRS: { diskType: ManagedDiskType.PREMIUM_SSD_V2, redundancy: ManagedDiskRedundancy.LRS },
}

export function getManagedDiskDefaults() {
  return {
    diskType: ManagedDiskType.PREMIUM_SSD_V2,
    redundancy: ManagedDiskRedundancy.LRS,
    diskRole: ManagedDiskRole.DATA,
    diskSizeGb: 128,
    osType: undefined,
    attachedToVmId: undefined,
  }
}

export function isManagedDiskData(data: unknown): data is Record<string, any> {
  return Boolean(data && typeof data === 'object' && (data as any).type === NetworkComponentType.MANAGED_DISK)
}

export function normalizeManagedDiskData<T extends Record<string, any>>(data: T): T {
  if (!isManagedDiskData(data)) return data

  const normalized: Record<string, any> = { ...data }
  const legacySku = typeof normalized.sku === 'string' ? LEGACY_SKU_MAP[normalized.sku] : undefined

  if (!normalized.diskType && legacySku) {
    normalized.diskType = legacySku.diskType
  }

  if (!normalized.redundancy && legacySku) {
    normalized.redundancy = legacySku.redundancy
  }

  if (normalized.diskSizeGb === undefined && normalized.diskSizeGB !== undefined) {
    normalized.diskSizeGb = normalized.diskSizeGB
  }

  if (!normalized.diskRole) {
    normalized.diskRole = normalized.osType ? ManagedDiskRole.OS : ManagedDiskRole.DATA
  }

  if (!normalized.diskType) {
    normalized.diskType = ManagedDiskType.PREMIUM_SSD_V2
  }

  if (!normalized.redundancy) {
    normalized.redundancy = ManagedDiskRedundancy.LRS
  }

  if (normalized.diskSizeGb === undefined || normalized.diskSizeGb === null) {
    normalized.diskSizeGb = 128
  }

  if (normalized.diskRole === ManagedDiskRole.DATA && normalized.osType) {
    normalized.osType = undefined
  }

  return normalized as T
}

export function getValidManagedDiskRedundancies(diskType?: ManagedDiskType): ManagedDiskRedundancy[] {
  return diskType ? MANAGED_DISK_REDUNDANCY_BY_TYPE[diskType] || [] : []
}

export function getCoercedManagedDiskRedundancy(
  diskType?: ManagedDiskType,
  redundancy?: ManagedDiskRedundancy,
): ManagedDiskRedundancy {
  const validRedundancies = getValidManagedDiskRedundancies(diskType)
  if (redundancy && validRedundancies.includes(redundancy)) return redundancy
  return validRedundancies[0] || ManagedDiskRedundancy.LRS
}

export function isManagedDiskPerformanceConfigurable(diskType?: ManagedDiskType): boolean {
  return diskType === ManagedDiskType.ULTRA || diskType === ManagedDiskType.PREMIUM_SSD_V2
}

export function getUltraDiskPerformanceLimits(sizeGb: number): UltraDiskPerformanceLimits {
  const safeSizeGb = Number.isFinite(sizeGb) ? Math.max(0, sizeGb) : 0
  return {
    minIops: 100,
    maxIops: Math.min(400000, safeSizeGb * 1000),
    minThroughput: 1,
    maxThroughput: 10000,
  }
}

export function getPremiumSsdV2PerformanceLimits(
  sizeGb: number,
  iops = 3000,
): PremiumSsdV2PerformanceLimits {
  const safeSizeGb = Number.isFinite(sizeGb) ? Math.max(0, sizeGb) : 0
  const safeIops = Number.isFinite(iops) ? Math.max(0, iops) : 3000
  const iopsBands = Math.max(0, safeSizeGb - 6)
  const maxIops = Math.min(80000, 3000 + iopsBands * 500)

  return {
    minIops: 3000,
    maxIops,
    minThroughput: 125,
    maxThroughput: Math.min(2000, Math.max(750, safeIops * 0.25)),
  }
}

export function formatManagedDiskDetail(data: Record<string, any>): string {
  const normalized = normalizeManagedDiskData(data)
  const size = normalized.diskSizeGb || 128
  const diskType = normalized.diskType || normalized.sku || 'Standard'
  const redundancy = normalized.redundancy || 'LRS'
  const role = normalized.diskRole ? ` (${normalized.diskRole})` : ''

  return `${diskType} - ${size} GB (${redundancy})${role}`
}
