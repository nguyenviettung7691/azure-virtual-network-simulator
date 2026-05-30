export const KNOWN_SERVICE_ENDPOINT_SERVICES = [
  'Microsoft.Storage',
  'Microsoft.Storage.Global',
  'Microsoft.Sql',
  'Microsoft.AzureCosmosDB',
  'Microsoft.KeyVault',
  'Microsoft.ServiceBus',
  'Microsoft.EventHub',
  'Microsoft.ContainerRegistry',
  'Microsoft.Web',
  'Microsoft.CognitiveServices',
] as const

export type KnownServiceEndpointService = typeof KNOWN_SERVICE_ENDPOINT_SERVICES[number]

const KNOWN_SERVICE_LOOKUP = new Map(
  KNOWN_SERVICE_ENDPOINT_SERVICES.map(service => [service.toLowerCase(), service] as const)
)

export function normalizeServiceEndpointServiceName(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  return KNOWN_SERVICE_LOOKUP.get(trimmed.toLowerCase()) || trimmed
}

export function isKnownServiceEndpointService(value: unknown): boolean {
  const normalized = normalizeServiceEndpointServiceName(value)
  return KNOWN_SERVICE_LOOKUP.has(normalized.toLowerCase())
}

export function getServiceEndpointDisplayName(serviceName: unknown): string {
  const normalized = normalizeServiceEndpointServiceName(serviceName)
  if (!normalized) return 'Service'
  const withoutPrefix = normalized.replace(/^Microsoft\./, '')
  return withoutPrefix || normalized
}
