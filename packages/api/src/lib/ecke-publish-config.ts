/**
 * ECKE publish feature flags and env helpers (Phase 0+).
 * Ingest sends stay gated until explicitly enabled per entity type.
 */

export type EckeIngestEntityFlag = 'event' | 'place' | 'vendor'

const INGEST_FLAG_ENV: Record<EckeIngestEntityFlag, string> = {
  event: 'ECKE_EVENT_INGEST_ENABLED',
  place: 'ECKE_PLACE_INGEST_ENABLED',
  vendor: 'ECKE_VENDOR_INGEST_ENABLED',
}

function envTruthy(key: string): boolean {
  const v = process.env[key]?.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

export function isEckeEventIngestEnabled(): boolean {
  return envTruthy(INGEST_FLAG_ENV.event)
}

export function isEckePlaceIngestEnabled(): boolean {
  return envTruthy(INGEST_FLAG_ENV.place)
}

export function isEckeVendorIngestEnabled(): boolean {
  return envTruthy(INGEST_FLAG_ENV.vendor)
}

export function isEckeIngestEnabledFor(entity: EckeIngestEntityFlag): boolean {
  switch (entity) {
    case 'event':
      return isEckeEventIngestEnabled()
    case 'place':
      return isEckePlaceIngestEnabled()
    case 'vendor':
      return isEckeVendorIngestEnabled()
  }
}

/** When true, publish payloads include optional `photos` manifest (additive). */
export function isEckePhotosPublishEnabled(): boolean {
  const v = process.env.ECKE_PUBLISH_PHOTOS_ENABLED?.trim().toLowerCase()
  if (v === 'false' || v === '0' || v === 'no') return false
  return v === 'true' || v === '1' || v === 'yes'
}

/** Primary ingest URL when live; listing webhook remains separate legacy transport. */
export function eckePublishIngestEndpoint(): string | null {
  const url = process.env.ECKE_PUBLISH_ENDPOINT?.trim()
  return url || null
}

/** Legacy Supabase REST for events during ingest cutover (default: true when configured). */
export function useLegacySupabaseForEvents(): boolean {
  return process.env.ECKE_PUBLISH_USE_LEGACY_SUPABASE !== 'false'
}

export function isEckeEventPublishBridgeConfigured(): boolean {
  if (process.env.ECKE_PUBLISH_ENABLED !== 'true') return false
  if (isEckeEventIngestEnabled() && eckePublishIngestEndpoint()) return true
  const hasSupabase =
    Boolean(process.env.ECKE_SUPABASE_URL?.trim()) &&
    Boolean(process.env.ECKE_SUPABASE_SERVICE_ROLE_KEY?.trim())
  return hasSupabase
}

/** Legacy listing webhook for thin group/convention/presenter/venue listings. */
export function eckeListingWebhookEndpoint(): string | null {
  const url =
    process.env.ECKE_LISTING_ENDPOINT?.trim() ||
    process.env.ECKE_PUBLISH_LISTING_WEBHOOK_URL?.trim()
  return url || null
}
