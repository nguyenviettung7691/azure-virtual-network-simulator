import { uploadData, downloadData, list, remove } from 'aws-amplify/storage'
import type { DiagramState, SavedSetup } from '~/types/diagram'

interface LegacySavedSetupRecord {
  id?: string
  name?: string
  description?: string
  createdAt?: string
  updatedAt?: string
  thumbnail?: string
  thumbnailUrl?: string
  diagram?: DiagramState
  state?: DiagramState
  tags?: string[]
}

function getDiagramKey(userId: string, setupId: string) {
  return `users/${userId}/diagrams/${setupId}.json`
}

function getThumbnailKey(userId: string, setupId: string) {
  return `users/${userId}/thumbnails/${setupId}.png`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDiagramState(value: unknown): value is DiagramState {
  if (!isRecord(value)) {
    return false
  }

  const maybeState = value as DiagramState
  return Array.isArray(maybeState.nodes)
    && Array.isArray(maybeState.edges)
    && isRecord(maybeState.viewport)
    && typeof maybeState.viewport.x === 'number'
    && typeof maybeState.viewport.y === 'number'
    && typeof maybeState.viewport.zoom === 'number'
}

function getTimestamp(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback
}

function sortByMostRecent(a: SavedSetup, b: SavedSetup) {
  const aTimestamp = Date.parse(a.updatedAt || a.createdAt)
  const bTimestamp = Date.parse(b.updatedAt || b.createdAt)

  return bTimestamp - aTimestamp
}

function normalizeSavedSetupRecord(raw: unknown, setupId: string, thumbnail?: string): SavedSetup | null {
  const fallbackTimestamp = new Date().toISOString()

  if (isDiagramState(raw)) {
    return {
      id: setupId,
      name: setupId,
      createdAt: fallbackTimestamp,
      updatedAt: fallbackTimestamp,
      thumbnail,
      diagram: raw,
    }
  }

  if (!isRecord(raw)) {
    return null
  }

  const record = raw as LegacySavedSetupRecord
  const diagram = isDiagramState(record.diagram)
    ? record.diagram
    : isDiagramState(record.state)
      ? record.state
      : null

  if (!diagram) {
    return null
  }

  const inlineThumbnail = typeof record.thumbnail === 'string' && record.thumbnail
    ? record.thumbnail
    : typeof record.thumbnailUrl === 'string' && record.thumbnailUrl
      ? record.thumbnailUrl
      : undefined

  const createdAt = getTimestamp(record.createdAt, fallbackTimestamp)
  const updatedAt = getTimestamp(record.updatedAt, createdAt)

  return {
    id: typeof record.id === 'string' && record.id ? record.id : setupId,
    name: typeof record.name === 'string' && record.name ? record.name : setupId,
    description: typeof record.description === 'string' && record.description ? record.description : undefined,
    createdAt,
    updatedAt,
    thumbnail: thumbnail || inlineThumbnail,
    diagram,
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
  }
}

async function readSavedSetupRecord(userId: string, setupId: string): Promise<unknown | null> {
  try {
    const result = await downloadData({
      key: getDiagramKey(userId, setupId),
      options: { accessLevel: 'private' },
    }).result
    const text = await (result.body as Blob).text()
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function listSetupIds(userId: string): Promise<string[]> {
  try {
    const prefix = `users/${userId}/diagrams/`
    const result = await list({ prefix, options: { accessLevel: 'private' } })
    return result.items
      .map((item: any) => item.key.replace(prefix, '').replace('.json', ''))
      .filter((name: string) => name && !name.includes('/'))
  } catch {
    return []
  }
}

export async function saveSavedSetup(userId: string, setup: SavedSetup): Promise<void> {
  const persistedSetup = {
    id: setup.id,
    name: setup.name,
    description: setup.description,
    createdAt: setup.createdAt,
    updatedAt: setup.updatedAt,
    diagram: setup.diagram,
    tags: setup.tags,
  }

  await uploadData({
    key: getDiagramKey(userId, setup.id),
    data: JSON.stringify(persistedSetup),
    options: {
      contentType: 'application/json',
      accessLevel: 'private',
    },
  }).result

  if (setup.thumbnail) {
    await uploadThumbnail(userId, setup.id, setup.thumbnail)
  }
}

export async function getSavedSetup(userId: string, setupId: string): Promise<SavedSetup | null> {
  const [record, thumbnail] = await Promise.all([
    readSavedSetupRecord(userId, setupId),
    getThumbnailUrl(userId, setupId),
  ])

  if (!record) {
    return null
  }

  return normalizeSavedSetupRecord(record, setupId, thumbnail || undefined)
}

export async function listSavedSetups(userId: string): Promise<SavedSetup[]> {
  const setupIds = await listSetupIds(userId)
  const setups = await Promise.all(setupIds.map(setupId => getSavedSetup(userId, setupId)))

  return setups
    .filter((setup): setup is SavedSetup => Boolean(setup))
    .sort(sortByMostRecent)
}

export async function deleteSavedSetup(userId: string, setupId: string): Promise<void> {
  await Promise.allSettled([
    remove({ key: getDiagramKey(userId, setupId), options: { accessLevel: 'private' } }),
    remove({ key: getThumbnailKey(userId, setupId), options: { accessLevel: 'private' } }),
  ])
}

export async function uploadThumbnail(userId: string, setupId: string, base64: string): Promise<void> {
  const key = getThumbnailKey(userId, setupId)
  const blob = base64ToBlob(base64, 'image/png')
  await uploadData({
    key,
    data: blob,
    options: {
      contentType: 'image/png',
      accessLevel: 'private',
    },
  }).result
}

export async function getThumbnailUrl(userId: string, setupId: string): Promise<string> {
  try {
    const key = getThumbnailKey(userId, setupId)
    const result = await downloadData({ key, options: { accessLevel: 'private' } }).result
    const blob = result.body as Blob
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1] || base64)
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type: mimeType })
}
