/**
 * AWS Lambda Function URL proxy for MongoDB Atlas user settings.
 *
 * Replaces the deprecated Atlas App Services Data API / HTTPS Endpoints.
 * The browser sends its Cognito ID token in the Authorization header; this
 * function verifies the token against the Cognito JWKS endpoint and then
 * executes a findOne or updateOne operation using the native MongoDB driver.
 * MongoDB credentials never leave the Lambda environment.
 *
 * Required environment variables:
 *   MONGODB_URI          — mongodb+srv connection string (from Atlas "Connect → Drivers")
 *   MONGODB_DATABASE     — target database name (e.g. "vnet-simulator")
 *   MONGODB_COLLECTION   — target collection name (e.g. "user_settings")
 *   COGNITO_USER_POOL_ID — Cognito User Pool ID (e.g. "us-east-1_XXXXXXXXX")
 *   COGNITO_REGION       — AWS region of the Cognito User Pool (e.g. "us-east-1")
 *
 * Runtime: Node.js 20.x, arm64
 * Dependencies: mongodb (install via `npm install mongodb` and include node_modules in the ZIP)
 *
 * For production, replace the minimal JWT verification below with the
 * `aws-jwt-verify` npm package for full signature validation:
 *   https://github.com/awslabs/aws-jwt-verify
 */

import { MongoClient } from 'mongodb'

// ---------------------------------------------------------------------------
// Connection pooling — reuse the MongoClient across warm invocations
// ---------------------------------------------------------------------------

/** @type {MongoClient | undefined} */
let _client

async function getClient() {
  if (!_client) {
    _client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    await _client.connect()
  }
  return _client
}

// ---------------------------------------------------------------------------
// Minimal JWT verification
// Fetches the JWKS from Cognito and checks token expiry + key ID match.
// Replace with `aws-jwt-verify` for full RS256 signature validation in prod.
// ---------------------------------------------------------------------------

/** Simple in-memory JWKS cache (keyed by kid) */
const jwksCache = new Map()

async function getJwks() {
  const url = `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`)
  const { keys } = await res.json()
  for (const key of keys) {
    jwksCache.set(key.kid, key)
  }
  return jwksCache
}

/**
 * Decodes and validates a Cognito JWT.
 * Returns the payload object (sub, email, exp, …) on success.
 * Throws on invalid/expired token.
 *
 * NOTE: This performs a structural decode and expiry check only.
 * For production workloads add full RS256 signature verification via aws-jwt-verify.
 *
 * @param {string} token
 * @returns {Promise<Record<string, unknown>>}
 */
async function verifyToken(token) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed JWT')

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))

  // Check expiry first (fast path)
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  // Confirm the key ID exists in the pool's JWKS (refreshes cache once if not found)
  let keys = jwksCache
  if (!keys.has(header.kid)) {
    keys = await getJwks()
  }
  if (!keys.has(header.kid)) {
    throw new Error('Unknown key ID — token not issued by this user pool')
  }

  // Confirm issuer matches the configured user pool
  const expectedIssuer = `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid issuer')
  }

  return payload
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function corsHeaders(origin) {
  // In production, restrict to your app's exact origin.
  // During development '*' is convenient.
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function respond(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
    body: JSON.stringify(body),
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler = async (event) => {
  const origin = event.headers?.origin ?? ''
  const method = event.requestContext?.http?.method?.toUpperCase() ?? 'POST'

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return respond(204, {}, origin)
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return respond(401, { error: 'Unauthorized — missing Authorization header' }, origin)
  }

  let payload
  try {
    payload = await verifyToken(token)
  } catch (err) {
    return respond(401, { error: `Unauthorized — ${err.message}` }, origin)
  }

  // Use the Cognito `sub` as the user identifier (stable, unique per user)
  const userId = payload.sub
  if (!userId) {
    return respond(401, { error: 'Unauthorized — token has no sub claim' }, origin)
  }

  // ── Parse request body ──────────────────────────────────────────────────
  let body
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return respond(400, { error: 'Invalid JSON body' }, origin)
  }

  const { action, database, collection } = body

  // Fall back to env-var defaults so callers can omit them
  const dbName = (typeof database === 'string' && database) ? database : process.env.MONGODB_DATABASE
  const colName = (typeof collection === 'string' && collection) ? collection : process.env.MONGODB_COLLECTION

  if (!dbName || !colName) {
    return respond(500, { error: 'Server misconfiguration — database or collection not set' }, origin)
  }

  // ── MongoDB operation ────────────────────────────────────────────────────
  try {
    const client = await getClient()
    const col = client.db(dbName).collection(colName)

    if (action === 'findOne') {
      const doc = await col.findOne({ userId }, { projection: { _id: 0, userId: 0 } })
      return respond(200, { document: doc ?? null }, origin)
    }

    if (action === 'updateOne') {
      const settings = body.settings ?? {}
      await col.updateOne(
        { userId },
        { $set: { userId, ...settings } },
        { upsert: true },
      )
      return respond(200, { modifiedCount: 1 }, origin)
    }

    return respond(400, { error: `Unknown action: ${action}` }, origin)
  } catch (err) {
    console.error('MongoDB error:', err)
    return respond(500, { error: 'Internal server error' }, origin)
  }
}
