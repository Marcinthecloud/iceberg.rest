/**
 * Cloudflare Worker entry point for iceberg.rest
 * Serves the static Vite build, handles SPA routing, proxies Iceberg API calls,
 * and provides encrypted token storage with analytics tracking
 */

import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
import manifestJSON from '__STATIC_CONTENT_MANIFEST'

const assetManifest = JSON.parse(manifestJSON)

export interface Env {
  __STATIC_CONTENT: KVNamespace
  TOKENS: KVNamespace
  DB: D1Database
}

// Session expires after 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000

/**
 * Generate a secure random session ID
 */
function generateSessionId(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Encrypt a token using Web Crypto API
 */
async function encryptToken(token: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  // Convert to base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a token using Web Crypto API
 */
async function decryptToken(encryptedToken: string, key: CryptoKey): Promise<string> {
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0))

  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Get or create encryption key from KV
 */
async function getEncryptionKey(env: Env): Promise<CryptoKey> {
  let keyData = await env.TOKENS.get('encryption_key', 'arrayBuffer')

  if (!keyData) {
    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )

    const exported = await crypto.subtle.exportKey('raw', key)
    await env.TOKENS.put('encryption_key', exported as any)
    return key
  }

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Extract geo data from Cloudflare request
 */
function getGeoData(request: Request) {
  const country = request.headers.get('CF-IPCountry') || 'unknown'
  const city = request.headers.get('CF-IPCity') || 'unknown'
  return { country, city }
}

/**
 * Track analytics event
 */
async function trackAnalytics(
  env: Env,
  eventType: string,
  request: Request,
  sessionId: string | null,
  metadata?: any
) {
  try {
    const { country, city } = getGeoData(request)
    const userAgent = request.headers.get('User-Agent') || 'unknown'

    await env.DB.prepare(
      `INSERT INTO analytics (event_type, timestamp, session_id, country, city, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventType,
      Date.now(),
      sessionId,
      country,
      city,
      userAgent,
      metadata ? JSON.stringify(metadata) : null
    ).run()
  } catch (error) {
    console.error('Failed to track analytics:', error)
  }
}

/**
 * Handle login and create secure session
 */
async function handleLogin(request: Request, env: Env): Promise<Response> {
  let endpoint: string | undefined

  try {
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      // Track JSON parsing failure
      await trackAnalytics(env, 'login_failed', request, null, {
        endpoint_domain: 'unknown',
        error: 'Invalid JSON in request body',
        error_type: 'parse_error'
      })
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    endpoint = body.endpoint
    const { authType = 'bearer', warehouse } = body

    if (!endpoint) {
      await trackAnalytics(env, 'login_failed', request, null, {
        endpoint_domain: 'unknown',
        error: 'Missing endpoint',
        error_type: 'validation'
      })
      return new Response(
        JSON.stringify({ error: 'Missing endpoint' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate and prepare credentials based on auth type
    let credentials: any = {}

    if (authType === 'bearer') {
      const { token } = body
      if (!token) {
        await trackAnalytics(env, 'login_failed', request, null, {
          endpoint_domain: new URL(endpoint).hostname,
          error: 'Missing bearer token',
          error_type: 'validation'
        })
        return new Response(
          JSON.stringify({ error: 'Missing bearer token' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      credentials = { token }
    } else if (authType === 'oauth2') {
      const { oauthEndpoint, clientId, clientSecret, oauthScope } = body
      if (!clientId || !clientSecret) {
        await trackAnalytics(env, 'login_failed', request, null, {
          endpoint_domain: new URL(endpoint).hostname,
          error: 'Missing OAuth2 client ID or secret',
          error_type: 'validation'
        })
        return new Response(
          JSON.stringify({ error: 'Missing OAuth2 client ID or secret' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // If OAuth endpoint not provided, default to catalog endpoint + /v1/oauth/tokens
      const effectiveOauthEndpoint = oauthEndpoint || `${endpoint}/v1/oauth/tokens`
      const effectiveScope = oauthScope || 'PRINCIPAL_ROLE:ALL'
      credentials = { oauthEndpoint: effectiveOauthEndpoint, clientId, clientSecret, scope: effectiveScope }
    } else if (authType === 'sigv4') {
      const { awsAccessKey, awsSecretKey, awsRegion, awsService } = body
      if (!awsAccessKey || !awsSecretKey || !awsRegion) {
        await trackAnalytics(env, 'login_failed', request, null, {
          endpoint_domain: new URL(endpoint).hostname,
          error: 'Missing AWS credentials',
          error_type: 'validation'
        })
        return new Response(
          JSON.stringify({ error: 'Missing AWS credentials' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      credentials = { awsAccessKey, awsSecretKey, awsRegion, awsService: awsService || 's3tables' }
    }

    // Generate session ID
    const sessionId = generateSessionId()

    // Encrypt credentials as JSON
    const key = await getEncryptionKey(env)
    const credentialsJson = JSON.stringify(credentials)
    const encryptedCredentials = await encryptToken(credentialsJson, key)

    const now = Date.now()
    const expiresAt = now + SESSION_DURATION

    const { country } = getGeoData(request)
    const userAgent = request.headers.get('User-Agent') || 'unknown'
    const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown'

    // Store session in D1
    await env.DB.prepare(
      `INSERT INTO sessions (session_id, auth_type, encrypted_credentials, endpoint, warehouse,
       created_at, expires_at, last_used_at, ip_address, user_agent, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      sessionId,
      authType,
      encryptedCredentials,
      endpoint,
      warehouse || null,
      now,
      expiresAt,
      now,
      ipAddress,
      userAgent,
      country
    ).run()

    // Track successful login event
    await trackAnalytics(env, 'login_success', request, sessionId, {
      endpoint_domain: new URL(endpoint).hostname
    })

    return new Response(
      JSON.stringify({ sessionId, expiresAt }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Login error:', error)

    // Track login failure
    await trackAnalytics(env, 'login_failed', request, null, {
      endpoint_domain: endpoint ? new URL(endpoint).hostname : 'unknown',
      error: error instanceof Error ? error.message : String(error),
      error_type: 'exception'
    })

    return new Response(
      JSON.stringify({ error: 'Login failed', message: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Get session data and decrypt credentials
 */
async function getSession(sessionId: string, env: Env) {
  const result = await env.DB.prepare(
    'SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?'
  ).bind(sessionId, Date.now()).first()

  if (!result) {
    return null
  }

  // Decrypt credentials
  const key = await getEncryptionKey(env)
  const credentialsJson = await decryptToken(result.encrypted_credentials as string, key)
  const credentials = JSON.parse(credentialsJson)

  // Update last_used_at
  await env.DB.prepare(
    'UPDATE sessions SET last_used_at = ? WHERE session_id = ?'
  ).bind(Date.now(), sessionId).run()

  return {
    sessionId: result.session_id,
    authType: result.auth_type,
    credentials,
    endpoint: result.endpoint,
    warehouse: result.warehouse,
  }
}

/**
 * Get OAuth2 access token using client credentials
 */
async function getOAuth2Token(oauthEndpoint: string, clientId: string, clientSecret: string, scope: string): Promise<string> {
  const response = await fetch(oauthEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`,
  })

  if (!response.ok) {
    throw new Error(`OAuth2 token exchange failed: ${response.statusText}`)
  }

  const data = await response.json() as any
  return data.access_token
}

/**
 * Sign request with AWS Signature Version 4
 */
async function signAwsRequest(
  request: Request,
  credentials: { awsAccessKey: string; awsSecretKey: string; awsRegion: string; awsService?: string },
  requestBody?: string
): Promise<Headers> {
  const url = new URL(request.url)
  const service = credentials.awsService || 's3tables'
  const { awsAccessKey, awsSecretKey, awsRegion } = credentials

  // Get current date in required formats
  const now = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')

  // Prepare request components
  const method = request.method
  const canonicalUri = url.pathname || '/'

  // Sort query string parameters
  const params = new URLSearchParams(url.search)
  const sortedParams = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b))
  const canonicalQueryString = sortedParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

  // Payload hash
  const body = requestBody || ''
  const payloadHash = await sha256(body)

  // Canonical headers (must be sorted alphabetically and lowercase)
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'

  // Create canonical request
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${awsRegion}/${service}/aws4_request`
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`

  // Calculate signature
  const signingKey = await getSignatureKey(awsSecretKey, dateStamp, awsRegion, service)
  const signature = await hmacSha256(stringToSign, signingKey)

  // Build authorization header
  const authorizationHeader = `${algorithm} Credential=${awsAccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const headers = new Headers()
  headers.set('Host', url.host)
  headers.set('x-amz-date', amzDate)
  headers.set('x-amz-content-sha256', payloadHash)
  headers.set('Authorization', authorizationHeader)
  headers.set('Content-Type', 'application/json')
  headers.set('Accept', 'application/json')

  return headers
}

/**
 * SHA256 hash helper
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * HMAC-SHA256 helper
 */
async function hmacSha256(message: string, key: ArrayBuffer): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  const signatureArray = Array.from(new Uint8Array(signature))
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get AWS signing key
 */
async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(`AWS4${key}`, dateStamp)
  const kRegion = await hmac(kDate, regionName)
  const kService = await hmac(kRegion, serviceName)
  const kSigning = await hmac(kService, 'aws4_request')
  return kSigning
}

async function hmac(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

/**
 * Proxy Iceberg API requests with session-based auth
 */
async function handleIcebergProxy(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now()

  try {
    const url = new URL(request.url)
    const sessionId = request.headers.get('X-Session-ID')

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing X-Session-ID header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get session and decrypt token
    const session = await getSession(sessionId, env)

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Remove /api/iceberg prefix and construct target URL
    const path = url.pathname.replace('/api/iceberg', '')
    const targetUrl = `${session.endpoint}${path}${url.search}`

    // Read request body once (if needed)
    const requestBody = request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : ''

    // Build headers based on auth type
    let headers: Headers

    if (session.authType === 'bearer') {
      // Bearer token auth
      headers = new Headers()
      headers.set('Content-Type', 'application/json')
      headers.set('Accept', 'application/json')
      headers.set('Authorization', `Bearer ${session.credentials.token}`)
    } else if (session.authType === 'oauth2') {
      // OAuth2 - exchange client credentials for access token
      const accessToken = await getOAuth2Token(
        session.credentials.oauthEndpoint,
        session.credentials.clientId,
        session.credentials.clientSecret,
        session.credentials.scope || 'PRINCIPAL_ROLE:ALL'
      )
      headers = new Headers()
      headers.set('Content-Type', 'application/json')
      headers.set('Accept', 'application/json')
      headers.set('Authorization', `Bearer ${accessToken}`)
    } else if (session.authType === 'sigv4') {
      // AWS SigV4 - sign the request
      const targetRequest = new Request(targetUrl, {
        method: request.method,
        body: requestBody || null,
      })
      headers = await signAwsRequest(targetRequest, session.credentials, requestBody)
    } else {
      throw new Error(`Unsupported auth type: ${session.authType}`)
    }

    // Proxy the request
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers,
      body: requestBody || null,
    })

    const response = await fetch(proxyRequest)
    const responseBody = await response.text()

    const responseTime = Date.now() - startTime
    const success = response.ok

    // Track catalog usage
    const action = path.includes('/namespaces') ? 'list_namespaces' :
                   path.includes('/tables') ? 'list_tables' :
                   path.includes('/v1/') ? 'load_table' : 'other'

    await env.DB.prepare(
      `INSERT INTO catalog_usage (session_id, endpoint_domain, timestamp, action, success, response_time_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      sessionId,
      new URL(session.endpoint).hostname,
      Date.now(),
      action,
      success ? 1 : 0,
      responseTime
    ).run()

    // Create response with CORS headers
    const newHeaders = new Headers()
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID')
    newHeaders.set('Content-Type', 'application/json')

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}

/**
 * Handle logout - delete session
 */
async function handleLogout(request: Request, env: Env): Promise<Response> {
  try {
    const sessionId = request.headers.get('X-Session-ID')

    if (sessionId) {
      await env.DB.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run()
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return new Response(
      JSON.stringify({ error: 'Logout failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Track page view analytics
 */
async function handleAnalytics(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any
    const { eventType, sessionId, metadata } = body

    await trackAnalytics(env, eventType, request, sessionId, metadata)

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Analytics error:', error)
    return new Response(
      JSON.stringify({ success: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
        },
      })
    }

    // Handle authentication endpoints
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return handleLogin(request, env)
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      return handleLogout(request, env)
    }

    // Handle analytics endpoint
    if (url.pathname === '/api/analytics' && request.method === 'POST') {
      return handleAnalytics(request, env)
    }

    // Handle Iceberg API proxy
    if (url.pathname.startsWith('/api/iceberg')) {
      return handleIcebergProxy(request, env)
    }

    try {
      // Try to serve static asset
      const asset = await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
          // Cache assets at edge for faster delivery
          cacheControl: {
            browserTTL: 60 * 60 * 24, // 24 hours
            edgeTTL: 60 * 60 * 24 * 7, // 7 days
            bypassCache: false,
          },
          // For SPA routing - if not found, serve index.html
          mapRequestToAsset: (req) => {
            const parsedUrl = new URL(req.url)
            const pathname = parsedUrl.pathname

            // If requesting a file with extension, serve as-is
            if (pathname.includes('.')) {
              return req
            }

            // For all other routes, serve index.html (SPA routing)
            parsedUrl.pathname = '/index.html'
            return new Request(parsedUrl.toString(), req)
          },
        }
      )

      // Add additional cache headers for immutable assets
      const response = new Response(asset.body, asset)
      if (url.pathname.startsWith('/assets/')) {
        // Vite adds content hashes to assets, so they're immutable
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      }

      return response
    } catch (e) {
      // If asset not found, return 404
      return new Response('Not Found', { status: 404 })
    }
  },
}
