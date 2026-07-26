/**
 * Remediate restricted-visibility media rows still on public MinIO `media/` prefix.
 * Default: dry run. Set APPLY=true to mutate DB and remove public MinIO objects.
 *
 * Usage:
 *   USE_DATABASE=true npm run remediate:restricted-public-media -w @c2k/api
 *   USE_DATABASE=true APPLY=true UPLOADER_USERNAME=someuser npm run remediate:restricted-public-media -w @c2k/api
 *
 * See docs/PUBLIC_ALPHA_PROMOTION.md § Legacy profile media.
 */
import { and, eq, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { MEDIA_STORAGE_STATES, MEDIA_VISIBILITIES } from '@c2k/shared'
import { db, schema } from '../src/db/index.js'
import { deleteObject, getS3Client, defaultBucket } from '../src/lib/s3-upload.js'
import { syncProfilePhotoServingUrlsForAsset } from '../src/lib/sync-profile-media-serving-urls.js'

const PUBLIC_DIRECT_VISIBILITIES = new Set<string>([MEDIA_VISIBILITIES.publicPreview])
const APPLY = process.env.APPLY === 'true'
const UPLOADER_USERNAME = process.env.UPLOADER_USERNAME?.trim() || null
const SKIP_ALPHA_UPLOADERS = process.env.SKIP_ALPHA_UPLOADERS !== 'false'

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
      quarantineStorageKey: schema.mediaAssets.quarantineStorageKey,
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

  const uploaderIds = [...new Set(suspicious.map((r) => r.uploaderUserId))]
  const uploaders =
    uploaderIds.length > 0
      ? await db
          .select({ id: schema.users.id, username: schema.users.username })
          .from(schema.users)
          .where(inArray(schema.users.id, uploaderIds))
      : []

  const usernameById = new Map(uploaders.map((u) => [u.id, u.username]))

  let targets = suspicious
  if (UPLOADER_USERNAME) {
    targets = targets.filter((r) => usernameById.get(r.uploaderUserId) === UPLOADER_USERNAME)
  }
  if (SKIP_ALPHA_UPLOADERS) {
    targets = targets.filter((r) => !(usernameById.get(r.uploaderUserId) ?? '').startsWith('alpha_'))
  }

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    filters: { UPLOADER_USERNAME, SKIP_ALPHA_UPLOADERS },
    candidateCount: targets.length,
    remediated: [] as string[],
    skipped: [] as { id: string; reason: string; uploader?: string }[],
    errors: [] as { id: string; error: string }[],
  }

  for (const row of targets) {
    const publicKey = row.publicStorageKey ?? (row.storageKey?.startsWith('media/') ? row.storageKey : null)
    const uploader = usernameById.get(row.uploaderUserId)
    if (!publicKey) {
      report.skipped.push({ id: row.id, reason: 'no_public_key', uploader })
      continue
    }

    const privateKey = row.quarantineStorageKey ?? (row.storageKey?.startsWith('media/') ? null : row.storageKey)
    if (!privateKey || privateKey === publicKey) {
      report.skipped.push({
        id: row.id,
        reason: 'no_separate_private_copy; manual copy-to-quarantine required before MinIO delete',
        uploader,
      })
      continue
    }

    if (APPLY) {
      try {
        await db
          .update(schema.mediaAssets)
          .set({
            storageState: MEDIA_STORAGE_STATES.validatedPrivate,
            publicStorageKey: null,
            storageKey: privateKey,
            updatedAt: new Date(),
          })
          .where(eq(schema.mediaAssets.id, row.id))

        try {
          const client = getS3Client()
          await deleteObject(client, defaultBucket(), publicKey)
        } catch (s3Err) {
          report.errors.push({
            id: row.id,
            error: `db_updated_minio_delete_failed: ${s3Err instanceof Error ? s3Err.message : String(s3Err)}`,
          })
          continue
        }

        report.remediated.push(row.id)
        await syncProfilePhotoServingUrlsForAsset(row.id)
      } catch (err) {
        report.errors.push({
          id: row.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      report.remediated.push(row.id)
    }
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        sample: targets.slice(0, 10).map((r) => ({
          id: r.id,
          uploader: usernameById.get(r.uploaderUserId),
          visibility: r.visibility,
          publicKey: r.publicStorageKey ?? r.storageKey,
          quarantineKey: r.quarantineStorageKey,
          sourceSurface: r.sourceSurface,
        })),
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
