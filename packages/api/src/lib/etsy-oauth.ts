import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  decryptExternalSecretsJson,
  encryptExternalSecretsJson,
} from './encrypt-external-secrets.js'
import { getEtsyClientId, getEtsySharedSecret, getEtsyXApiKey } from './etsy-credentials.js'
import type { EtsyShop } from './etsy-client.js'

const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token'
const DEFAULT_SCOPES = 'shops_r listings_r'

export type EtsyOAuthSecrets = {
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
  etsyUserId?: string
}

export function etsyOAuthScopes(): string {
  return process.env.ETSY_OAUTH_SCOPES?.trim() || DEFAULT_SCOPES
}

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

function oauthStateSecret(): string {
  return getEtsySharedSecret() ?? process.env.COOKIE_SECRET?.trim() ?? 'dev-insecure-cookie-secret'
}

export function signEtsyOauthState(vendorId: string, userId: string, codeVerifier: string): string {
  const payload = JSON.stringify({ vendorId, userId, codeVerifier, t: Date.now() })
  const b64 = Buffer.from(payload, 'utf8').toString('base64url')
  const sig = createHmac('sha256', oauthStateSecret()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function parseEtsyOauthState(
  state: string,
): { vendorId: string; userId: string; codeVerifier: string } | null {
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [b64, sig] = parts
  const expected = createHmac('sha256', oauthStateSecret()).update(b64).digest('base64url')
  try {
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return null
    }
  } catch {
    return null
  }
  try {
    const j = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as {
      vendorId?: string
      userId?: string
      codeVerifier?: string
      t?: number
    }
    if (!j.vendorId || !j.userId || !j.codeVerifier) return null
    if (typeof j.t !== 'number' || Date.now() - j.t > 15 * 60 * 1000) return null
    return { vendorId: j.vendorId, userId: j.userId, codeVerifier: j.codeVerifier }
  } catch {
    return null
  }
}

export function parseEtsyUserIdFromAccessToken(accessToken: string): string | null {
  const dot = accessToken.indexOf('.')
  if (dot <= 0) return null
  const prefix = accessToken.slice(0, dot)
  return /^\d+$/.test(prefix) ? prefix : null
}

async function postToken(body: Record<string, string>): Promise<{
  access_token?: string
  refresh_token?: string
  expires_in?: number
}> {
  const clientId = getEtsyClientId()
  if (!clientId) throw new Error('Etsy is not configured (set ETSY_X_API_KEY)')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: clientId, ...body }).toString(),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `Etsy token request failed (${res.status})`)
  }
  return (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
}

export async function exchangeEtsyAuthorizationCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<EtsyOAuthSecrets> {
  const json = await postToken({
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  })
  const accessToken = json.access_token
  const refreshToken = json.refresh_token
  if (!accessToken || !refreshToken) throw new Error('Etsy token response missing access or refresh token')
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
    etsyUserId: parseEtsyUserIdFromAccessToken(accessToken) ?? undefined,
  }
}

export async function refreshEtsyAccessToken(refreshToken: string): Promise<EtsyOAuthSecrets> {
  const json = await postToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const accessToken = json.access_token
  const nextRefresh = json.refresh_token ?? refreshToken
  if (!accessToken) throw new Error('Etsy refresh response missing access_token')
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600
  return {
    accessToken,
    refreshToken: nextRefresh,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
    etsyUserId: parseEtsyUserIdFromAccessToken(accessToken) ?? undefined,
  }
}

export function encryptEtsyOAuthSecrets(secrets: EtsyOAuthSecrets): string {
  return encryptExternalSecretsJson(secrets as unknown as Record<string, unknown>)
}

export function decryptEtsyOAuthSecrets(enc: string | null | undefined): EtsyOAuthSecrets | null {
  if (!enc) return null
  const raw = decryptExternalSecretsJson(enc)
  if (!raw || typeof raw.accessToken !== 'string' || typeof raw.refreshToken !== 'string') return null
  return {
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    tokenExpiresAt: typeof raw.tokenExpiresAt === 'number' ? raw.tokenExpiresAt : 0,
    etsyUserId: typeof raw.etsyUserId === 'string' ? raw.etsyUserId : undefined,
  }
}

/** Refresh when within 5 minutes of expiry. */
export async function getValidEtsyOAuthSecrets(
  enc: string | null | undefined,
): Promise<EtsyOAuthSecrets | null> {
  const current = decryptEtsyOAuthSecrets(enc)
  if (!current) return null
  if (current.tokenExpiresAt - Date.now() > 5 * 60 * 1000) return current
  try {
    const refreshed = await refreshEtsyAccessToken(current.refreshToken)
    return refreshed
  } catch {
    return current.tokenExpiresAt > Date.now() ? current : null
  }
}

function etsyApiBase(): string {
  return (process.env.ETSY_API_BASE_URL ?? 'https://openapi.etsy.com').replace(/\/$/, '')
}

async function etsyOAuthFetch(path: string, accessToken: string): Promise<Response> {
  const xApiKey = getEtsyXApiKey()
  if (!xApiKey) throw new Error('ETSY_X_API_KEY is not set')
  return fetch(`${etsyApiBase()}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': xApiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export async function fetchEtsyUserShops(accessToken: string, userId: string): Promise<EtsyShop[]> {
  const r = await etsyOAuthFetch(`/v3/application/users/${userId}/shops`, accessToken)
  if (!r.ok) {
    const err = await r.text().catch(() => '')
    throw new Error(err || `Etsy user shops failed (${r.status})`)
  }
  const j = (await r.json()) as { results?: unknown[] }
  const results = Array.isArray(j.results) ? j.results : []
  const shops: EtsyShop[] = []
  for (const row of results) {
    if (row && typeof row === 'object' && typeof (row as EtsyShop).shop_id === 'number') {
      shops.push(row as EtsyShop)
    }
  }
  return shops
}

export function buildEtsyAuthorizeUrl(input: {
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const clientId = getEtsyClientId()
  if (!clientId) throw new Error('Etsy is not configured (set ETSY_X_API_KEY)')

  const url = new URL('https://www.etsy.com/oauth/connect')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('scope', etsyOAuthScopes())
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}
