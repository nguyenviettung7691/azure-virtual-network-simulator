import type { UserSettings } from '~/types/settings'

interface MongoDBConfig {
  mongodbEndpoint: string
  mongodbDatabase: string
  mongodbCollection: string
}

/**
 * Fetch stored user settings via the AWS Lambda Function URL proxy.
 * The Lambda verifies the Cognito JWT and queries MongoDB using the
 * server-side connection string — no MongoDB credentials are ever
 * embedded in the client bundle.
 * Returns null if the document does not exist or if the endpoint is not configured.
 */
export async function getUserSettings(
  userId: string,
  config: MongoDBConfig,
  jwtToken: string,
): Promise<UserSettings | null> {
  if (!config.mongodbEndpoint || !jwtToken) return null

  try {
    const response = await fetch(config.mongodbEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        action: 'findOne',
        database: config.mongodbDatabase,
        collection: config.mongodbCollection,
        filter: { userId },
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
 * Upsert user settings via the AWS Lambda Function URL proxy.
 * Fails silently — callers should not rely on this completing successfully.
 */
export async function saveUserSettings(
  userId: string,
  settings: UserSettings,
  config: MongoDBConfig,
  jwtToken: string,
): Promise<void> {
  if (!config.mongodbEndpoint || !jwtToken) return

  try {
    await fetch(config.mongodbEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        action: 'updateOne',
        database: config.mongodbDatabase,
        collection: config.mongodbCollection,
        filter: { userId },
        settings,
      }),
    })
  } catch {
    // swallow — settings are always persisted in localStorage as a fallback
  }
}
