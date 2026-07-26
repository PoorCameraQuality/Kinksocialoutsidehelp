import type { EckeEventRow } from './ecke-directory-sync.js'
import {
  buildEckeEventIngestEnvelopeFromRow,
  buildEckeEventUnpublishEnvelope,
  type EckeEventSourceType,
} from './ecke-ingest-envelope-builders.js'
import {
  isEckeEventIngestEnabled,
  isEckeEventPublishBridgeConfigured,
  useLegacySupabaseForEvents,
} from './ecke-publish-config.js'
import {
  loadEckeIngestApiConfig,
  loadEckePublishClientConfig,
  publishEventIngestEnvelopeToEcke,
  publishEventRowToEcke,
  resolveEckePublicEventUrl,
  unpublishEventIngestEnvelopeToEcke,
  unpublishEventRowToEcke,
  type EckeIngestApiConfig,
  type EckePublishClientConfig,
  type EckePublishResult,
} from './ecke-publish-client.js'

export type EckeEventPublishInput = {
  row: EckeEventRow
  canonicalKinkSocialPath: string
}

function mergeEventPublishResult(
  row: EckeEventRow,
  ingest: EckePublishResult | null,
  legacy: EckePublishResult | null,
  ingestPrimary: boolean,
): EckePublishResult {
  if (ingestPrimary && ingest?.ok) {
    const slug = ingest.eckeSlug ?? row.slug
    return {
      ok: true,
      targetKind: 'ecke_event',
      eckeSlug: slug,
      eckePublicUrl: ingest.eckePublicUrl ?? resolveEckePublicEventUrl(slug),
      detail:
        legacy && !legacy.ok ?
          `${ingest.eckePublicUrl ?? resolveEckePublicEventUrl(slug)} (legacy Supabase sync failed: ${legacy.error})`
        : ingest.detail ?? ingest.eckePublicUrl,
    }
  }

  if (legacy?.ok) {
    return {
      ...legacy,
      eckeSlug: legacy.eckeSlug ?? row.slug,
      eckePublicUrl: legacy.eckePublicUrl ?? resolveEckePublicEventUrl(row.slug),
    }
  }

  if (ingest && !ingest.ok) return ingest
  if (legacy && !legacy.ok) return legacy
  return { ok: false, targetKind: 'ecke_event', error: 'ECKE event publish failed' }
}

export async function publishEckeEventDualWrite(input: EckeEventPublishInput): Promise<EckePublishResult> {
  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false, targetKind: 'ecke_event', error: 'Publish bridge not configured' }
  }

  const ingestCfg = loadEckeIngestApiConfig()
  const supabaseCfg = loadEckePublishClientConfig()
  const ingestEnabled = isEckeEventIngestEnabled() && ingestCfg !== null
  const legacyEnabled = supabaseCfg !== null && (!ingestEnabled || useLegacySupabaseForEvents())

  if (!ingestEnabled && !legacyEnabled) {
    return { ok: false, targetKind: 'ecke_event', error: 'Publish bridge not configured' }
  }

  let ingestResult: EckePublishResult | null = null
  if (ingestEnabled) {
    const envelope = buildEckeEventIngestEnvelopeFromRow(input.row, input.canonicalKinkSocialPath)
    ingestResult = await publishEventIngestEnvelopeToEcke(ingestCfg!, envelope)
  }

  let legacyResult: EckePublishResult | null = null
  if (legacyEnabled && supabaseCfg) {
    legacyResult = await publishEventRowToEcke(supabaseCfg, input.row)
  }

  return mergeEventPublishResult(input.row, ingestResult, legacyResult, ingestEnabled)
}

export async function unpublishEckeEventDualWrite(input: {
  sourceId: string
  c2kSourceType: EckeEventSourceType
  externalSlug: string
  reason?: 'archived' | 'deleted' | 'opt_out' | 'ineligible' | 'visibility_change'
}): Promise<EckePublishResult> {
  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false, targetKind: 'ecke_event', error: 'Publish bridge not configured' }
  }

  const ingestCfg = loadEckeIngestApiConfig()
  const supabaseCfg = loadEckePublishClientConfig()
  const ingestEnabled = isEckeEventIngestEnabled() && ingestCfg !== null
  const legacyEnabled = supabaseCfg !== null && (!ingestEnabled || useLegacySupabaseForEvents())

  let ingestResult: EckePublishResult | null = null
  if (ingestEnabled) {
    const envelope = buildEckeEventUnpublishEnvelope(input.sourceId, input.c2kSourceType, input.reason)
    ingestResult = await unpublishEventIngestEnvelopeToEcke(ingestCfg!, envelope)
  }

  let legacyResult: EckePublishResult | null = null
  if (legacyEnabled && supabaseCfg) {
    legacyResult = await unpublishEventRowToEcke(supabaseCfg, input.externalSlug)
  }

  if (ingestEnabled) {
    if (ingestResult?.ok) return ingestResult
    if (legacyResult?.ok) return legacyResult
    return ingestResult ?? legacyResult ?? { ok: false, targetKind: 'ecke_event', error: 'ECKE event unpublish failed' }
  }

  return legacyResult ?? { ok: false, targetKind: 'ecke_event', error: 'ECKE event unpublish failed' }
}

/** @internal test hooks */
export function __testMergeEventPublishResult(
  row: EckeEventRow,
  ingest: EckePublishResult | null,
  legacy: EckePublishResult | null,
  ingestPrimary: boolean,
): EckePublishResult {
  return mergeEventPublishResult(row, ingest, legacy, ingestPrimary)
}

export type { EckeIngestApiConfig, EckePublishClientConfig }
