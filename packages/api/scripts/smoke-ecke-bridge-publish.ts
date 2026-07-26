/**
 * Phase C pilot: publish preview convention to ECKE Supabase `public.events`.
 *
 * Usage (repo root, Docker + db:prepare):
 *   npx tsx packages/api/scripts/smoke-ecke-bridge-publish.ts [conventionSlug]
 *
 * Env: .env.development + .env.local (ECKE_PUBLISH_*).
 */
import '../src/load-dev-env.js'
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import { executeEckePublishConventionEvent } from '../src/lib/ecke-publish-executor.js'
import { loadEckePublishClientConfig } from '../src/lib/ecke-publish-client.js'

const SLUG = process.argv[2] ?? process.env.SMOKE_CONV ?? 'preview-c2k-weekend'

async function verifyEckeRow(slug: string): Promise<void> {
  const cfg = loadEckePublishClientConfig()
  if (!cfg) throw new Error('ECKE bridge not configured')

  const url = `${cfg.supabaseUrl}/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&select=slug,title,status,c2k_source_type,c2k_source_id`
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
    },
  })
  if (!res.ok) {
    throw new Error(`ECKE verify GET ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const rows = (await res.json()) as Array<{
    slug: string
    title: string
    status: string
    c2k_source_type: string | null
    c2k_source_id: string | null
  }>
  if (rows.length === 0) {
    throw new Error(`No ECKE events row for slug=${slug}`)
  }
  const row = rows[0]!
  if (!row.c2k_source_id || row.c2k_source_type !== 'convention') {
    throw new Error(`Row missing C2K ids: ${JSON.stringify(row)}`)
  }
  console.log('ECKE verify ok:', row)
}

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    throw new Error('USE_DATABASE must be true')
  }
  if (process.env.ECKE_PUBLISH_ENABLED !== 'true') {
    throw new Error('Set ECKE_PUBLISH_ENABLED=true in .env.local')
  }

  const [conv] = await db
    .select({ id: schema.conventions.id, slug: schema.conventions.slug, name: schema.conventions.name })
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, SLUG))
    .limit(1)

  if (!conv) {
    throw new Error(`Convention not found: ${SLUG}`)
  }

  console.log(`Publishing convention ${conv.slug} (${conv.name}) → ECKE events…`)
  const result = await executeEckePublishConventionEvent(conv.id)
  if (!result.ok) {
    throw new Error(result.error)
  }
  console.log('C2K publish ok:', result)

  await verifyEckeRow(conv.slug)

  const [target] = await db
    .select({
      status: schema.eckePublishTargets.status,
      lastError: schema.eckePublishTargets.lastError,
      externalSlug: schema.eckePublishTargets.externalSlug,
    })
    .from(schema.eckePublishTargets)
    .where(
      eq(schema.eckePublishTargets.conventionId, conv.id),
    )
    .limit(5)

  console.log('ecke_publish_targets sample:', target)
  console.log('Phase C pilot complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
