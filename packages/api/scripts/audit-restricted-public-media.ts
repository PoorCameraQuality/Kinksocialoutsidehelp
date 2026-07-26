/**
 * Read-only audit: media_assets with restricted visibility but public media/ storage paths.
 * Usage: USE_DATABASE=true tsx scripts/audit-restricted-public-media.ts
 */
import { and, eq, isNotNull, or, sql } from 'drizzle-orm'
import { MEDIA_VISIBILITIES } from '@c2k/shared'
import { db, schema } from '../src/db/index.js'

const PUBLIC_DIRECT_VISIBILITIES = new Set<string>([MEDIA_VISIBILITIES.publicPreview])

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true')
    process.exit(1)
  }

  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      uploaderUserId: schema.mediaAssets.uploaderUserId,
      visibility: schema.mediaAssets.visibility,
      storageState: schema.mediaAssets.storageState,
      publicStorageKey: schema.mediaAssets.publicStorageKey,
      storageKey: schema.mediaAssets.storageKey,
      uploadStatus: schema.mediaAssets.uploadStatus,
      sourceSurface: schema.mediaAssets.sourceSurface,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        isNotNull(schema.mediaAssets.visibility),
        or(
          isNotNull(schema.mediaAssets.publicStorageKey),
          sql`${schema.mediaAssets.storageKey} LIKE 'media/%'`,
        ),
      ),
    )

  const suspicious = rows.filter((r) => {
    const vis = r.visibility ?? ''
    if (PUBLIC_DIRECT_VISIBILITIES.has(vis)) return false
    const key = r.publicStorageKey ?? r.storageKey ?? ''
    return key.startsWith('media/') || key.includes('/c2k-uploads/media/')
  })

  const byVisibility = new Map<string, number>()
  for (const row of suspicious) {
    const v = row.visibility ?? 'null'
    byVisibility.set(v, (byVisibility.get(v) ?? 0) + 1)
  }

  const uploaderIds = [...new Set(suspicious.map((r) => r.uploaderUserId))]
  const uploaders =
    uploaderIds.length > 0
      ? await db
          .select({ id: schema.users.id, username: schema.users.username })
          .from(schema.users)
          .where(sql`${schema.users.id} IN (${sql.join(uploaderIds.map((id) => sql`${id}`), sql`, `)})`)
      : []

  const usernameById = new Map(uploaders.map((u) => [u.id, u.username]))
  const alphaCount = suspicious.filter((r) => (usernameById.get(r.uploaderUserId) ?? '').startsWith('alpha_')).length

  console.log(JSON.stringify({
    auditedAt: new Date().toISOString(),
    totalMediaRowsWithPublicKey: rows.length,
    suspiciousRestrictedPublicPathCount: suspicious.length,
    visibilityDistribution: Object.fromEntries(byVisibility),
    likelyAlphaTestRows: alphaCount,
    likelyNonAlphaRows: suspicious.length - alphaCount,
    sampleIds: suspicious.slice(0, 20).map((r) => ({
      id: r.id,
      visibility: r.visibility,
      storageState: r.storageState,
      key: r.publicStorageKey ?? r.storageKey,
      uploader: usernameById.get(r.uploaderUserId) ?? r.uploaderUserId,
      sourceSurface: r.sourceSurface,
    })),
    recommendation:
      suspicious.length === 0
        ? 'No restricted rows on public media/ prefix.'
        : 'Remediate per-row: remove MinIO media/ object, set storage_state VALIDATED_PRIVATE, clear public_storage_key, serve via proxy only. Prefer alpha/test rows first; do not bulk-delete.',
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
