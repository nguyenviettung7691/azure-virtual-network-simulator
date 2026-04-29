import { uploadData, downloadData, list, remove } from 'aws-amplify/storage'
import type { DiagramState } from '~/types/diagram'

export async function uploadDiagram(userId: string, setupId: string, data: DiagramState): Promise<void> {
  const key = `users/${userId}/diagrams/${setupId}.json`
  const jsonData = JSON.stringify(data)
  await uploadData({
    key,
    data: jsonData,
    options: {
      contentType: 'application/json',
      accessLevel: 'private',
    },
  }).result
}

export async function getDiagram(userId: string, setupId: string): Promise<DiagramState | null> {
  try {
    const key = `users/${userId}/diagrams/${setupId}.json`
    const result = await downloadData({ key, options: { accessLevel: 'private' } }).result
    const text = await (result.body as Blob).text()
    return JSON.parse(text) as DiagramState
  } catch {
    return null
  }
}

export async function listDiagrams(userId: string): Promise<string[]> {
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

export async function deleteDiagram(userId: string, setupId: string): Promise<void> {
  const key = `users/${userId}/diagrams/${setupId}.json`
  await remove({ key, options: { accessLevel: 'private' } })
}

export async function uploadThumbnail(userId: string, setupId: string, base64: string): Promise<void> {
  const key = `users/${userId}/thumbnails/${setupId}.png`
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
    const key = `users/${userId}/thumbnails/${setupId}.png`
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
