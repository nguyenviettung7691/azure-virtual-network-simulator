import { NetworkComponentType } from '~/types/network'

export const KEY_VAULT_ACCESS_POLICY_PERMISSION_OPTIONS = {
  keys: [
    'get', 'list', 'update', 'create', 'import', 'delete', 'recover', 'backup', 'restore',
    'decrypt', 'encrypt', 'unwrapKey', 'wrapKey', 'verify', 'sign', 'purge', 'release', 'rotate',
    'getrotationpolicy', 'setrotationpolicy',
  ],
  secrets: ['get', 'list', 'set', 'delete', 'recover', 'backup', 'restore', 'purge'],
  certificates: [
    'get', 'list', 'update', 'create', 'import', 'delete', 'recover', 'backup', 'restore',
    'managecontacts', 'manageissuers', 'getissuers', 'listissuers', 'setissuers', 'deleteissuers', 'purge',
  ],
} as const

export type KeyVaultObjectType = 'secrets' | 'certificates'

export interface ParsedKeyVaultReference {
  raw: string
  vaultName?: string
  objectType?: KeyVaultObjectType
  objectName?: string
  version?: string
  format?: 'reference' | 'secret-uri'
}

export function isValidKeyVaultName(name: string): boolean {
  return /^[a-zA-Z0-9](?!.*--)[a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$/.test(name.trim())
}

export function isValidKeyVaultObjectName(name: string): boolean {
  return /^[a-zA-Z0-9-]{1,127}$/.test(name.trim())
}

export function isValidKeyVaultObjectVersion(version: string): boolean {
  return /^[0-9a-f]{32}$/i.test(version.trim())
}

export function buildKeyVaultObjectUri(
  vaultName: string,
  objectType: KeyVaultObjectType,
  objectName: string,
  version?: string,
): string {
  const base = `https://${vaultName}.vault.azure.net/${objectType}/${objectName}`
  return version ? `${base}/${version}` : base
}

export function buildKeyVaultReference(secretUri: string): string {
  return `@Microsoft.KeyVault(SecretUri=${secretUri})`
}

export function parseKeyVaultReference(rawValue: string | undefined | null): ParsedKeyVaultReference | null {
  const raw = String(rawValue || '').trim()
  if (!raw) return null

  const referenceMatch = raw.match(/^@Microsoft\.KeyVault\((.+)\)$/i)
  if (referenceMatch) {
    const referenceBody = referenceMatch[1].trim()
    const secretUriMatch = referenceBody.match(/^SecretUri=(https:\/\/[^)]+)$/i)
    if (secretUriMatch) {
      const parsedUri = parseKeyVaultReference(secretUriMatch[1])
      return parsedUri ? { ...parsedUri, raw, format: 'reference' } : null
    }

    const namedReferenceMatch = referenceBody.match(
      /^VaultName=([^;]+);SecretName=([^;]+)(?:;SecretVersion=([^;]+))?$/i,
    )
    if (namedReferenceMatch) {
      return {
        raw,
        vaultName: namedReferenceMatch[1].trim(),
        objectType: 'secrets',
        objectName: namedReferenceMatch[2].trim(),
        version: namedReferenceMatch[3]?.trim(),
        format: 'reference',
      }
    }

    return null
  }

  const secretUriMatch = raw.match(
    /^https:\/\/([^.]+)\.vault\.azure\.net\/(secrets|certificates)\/([^/]+?)(?:\/([^/?#]+))?\/?$/i,
  )
  if (secretUriMatch) {
    return {
      raw,
      vaultName: secretUriMatch[1],
      objectType: secretUriMatch[2].toLowerCase() as KeyVaultObjectType,
      objectName: secretUriMatch[3],
      version: secretUriMatch[4],
      format: 'secret-uri',
    }
  }

  return null
}

function findUniqueKeyVaultNodeByName(vaultName: string | undefined, nodes: any[]): any | undefined {
  if (!vaultName) return undefined
  const matches = (nodes || []).filter(
    node => node.data?.type === NetworkComponentType.KEY_VAULT
      && String(node.data?.name || '').toLowerCase() === vaultName.toLowerCase(),
  )
  return matches.length === 1 ? matches[0] : undefined
}

function findKeyVaultNodeById(vaultId: string | undefined, nodes: any[]): any | undefined {
  if (!vaultId) return undefined
  const node = (nodes || []).find(entry => entry.id === vaultId)
  return node?.data?.type === NetworkComponentType.KEY_VAULT ? node : undefined
}

export function normalizeComponentKeyVaultReferences<T extends Record<string, any>>(component: T, nodes: any[] = []): T {
  const normalized = { ...component } as Record<string, any>

  if (normalized.type === NetworkComponentType.APP_SERVICE || normalized.type === NetworkComponentType.FUNCTIONS) {
    const raw = typeof normalized.keyVaultSecretUri === 'string' ? normalized.keyVaultSecretUri.trim() : ''
    const directNode = findKeyVaultNodeById(raw, nodes)
    const parsed = parseKeyVaultReference(raw)

    if (!normalized.keyVaultId && directNode) {
      normalized.keyVaultId = directNode.id
    }
    if (!normalized.keyVaultId && parsed?.vaultName) {
      normalized.keyVaultId = findUniqueKeyVaultNodeByName(parsed.vaultName, nodes)?.id
    }
    if (!normalized.keyVaultSecretName && parsed?.objectName) {
      normalized.keyVaultSecretName = parsed.objectName
    }
    if (!normalized.keyVaultSecretVersion && parsed?.version) {
      normalized.keyVaultSecretVersion = parsed.version
    }

    const keyVaultNode = findKeyVaultNodeById(normalized.keyVaultId, nodes)
    if (keyVaultNode?.data?.name && normalized.keyVaultSecretName) {
      normalized.keyVaultSecretUri = buildKeyVaultObjectUri(
        keyVaultNode.data.name,
        'secrets',
        normalized.keyVaultSecretName,
        normalized.keyVaultSecretVersion,
      )
    }
  }

  if (normalized.type === NetworkComponentType.APP_GATEWAY) {
    const raw = typeof normalized.keyVaultCertificateId === 'string' ? normalized.keyVaultCertificateId.trim() : ''
    const directNode = findKeyVaultNodeById(raw, nodes)
    const parsed = parseKeyVaultReference(raw)

    if (!normalized.keyVaultId && directNode) {
      normalized.keyVaultId = directNode.id
    }
    if (!normalized.keyVaultId && parsed?.vaultName) {
      normalized.keyVaultId = findUniqueKeyVaultNodeByName(parsed.vaultName, nodes)?.id
    }
    if (!normalized.keyVaultCertificateName && parsed?.objectName) {
      normalized.keyVaultCertificateName = parsed.objectName
    }
    if (!normalized.keyVaultCertificateVersion && parsed?.version) {
      normalized.keyVaultCertificateVersion = parsed.version
    }

    const keyVaultNode = findKeyVaultNodeById(normalized.keyVaultId, nodes)
    if (keyVaultNode?.data?.name && normalized.keyVaultCertificateName) {
      normalized.keyVaultCertificateId = buildKeyVaultObjectUri(
        keyVaultNode.data.name,
        'secrets',
        normalized.keyVaultCertificateName,
        normalized.keyVaultCertificateVersion,
      )
    }
  }

  return normalized as T
}
