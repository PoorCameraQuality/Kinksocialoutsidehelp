/**
 * Remediate LOGGED_IN staff/test profile photos wrongly on public media/ prefix.
 * Default: dry run. Set APPLY=true to mutate DB and remove public MinIO objects.
 *
 * Usage (VPS):
 *   USE_DATABASE=true APPLY=false tsx scripts/remediate-staff-restricted-public-media.ts
 *   USE_DATABASE=true APPLY=true tsx scripts/remediate-staff-restricted-public-media.ts
 */
import { and, eq, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { MEDIA_STORAGE_STATES, MEDIA_VISIBILITIES } from '@c2k/shared'
import { db, schema } from '../src/db/index.js'
import { deleteObject, getS3Client, defaultBucket } from '../src/lib/s3-upload.js'

const STAFF_USERNAMES = new Set(['Brax', 'TestAdmin'])
const APPLY = process.env.APPLY === 'true'

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true')
    process.exit(1)
  }

  const staffUsers = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.username, [...STAFF_USERNAMES]))

  const staffIds = new Set(staffUsers.map((u) => u.id))
  const usernameById = new Map(staffUsers.map((u) => [u.id, u.username]))

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
        eq(schema.mediaAssets.visibility, MEDIA_VISIBILITIES.loggedIn),
        or(
          isNotNull(schema.mediaAssets.publicStorageKey),
          sql`${schema.mediaAssets.storageKey} LIKE 'media/%'`,
        ),
      ),
    )

  const targets = rows.filter((r) => {
    if (!staffIds.has(r.uploaderUserId)) return false
    const key = r.publicStorageKey ?? r.storageKey ?? ''
    return key.startsWith('media/')
  })

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    staffUsernames: [...STAFF_USERNAMES],
    candidateCount: targets.length,
    remediated: [] as string[],
    skipped: [] as { id: string; reason: string }[],
    errors: [] as { id: string; error: string }[],
  }

  for (const row of targets) {
    const publicKey = row.publicStorageKey ?? (row.storageKey?.startsWith('media/') ? row.storageKey : null)
    if (!publicKey) {
      report.skipped.push({ id: row.id, reason: 'no_public_key' })
      continue
    }

    const privateKey = row.quarantineStorageKey ?? row.storageKey
    if (!privateKey || privateKey === publicKey) {
      report.skipped.push({
        id: row.id,
        reason: 'no_separate_private_copy; manual copy-to-quarantine required before MinIO delete',
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
        sample: targets.slice(0, 5).map((r) => ({
          id: r.id,
          uploader: usernameById.get(r.uploaderUserId),
          visibility: r.visibility,
          publicKey: r.publicStorageKey ?? r.storageKey,
          quarantineKey: r.quarantineStorageKey,
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
