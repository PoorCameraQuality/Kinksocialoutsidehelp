import { eckePayloadContainsPrivateAppUrls, educationEckePayloadContainsLeakedPrivateUrls } from '@c2k/shared'
import type {
  EckePhotosManifest,
  KinkSocialIngestResponse,
  KinkSocialPublicIngestEnvelope,
  KinkSocialUnpublishEnvelope,
} from '@c2k/shared'
import type { EckeDancecardEventPayload, EckeListingPayload } from './ecke-publish-payload.js'
import { buildEckeOutboundAuthHeaders, readEckePublishHmacSecret } from './ecke-ingest-auth.js'
import { enrichEckeListingPayloadWithPhotos } from './ecke-photo-manifest.js'
import type { EckeArticleRow, EckeDungeonRow, EckeEventRow, EckeVendorRow } from './ecke-directory-sync.js'
import {
  buildDancecardLocationRows,
  orphanDancecardLocationsDeletePath,
} from './ecke-dancecard-location-sync.js'
import { buildDancecardSlotRows, orphanDancecardSlotsDeletePath } from './ecke-dancecard-slot-sync.js'
import {
  buildDancecardStaffShiftRows,
  orphanDancecardStaffShiftsDeletePath,
} from './ecke-dancecard-staff-sync.js'

export type EckePublishClientConfig = {
  supabaseUrl: string
  serviceRoleKey: string
  listingWebhookUrl?: string
  listingWebhookSecret?: string
}

/** Option A — authenticated ECKE ingest API (education_article Pass 3B). */
export type EckeIngestApiConfig = {
  publishEndpoint: string
  unpublishEndpoint: string
  publishSecret: string
  hmacSecret?: string
  publicBaseUrl: string
}

const ECKE_PRODUCTION_HOSTS = new Set(['www.eastcoastkinkevents.com', 'eastcoastkinkevents.com'])

/** kink.social → ECKE bridge must target production ECKE only (not per-commit Vercel previews). */
export function isProductionEckePublishUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ECKE_PRODUCTION_HOSTS.has(host)
  } catch {
    return false
  }
}

function eckePublishNonProductionAllowed(): boolean {
  return process.env.ECKE_PUBLISH_ALLOW_NON_PRODUCTION === 'true'
}

function isAllowedEckePublishUrl(url: string): boolean {
  if (eckePublishNonProductionAllowed()) return true
  return isProductionEckePublishUrl(url)
}

export type EckeIngestApiSuccess = {
  ok: true
  eckeSlug: string
  eckePublicUrl: string
  eckeRecordId?: string
}

export type EckeIngestApiFailure = {
  ok: false
  error: string
  httpStatus?: number
  errorCode?: string
}

export type EckeIngestApiResult = EckeIngestApiSuccess | EckeIngestApiFailure

export function loadEckeIngestApiConfig(): EckeIngestApiConfig | null {
  if (process.env.ECKE_PUBLISH_ENABLED !== 'true') return null

  const publishEndpoint = process.env.ECKE_PUBLISH_ENDPOINT?.trim()
  const publishSecret = process.env.ECKE_PUBLISH_SECRET?.trim()
  if (!publishEndpoint || !publishSecret) return null

  const publicBaseUrl = (
    process.env.ECKE_PUBLIC_BASE_URL?.trim() || 'https://www.eastcoastkinkevents.com'
  ).replace(/\/$/, '')

  const unpublishEndpoint =
    process.env.ECKE_UNPUBLISH_ENDPOINT?.trim() ||
    publishEndpoint.replace(/\/ingest\/?$/, '/unpublish')

  if (!isAllowedEckePublishUrl(publishEndpoint) || !isAllowedEckePublishUrl(unpublishEndpoint)) {
    return null
  }
  if (!isAllowedEckePublishUrl(publicBaseUrl)) {
    return null
  }

  return {
    publishEndpoint,
    unpublishEndpoint,
    publishSecret,
    hmacSecret: readEckePublishHmacSecret(),
    publicBaseUrl,
  }
}

function defaultEckePublicUrlForIngest(
  cfg: EckeIngestApiConfig,
  eckeSlug: string,
  body: KinkSocialPublicIngestEnvelope | KinkSocialUnpublishEnvelope,
): string {
  if (!eckeSlug) return cfg.publicBaseUrl
  const base = cfg.publicBaseUrl.replace(/\/$/, '')
  if (body.action === 'unpublish') return base
  switch (body.entityType) {
    case 'education_article':
      return `${base}/education/${encodeURIComponent(eckeSlug)}`
    case 'event':
    case 'convention':
      return `${base}/events/${encodeURIComponent(eckeSlug)}`
    case 'place':
      return `${base}/dungeons/${encodeURIComponent(eckeSlug)}`
    case 'vendor':
      return `${base}/vendors/${encodeURIComponent(eckeSlug)}`
    default:
      return base
  }
}

async function postEckeIngestEnvelope(
  cfg: EckeIngestApiConfig,
  endpoint: string,
  body: KinkSocialPublicIngestEnvelope | KinkSocialUnpublishEnvelope,
): Promise<EckeIngestApiResult> {
  try {
    const serialized = JSON.stringify(body)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: buildEckeOutboundAuthHeaders(serialized, {
        bearerSecret: cfg.publishSecret,
        hmacSecret: cfg.hmacSecret,
        idempotencyKey: 'idempotencyKey' in body ? body.idempotencyKey : undefined,
      }),
      body: serialized,
    })

    let parsed: KinkSocialIngestResponse | null = null
    try {
      parsed = (await res.json()) as KinkSocialIngestResponse
    } catch {
      parsed = null
    }

    if (!res.ok) {
      const errorCode = parsed?.errorCode
      const errorMessage =
        parsed?.errorMessage ||
        `ECKE ingest HTTP ${res.status}${errorCode ? ` (${errorCode})` : ''}`
      return {
        ok: false,
        error: errorMessage,
        httpStatus: res.status,
        errorCode,
      }
    }

    if (!parsed || (parsed.status !== 'published' && parsed.status !== 'unpublished')) {
      return {
        ok: false,
        error: parsed?.errorMessage || 'ECKE ingest returned an unexpected response',
        httpStatus: res.status,
        errorCode: parsed?.errorCode,
      }
    }

    const eckeSlug = parsed.eckeSlug ?? ''
    const eckePublicUrl =
      parsed.eckePublicUrl ||
      defaultEckePublicUrlForIngest(cfg, eckeSlug, body)

    return {
      ok: true,
      eckeSlug,
      eckePublicUrl,
      eckeRecordId: parsed.eckeRecordId,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unknown ECKE ingest error',
    }
  }
}

export async function publishEducationArticleEnvelopeToEcke(
  cfg: EckeIngestApiConfig,
  envelope: KinkSocialPublicIngestEnvelope,
): Promise<EckePublishResult> {
  if (envelope.entityType !== 'education_article') {
    return { ok: false, targetKind: 'ecke_article', error: 'Only education_article uses ingest API in Pass 3B' }
  }
  if (educationEckePayloadContainsLeakedPrivateUrls(envelope.payload as Record<string, unknown>)) {
    return {
      ok: false,
      targetKind: 'ecke_article',
      error: 'ECKE payload must not contain private kink.social URLs',
    }
  }

  const result = await postEckeIngestEnvelope(cfg, cfg.publishEndpoint, envelope)
  if (!result.ok) {
    return { ok: false, targetKind: 'ecke_article', error: result.error }
  }

  const payload = envelope.payload as { photos?: EckePhotosManifest | null }
  return {
    ok: true,
    targetKind: 'ecke_article',
    detail: result.eckePublicUrl,
    eckeSlug: result.eckeSlug,
    eckePublicUrl: result.eckePublicUrl,
    ...(payload.photos !== undefined ? { photosManifest: payload.photos } : {}),
  }
}

export async function unpublishEducationArticleEnvelopeToEcke(
  cfg: EckeIngestApiConfig,
  envelope: KinkSocialUnpublishEnvelope,
): Promise<EckePublishResult> {
  if (envelope.entityType !== 'education_article') {
    return { ok: false, targetKind: 'ecke_article', error: 'Only education_article uses ingest API in Pass 3B' }
  }

  const result = await postEckeIngestEnvelope(cfg, cfg.unpublishEndpoint, envelope)
  if (!result.ok) {
    return { ok: false, targetKind: 'ecke_article', error: result.error }
  }

  return {
    ok: true,
    targetKind: 'ecke_article',
    detail: result.eckePublicUrl || 'unpublished',
  }
}

const EVENT_INGEST_ENTITY_TYPES = new Set(['event', 'convention'])

export async function publishEventIngestEnvelopeToEcke(
  cfg: EckeIngestApiConfig,
  envelope: KinkSocialPublicIngestEnvelope,
): Promise<EckePublishResult> {
  if (!EVENT_INGEST_ENTITY_TYPES.has(envelope.entityType)) {
    return { ok: false, targetKind: 'ecke_event', error: 'Event ingest requires entityType event or convention' }
  }
  if (eckePayloadContainsPrivateAppUrls(envelope.payload as Record<string, unknown>)) {
    return { ok: false, targetKind: 'ecke_event', error: 'ECKE payload must not contain private kink.social URLs' }
  }

  const result = await postEckeIngestEnvelope(cfg, cfg.publishEndpoint, envelope)
  if (!result.ok) {
    return { ok: false, targetKind: 'ecke_event', error: result.error }
  }

  return {
    ok: true,
    targetKind: 'ecke_event',
    detail: result.eckePublicUrl,
    eckeSlug: result.eckeSlug,
    eckePublicUrl: result.eckePublicUrl,
  }
}

export async function unpublishEventIngestEnvelopeToEcke(
  cfg: EckeIngestApiConfig,
  envelope: KinkSocialUnpublishEnvelope,
): Promise<EckePublishResult> {
  if (!EVENT_INGEST_ENTITY_TYPES.has(envelope.entityType)) {
    return { ok: false, targetKind: 'ecke_event', error: 'Event unpublish requires entityType event or convention' }
  }

  const result = await postEckeIngestEnvelope(cfg, cfg.unpublishEndpoint, envelope)
  if (!result.ok) {
    return { ok: false, targetKind: 'ecke_event', error: result.error }
  }

  return {
    ok: true,
    targetKind: 'ecke_event',
    detail: result.eckePublicUrl || 'unpublished',
  }
}

export type EckePublishResult =
  | {
      ok: true
      targetKind:
        | 'ecke_listing'
        | 'dancecard_event'
        | 'ecke_event'
        | 'ecke_vendor'
        | 'ecke_article'
        | 'ecke_dungeon'
      detail?: string
      eckeSlug?: string
      eckePublicUrl?: string
      eckePublicUrlKnown?: boolean
      eckeRecordId?: string
      photosManifest?: EckePhotosManifest | null
    }
  | {
      ok: false
      targetKind:
        | 'ecke_listing'
        | 'dancecard_event'
        | 'ecke_event'
        | 'ecke_vendor'
        | 'ecke_article'
        | 'ecke_dungeon'
      error: string
    }

export function loadEckePublishClientConfig(): EckePublishClientConfig | null {
  if (process.env.ECKE_PUBLISH_ENABLED !== 'true') return null
  const supabaseUrl = process.env.ECKE_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.ECKE_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) return null
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey,
    listingWebhookUrl: process.env.ECKE_PUBLISH_LISTING_WEBHOOK_URL?.trim() || undefined,
    listingWebhookSecret: process.env.ECKE_PUBLISH_WEBHOOK_SECRET?.trim() || undefined,
  }
}

async function supabaseFetch(
  cfg: EckePublishClientConfig,
  path: string,
  init: RequestInit & { prefer?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...(init.prefer ? { Prefer: init.prefer } : {}),
  }
  return fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } })
}

export async function publishDancecardEventToEcke(
  cfg: EckePublishClientConfig,
  payload: EckeDancecardEventPayload,
): Promise<EckePublishResult> {
  try {
    const upsertRes = await supabaseFetch(cfg, 'dancecard_events?on_conflict=slug', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify([
        {
          slug: payload.slug,
          product_title: payload.productTitle,
          event_title: payload.eventTitle,
          subtitle: payload.subtitle,
          timezone: payload.timezone,
          window_starts_at: payload.windowStartsAt,
          window_ends_at: payload.windowEndsAt,
          shared_by_label: payload.sharedByLabel,
          shared_by_detail: payload.sharedByDetail,
          logo_url: payload.logoUrl,
          status: payload.status,
          staff_access_code: payload.staffAccessCode || null,
          registration_access_code: payload.registrationAccessCode || null,
        },
      ]),
    })

    if (!upsertRes.ok) {
      const text = await upsertRes.text()
      return { ok: false, targetKind: 'dancecard_event', error: `dancecard_events upsert ${upsertRes.status}: ${text.slice(0, 500)}` }
    }

    const events = (await upsertRes.json()) as { id: string }[]
    const eventId = events[0]?.id
    if (!eventId) {
      return { ok: false, targetKind: 'dancecard_event', error: 'dancecard_events upsert returned no id' }
    }

    const locDelRes = await supabaseFetch(
      cfg,
      orphanDancecardLocationsDeletePath(
        eventId,
        payload.locations.map((l) => l.externalKey),
      ),
      { method: 'DELETE', prefer: 'return=minimal' },
    )
    if (!locDelRes.ok) {
      const text = await locDelRes.text()
      return {
        ok: false,
        targetKind: 'dancecard_event',
        error: `location orphan delete ${locDelRes.status}: ${text.slice(0, 500)}`,
      }
    }

    if (payload.locations.length > 0) {
      const locRows = buildDancecardLocationRows(eventId, payload.locations)
      const locUpsertRes = await supabaseFetch(cfg, 'dancecard_locations?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(locRows),
      })
      if (!locUpsertRes.ok) {
        const text = await locUpsertRes.text()
        return {
          ok: false,
          targetKind: 'dancecard_event',
          error: `location upsert ${locUpsertRes.status}: ${text.slice(0, 500)}`,
        }
      }
    }

    const delRes = await supabaseFetch(cfg, orphanDancecardSlotsDeletePath(eventId, payload.slots.map((s) => s.externalKey)), {
      method: 'DELETE',
      prefer: 'return=minimal',
    })
    if (!delRes.ok) {
      const text = await delRes.text()
      return { ok: false, targetKind: 'dancecard_event', error: `slot orphan delete ${delRes.status}: ${text.slice(0, 500)}` }
    }

    if (payload.slots.length > 0) {
      const rows = buildDancecardSlotRows(eventId, payload.slots)
      const upsertRes = await supabaseFetch(cfg, 'dancecard_program_slots?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(rows),
      })
      if (!upsertRes.ok) {
        const text = await upsertRes.text()
        return { ok: false, targetKind: 'dancecard_event', error: `slot upsert ${upsertRes.status}: ${text.slice(0, 500)}` }
      }
    }

    const staffDelRes = await supabaseFetch(
      cfg,
      orphanDancecardStaffShiftsDeletePath(eventId, payload.staffShifts.map((s) => s.externalKey)),
      { method: 'DELETE', prefer: 'return=minimal' },
    )
    if (!staffDelRes.ok) {
      const text = await staffDelRes.text()
      return {
        ok: false,
        targetKind: 'dancecard_event',
        error: `staff shift orphan delete ${staffDelRes.status}: ${text.slice(0, 500)}`,
      }
    }

    if (payload.staffShifts.length > 0) {
      const staffRows = buildDancecardStaffShiftRows(eventId, payload.staffShifts)
      const staffUpsertRes = await supabaseFetch(cfg, 'dancecard_staff_shifts?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(staffRows),
      })
      if (!staffUpsertRes.ok) {
        const text = await staffUpsertRes.text()
        return {
          ok: false,
          targetKind: 'dancecard_event',
          error: `staff shift upsert ${staffUpsertRes.status}: ${text.slice(0, 500)}`,
        }
      }
    }

    const detailParts = [`${payload.locations.length} locations`, `${payload.slots.length} slots`]
    if (payload.staffShifts.length > 0) detailParts.push(`${payload.staffShifts.length} staff shifts`)
    return { ok: true, targetKind: 'dancecard_event', detail: detailParts.join(', ') }
  } catch (e) {
    return { ok: false, targetKind: 'dancecard_event', error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export function resolveEckePublicEventUrl(slug: string): string {
  return `${resolveEckePublicBaseUrl()}/events/${encodeURIComponent(slug)}`
}

/** Best-effort public URL when listing webhook does not return one. */
export function resolveEckePublicGroupListingUrl(slug: string): string {
  return `${resolveEckePublicBaseUrl()}/groups/${encodeURIComponent(slug)}`
}

type ListingWebhookResponse = {
  slug?: string
  eckeSlug?: string
  publicUrl?: string
  eckePublicUrl?: string
  recordId?: string
  eckeRecordId?: string
}

function parseListingWebhookResponse(text: string, fallbackSlug: string): {
  eckeSlug: string
  eckePublicUrl: string | null
  eckePublicUrlKnown: boolean
  eckeRecordId?: string
} {
  try {
    const parsed = JSON.parse(text) as ListingWebhookResponse
    const eckeSlug = (parsed.eckeSlug ?? parsed.slug ?? fallbackSlug).toLowerCase()
    const eckePublicUrl = parsed.eckePublicUrl ?? parsed.publicUrl ?? null
    return {
      eckeSlug,
      eckePublicUrl,
      eckePublicUrlKnown: Boolean(eckePublicUrl),
      eckeRecordId: parsed.eckeRecordId ?? parsed.recordId,
    }
  } catch {
    return {
      eckeSlug: fallbackSlug,
      eckePublicUrl: null,
      eckePublicUrlKnown: false,
    }
  }
}

export async function publishListingToEcke(
  cfg: EckePublishClientConfig,
  payload: EckeListingPayload,
  meta?: { sourceSystem?: string; sourceId?: string; canonicalKinkSocialUrl?: string; entityType?: string },
): Promise<EckePublishResult> {
  if (payload.visibility === 'hidden') {
    return { ok: false, targetKind: 'ecke_listing', error: 'Listing is not public' }
  }
  if (eckePayloadContainsPrivateAppUrls(payload)) {
    return { ok: false, targetKind: 'ecke_listing', error: 'ECKE payload must not contain kink.social URLs' }
  }
  if (!cfg.listingWebhookUrl) {
    return {
      ok: false,
      targetKind: 'ecke_listing',
      error: 'ECKE_PUBLISH_LISTING_WEBHOOK_URL not configured. Listing payload built but not sent',
    }
  }

  try {
    const enrichedPayload = await enrichEckeListingPayloadWithPhotos(payload)

    const webhookBody = JSON.stringify({
      kind: 'ecke_listing',
      action: 'upsert',
      entityType: meta?.entityType ?? 'group',
      sourceSystem: meta?.sourceSystem ?? 'kink.social',
      sourceId: meta?.sourceId,
      canonicalKinkSocialUrl: meta?.canonicalKinkSocialUrl,
      payload: enrichedPayload,
    })

    const listingHmacSecret =
      process.env.ECKE_PUBLISH_LISTING_HMAC_SECRET?.trim() || readEckePublishHmacSecret()

    const res = await fetch(cfg.listingWebhookUrl, {
      method: 'POST',
      headers: buildEckeOutboundAuthHeaders(webhookBody, {
        bearerSecret: cfg.listingWebhookSecret,
        hmacSecret: listingHmacSecret,
        idempotencyKey:
          meta?.sourceId ?
            `kink.social:${meta.entityType ?? 'group'}:${meta.sourceId}`
          : undefined,
      }),
      body: webhookBody,
    })

    const text = await res.text()
    if (!res.ok) {
      return { ok: false, targetKind: 'ecke_listing', error: `listing webhook ${res.status}: ${text.slice(0, 500)}` }
    }

    const parsed = parseListingWebhookResponse(text, enrichedPayload.slug)
    const eckePublicUrl =
      parsed.eckePublicUrl ??
      (parsed.eckePublicUrlKnown ? null : resolveEckePublicGroupListingUrl(parsed.eckeSlug))

    return {
      ok: true,
      targetKind: 'ecke_listing',
      eckeSlug: parsed.eckeSlug,
      eckePublicUrl: eckePublicUrl ?? undefined,
      eckePublicUrlKnown: parsed.eckePublicUrlKnown,
      eckeRecordId: parsed.eckeRecordId,
      detail: eckePublicUrl ?? parsed.eckeSlug,
      photosManifest: enrichedPayload.photos ?? null,
    }
  } catch (e) {
    return { ok: false, targetKind: 'ecke_listing', error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function unpublishListingToEcke(
  cfg: EckePublishClientConfig,
  input: { slug: string; sourceId?: string; entityType?: string },
): Promise<EckePublishResult> {
  if (!cfg.listingWebhookUrl) {
    return {
      ok: true,
      targetKind: 'ecke_listing',
      detail: 'Local unpublish recorded; listing webhook not configured',
    }
  }

  try {
    const webhookBody = JSON.stringify({
      kind: 'ecke_listing',
      action: 'unpublish',
      entityType: input.entityType ?? 'group',
      sourceSystem: 'kink.social',
      sourceId: input.sourceId,
      payload: { slug: input.slug, visibility: 'hidden' },
    })

    const listingHmacSecret =
      process.env.ECKE_PUBLISH_LISTING_HMAC_SECRET?.trim() || readEckePublishHmacSecret()

    const res = await fetch(cfg.listingWebhookUrl, {
      method: 'POST',
      headers: buildEckeOutboundAuthHeaders(webhookBody, {
        bearerSecret: cfg.listingWebhookSecret,
        hmacSecret: listingHmacSecret,
        idempotencyKey:
          input.sourceId ?
            `kink.social:${input.entityType ?? 'group'}:${input.sourceId}:unpublish`
          : undefined,
      }),
      body: webhookBody,
    })

    const text = await res.text()
    if (!res.ok && res.status !== 404) {
      return { ok: false, targetKind: 'ecke_listing', error: `listing unpublish webhook ${res.status}: ${text.slice(0, 500)}` }
    }

    return { ok: true, targetKind: 'ecke_listing', detail: 'unpublished' }
  } catch (e) {
    return { ok: false, targetKind: 'ecke_listing', error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

async function upsertEckeRow(
  cfg: EckePublishClientConfig,
  table: string,
  row: Record<string, unknown>,
  targetKind: EckePublishResult['targetKind'] & string,
): Promise<EckePublishResult> {
  if (eckePayloadContainsPrivateAppUrls(row)) {
    return { ok: false, targetKind, error: 'ECKE payload must not contain kink.social URLs' }
  }
  try {
    const res = await supabaseFetch(cfg, `${table}?on_conflict=slug`, {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify([row]),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, targetKind, error: `${table} upsert ${res.status}: ${text.slice(0, 500)}` }
    }
    return { ok: true, targetKind }
  } catch (e) {
    return { ok: false, targetKind, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function publishEventRowToEcke(cfg: EckePublishClientConfig, row: EckeEventRow): Promise<EckePublishResult> {
  return upsertEckeRow(cfg, 'events', row as unknown as Record<string, unknown>, 'ecke_event')
}

export async function unpublishEventRowToEcke(cfg: EckePublishClientConfig, slug: string): Promise<EckePublishResult> {
  return upsertEckeRow(
    cfg,
    'events',
    { slug, status: 'draft' },
    'ecke_event',
  )
}

export function resolveEckePublicBaseUrl(): string {
  return (process.env.ECKE_PUBLIC_BASE_URL?.trim() || 'https://www.eastcoastkinkevents.com').replace(/\/$/, '')
}

export function resolveEckePublicEducationUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim()
  if (!trimmed) return null
  const cfg = loadEckeIngestApiConfig()
  const base = cfg?.publicBaseUrl ?? resolveEckePublicBaseUrl()
  return `${base.replace(/\/$/, '')}/education/${encodeURIComponent(trimmed)}`
}

export function resolveEckePublicVendorUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim()
  if (!trimmed) return null
  return `${resolveEckePublicBaseUrl()}/vendors/${encodeURIComponent(trimmed)}`
}

export function resolveEckePublicConventionUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim()
  if (!trimmed) return null
  return `${resolveEckePublicBaseUrl()}/conventions/${encodeURIComponent(trimmed)}`
}

export function resolveEckePublicOrganizationUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim()
  if (!trimmed) return null
  return `${resolveEckePublicBaseUrl()}/organizations/${encodeURIComponent(trimmed)}`
}

export function resolveEckePublicPresenterUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim()
  if (!trimmed) return null
  return `${resolveEckePublicBaseUrl()}/presenters/${encodeURIComponent(trimmed)}`
}

export function resolveEckePublicVenueUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim()
  if (!trimmed) return null
  return `${resolveEckePublicBaseUrl()}/venues/${encodeURIComponent(trimmed)}`
}

export function resolveEckePublicDungeonUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim()
  if (!trimmed) return null
  return `${resolveEckePublicBaseUrl()}/dungeons/${encodeURIComponent(trimmed)}`
}

export async function publishVendorRowToEcke(cfg: EckePublishClientConfig, row: EckeVendorRow): Promise<EckePublishResult> {
  return upsertEckeRow(cfg, 'vendors', row as unknown as Record<string, unknown>, 'ecke_vendor')
}

export async function unpublishVendorRowToEcke(cfg: EckePublishClientConfig, slug: string): Promise<EckePublishResult> {
  return upsertEckeRow(
    cfg,
    'vendors',
    { slug, status: 'draft' },
    'ecke_vendor',
  )
}

export async function unpublishDungeonRowToEcke(cfg: EckePublishClientConfig, slug: string): Promise<EckePublishResult> {
  return upsertEckeRow(
    cfg,
    'dungeon_venues',
    { slug, status: 'draft' },
    'ecke_dungeon',
  )
}

export async function publishArticleRowToEcke(cfg: EckePublishClientConfig, row: EckeArticleRow): Promise<EckePublishResult> {
  /** @deprecated education_article uses Option A ingest API (Pass 3B). Legacy direct Supabase REST only. */
  return upsertEckeRow(cfg, 'articles', row as unknown as Record<string, unknown>, 'ecke_article')
}

export async function publishDungeonRowToEcke(cfg: EckePublishClientConfig, row: EckeDungeonRow): Promise<EckePublishResult> {
  return upsertEckeRow(cfg, 'dungeon_venues', row as unknown as Record<string, unknown>, 'ecke_dungeon')
}
