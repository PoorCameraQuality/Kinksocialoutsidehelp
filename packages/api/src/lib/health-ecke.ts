import { desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadEckeIngestApiConfig, loadEckePublishClientConfig } from './ecke-publish-client.js'
import { readEckePublishHmacSecret } from './ecke-ingest-auth.js'

export type EckeHealthMode = 'disabled' | 'ingest-api' | 'supabase' | 'misconfigured'

export type EckeBridgeStats = {
  targetsByStatus: Record<string, number>
  errorCount: number
  staleCount: number
  recentErrors: Array<{
    targetKind: string
    externalSlug: string
    lastError: string
    lastAttemptAt: string | null
  }>
}

export type EckeHealthResult = {
  ok: boolean
  enabled: boolean
  mode: EckeHealthMode
  ingestConfigured: boolean
  supabaseConfigured: boolean
  listingWebhookConfigured: boolean
  hmacConfigured: boolean
  ingestFlags: {
    events: boolean
    places: boolean
    vendors: boolean
  }
  issues: string[]
  bridge?: EckeBridgeStats
}

function readIngestFlags() {
  return {
    events: process.env.ECKE_EVENT_INGEST_ENABLED === 'true',
    places: process.env.ECKE_PLACE_INGEST_ENABLED === 'true',
    vendors: process.env.ECKE_VENDOR_INGEST_ENABLED === 'true',
  }
}

/** Config + optional DB stats for ECKE bridge health. */
export async function eckeHealthDiagnostic(): Promise<EckeHealthResult> {
  const enabled = process.env.ECKE_PUBLISH_ENABLED === 'true'
  const hmacConfigured = Boolean(readEckePublishHmacSecret())
  const ingestFlags = readIngestFlags()

  if (!enabled) {
    return {
      ok: true,
      enabled: false,
      mode: 'disabled',
      ingestConfigured: false,
      supabaseConfigured: false,
      listingWebhookConfigured: false,
      hmacConfigured,
      ingestFlags,
      issues: [],
    }
  }

  const ingestConfigured = loadEckeIngestApiConfig() !== null
  const supabaseConfigured = loadEckePublishClientConfig() !== null
  const listingWebhookConfigured = Boolean(process.env.ECKE_PUBLISH_LISTING_WEBHOOK_URL?.trim())

  const issues: string[] = []
  let mode: EckeHealthMode

  if (ingestConfigured) {
    mode = 'ingest-api'
  } else if (supabaseConfigured) {
    mode = 'supabase'
  } else {
    mode = 'misconfigured'
    const hasIngestEndpoint = Boolean(process.env.ECKE_PUBLISH_ENDPOINT?.trim())
    const hasIngestSecret = Boolean(process.env.ECKE_PUBLISH_SECRET?.trim())
    const hasSupabaseUrl = Boolean(process.env.ECKE_SUPABASE_URL?.trim())
    const hasSupabaseKey = Boolean(process.env.ECKE_SUPABASE_SERVICE_ROLE_KEY?.trim())

    if (!hasIngestEndpoint && !hasSupabaseUrl) {
      issues.push('ECKE publish enabled but neither ingest endpoint nor Supabase URL is configured')
    }
    if (hasIngestEndpoint && !hasIngestSecret) {
      issues.push('ECKE_PUBLISH_SECRET missing for ingest API mode')
    }
    if (hasSupabaseUrl && !hasSupabaseKey) {
      issues.push('ECKE_SUPABASE_SERVICE_ROLE_KEY missing for Supabase mode')
    }
    if (issues.length === 0) {
      issues.push('ECKE publish enabled but bridge configuration is incomplete')
    }
  }

  if (!hmacConfigured && ingestConfigured) {
    issues.push('ECKE_PUBLISH_HMAC_SECRET not set — outbound webhooks use bearer auth only')
  }

  let bridge: EckeBridgeStats | undefined
  if (process.env.USE_DATABASE === 'true') {
    try {
      bridge = await loadEckeBridgeStats()
      if (bridge.errorCount > 0) {
        issues.push(`${bridge.errorCount} ECKE publish target(s) in error state`)
      }
    } catch {
      issues.push('Could not load ECKE publish target stats')
    }
  }

  return {
    ok: issues.length === 0,
    enabled: true,
    mode,
    ingestConfigured,
    supabaseConfigured,
    listingWebhookConfigured,
    hmacConfigured,
    ingestFlags,
    issues,
    bridge,
  }
}

async function loadEckeBridgeStats(): Promise<EckeBridgeStats> {
  const statusRows = await db
    .select({
      status: schema.eckePublishTargets.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.eckePublishTargets)
    .groupBy(schema.eckePublishTargets.status)

  const targetsByStatus: Record<string, number> = {}
  for (const row of statusRows) {
    targetsByStatus[row.status] = row.count
  }

  const errorCount = targetsByStatus.error ?? 0
  const staleCount = targetsByStatus.stale ?? 0

  const recentErrorRows = await db
    .select({
      targetKind: schema.eckePublishTargets.targetKind,
      externalSlug: schema.eckePublishTargets.externalSlug,
      lastError: schema.eckePublishTargets.lastError,
      lastAttemptAt: schema.eckePublishTargets.lastAttemptAt,
    })
    .from(schema.eckePublishTargets)
    .where(eq(schema.eckePublishTargets.status, 'error'))
    .orderBy(desc(schema.eckePublishTargets.lastAttemptAt))
    .limit(10)

  return {
    targetsByStatus,
    errorCount,
    staleCount,
    recentErrors: recentErrorRows
      .filter((r) => r.lastError)
      .map((r) => ({
        targetKind: r.targetKind,
        externalSlug: r.externalSlug,
        lastError: r.lastError!,
        lastAttemptAt: r.lastAttemptAt?.toISOString() ?? null,
      })),
  }
}
