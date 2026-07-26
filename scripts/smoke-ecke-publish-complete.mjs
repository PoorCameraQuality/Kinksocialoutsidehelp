#!/usr/bin/env node
/**
 * ECKE Publish completion smoke — prints PASS/FAIL per source kind.
 * Requires: C2K_API_URL, C2K_SESSION_COOKIE (or bearer), ECKE_PUBLIC_URL, ECKE_LISTING_WEBHOOK_SECRET (optional verify).
 *
 * Usage: node scripts/smoke-ecke-publish-complete.mjs
 */
const kinds = [
  'group_listing',
  'event_listing',
  'education_article',
  'vendor_profile',
  'organization_listing',
  'dungeon_profile',
  'venue_profile',
  'presenter_profile',
  'convention_listing',
  'convention_event_anchor',
  'dancecard_event',
]

const api = process.env.C2K_API_URL ?? 'http://127.0.0.1:4000'
const cookie = process.env.C2K_SESSION_COOKIE ?? ''

function headers() {
  const h = { Accept: 'application/json' }
  if (cookie) h.Cookie = cookie
  return h
}

async function checkKind(kind) {
  const sourceId = process.env[`SMOKE_${kind.toUpperCase().replace(/-/g, '_')}_ID`]
  if (!sourceId) {
    return { kind, status: 'SKIP', detail: 'Set SMOKE_*_ID env for this kind' }
  }
  try {
    const previewUrl = `${api}/api/v1/ecke-publish/preview?sourceKind=${encodeURIComponent(kind)}&sourceId=${encodeURIComponent(sourceId)}`
    const r = await fetch(previewUrl, { headers: headers() })
    if (!r.ok) {
      return { kind, status: 'FAIL', detail: `preview ${r.status}` }
    }
    const body = await r.json()
    if (!body.wouldNotPublish?.length) {
      return { kind, status: 'WARN', detail: 'preview missing wouldNotPublish list' }
    }
    return { kind, status: 'PASS', detail: `eligible=${body.eligible} status=${body.status}` }
  } catch (e) {
    return { kind, status: 'FAIL', detail: String(e?.message ?? e) }
  }
}

async function main() {
  console.log('ECKE Publish smoke — preview eligibility per kind\n')
  for (const kind of kinds) {
    const result = await checkKind(kind)
    console.log(`${result.status.padEnd(5)} ${result.kind} — ${result.detail}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
