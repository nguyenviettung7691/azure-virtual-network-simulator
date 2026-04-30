import type { UserSettings } from '~/types/settings'

interface MongoDBConfig {
  mongodbEndpoint: string
  mongodbApiKey: string
  mongodbDatabase: string
  mongodbCollection: string
}

/**
 * Fetch stored user settings from MongoDB Atlas App Services HTTPS Endpoint.
 * Returns null if the document does not exist or if the endpoint is not configured.
 */
export async function getUserSettings(
  userId: string,
  config: MongoDBConfig,
): Promise<UserSettings | null> {
  if (!config.mongodbEndpoint || !config.mongodbApiKey) return null

  try {
    const url = `${config.mongodbEndpoint}/action/findOne`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.mongodbApiKey,
      },
      body: JSON.stringify({
        dataSource: 'Cluster0',
        database: config.mongodbDatabase,
        collection: config.mongodbCollection,
        filter: { userId },
        projection: { _id: 0, userId: 0 },
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    return (data?.document as UserSettings) ?? null
  } catch {
    return null
  }
}

/**
 * Upsert user settings into MongoDB Atlas App Services HTTPS Endpoint.
 * Fails silently — callers should not rely on this completing successfully.
 */
export async function saveUserSettings(
  userId: string,
  settings: UserSettings,
  config: MongoDBConfig,
): Promise<void> {
  if (!config.mongodbEndpoint || !config.mongodbApiKey) return

  try {
    const url = `${config.mongodbEndpoint}/action/updateOne`
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.mongodbApiKey,
      },
      body: JSON.stringify({
        dataSource: 'Cluster0',
        database: config.mongodbDatabase,
        collection: config.mongodbCollection,
        filter: { userId },
        update: { $set: { userId, ...settings } },
        upsert: true,
      }),
    })
  } catch {
    // swallow — settings are always persisted in localStorage as a fallback
  }
}
