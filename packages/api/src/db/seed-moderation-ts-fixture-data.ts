/**
 * Creates moderation QA rows when missing - not just reports against whatever happens to exist.
 * Idempotent via stable quarantine keys + fixture marker strings.
 */
import {
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  SCANNER_NAMES,
  SCANNER_RESULT_STATUSES,
  SCAN_STATUSES,
} from '@c2k/shared'
import { and, eq, like } from 'drizzle-orm'
import { db, schema } from './index.js'
import { mediaContentProxyPath } from '../lib/media-pipeline.js'
import { defaultBucket, getS3Client, putObject } from '../lib/s3-upload.js'

export const DEMO_MOD_TS_FIXTURE_MARKER = 'demo-mod-ts-fixture'

/** Stable object keys - same paths local dev and server-style MinIO layout. */
export const FIXTURE_QUARANTINE_KEY_CLEAN = 'quarantine/fixtures/mod-ts-clean.jpg'
export const FIXTURE_QUARANTINE_KEY_MALWARE = 'quarantine/fixtures/mod-ts-malware.jpg'

export const FIXTURE_ORG_CHAT_BODY = `${DEMO_MOD_TS_FIXTURE_MARKER}: org hub chat. Harassment sample for scoped mod QA.`
export const FIXTURE_DM_BODY = `${DEMO_MOD_TS_FIXTURE_MARKER}: private DM. Unwanted message sample for platform T&S QA.`

/** Minimal valid JPEG (1×1) for mod viewer smoke. */
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgIC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==',
  'base64'
)

async function uploadFixtureBytes(key: string, body: Buffer): Promise<void> {
  const client = getS3Client()
  if (!client) {
    console.warn(`  MinIO unavailable. Created DB row for ${key} but mod viewer needs S3_ENDPOINT + bucket.`)
    return
  }
  await putObject(client, {
    Bucket: defaultBucket(),
    Key: key,
    Body: body,
    ContentType: 'image/jpeg',
  })
}

async function resolveUserId(username: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
  return row?.id ?? null
}

async function resolveProfileId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1)
  return row?.id ?? null
}

export async function ensureFixtureQuarantinedMedia(): Promise<{
  cleanAssetId: string | null
  malwareAssetId: string | null
}> {
  const uploaderId = (await resolveUserId('LeatherCraftDemo')) ?? (await resolveUserId('ShutterSeed'))
  if (!uploaderId) {
    console.log('Moderation fixtures: no LeatherCraftDemo/ShutterSeed. Run db:seed first.')
    return { cleanAssetId: null, malwareAssetId: null }
  }

  const profileId = await resolveProfileId(uploaderId)
  if (!profileId) {
    console.log('Moderation fixtures: uploader has no profile row.')
    return { cleanAssetId: null, malwareAssetId: null }
  }

  let cleanAssetId: string | null = null
  const [existingClean] = await db
    .select({ id: schema.mediaAssets.id })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.quarantineStorageKey, FIXTURE_QUARANTINE_KEY_CLEAN))
    .limit(1)

  if (existingClean) {
    cleanAssetId = existingClean.id
  } else {
    await uploadFixtureBytes(FIXTURE_QUARANTINE_KEY_CLEAN, TINY_JPEG)
    const [row] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: uploaderId,
        ownerType: 'profile',
        ownerId: profileId,
        sourceSurface: 'profile_gallery',
        storageKey: FIXTURE_QUARANTINE_KEY_CLEAN,
        quarantineStorageKey: FIXTURE_QUARANTINE_KEY_CLEAN,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
        mimeType: 'image/jpeg',
        sizeBytes: TINY_JPEG.length,
        uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
        scanStatus: SCAN_STATUSES.passed,
        contentRating: 'EXPLICIT_ADULT',
        visibility: 'LOGGED_IN',
        depictedPeople: 'ONLY_ME',
        uploaderConfirmed18: true,
        uploaderConfirmedConsent: true,
        uploaderConfirmedRightToUpload: true,
        uploaderConfirmedNoNcii: true,
        uploaderConfirmedNoMinors: true,
        uploaderConfirmedDepictedAdults18: true,
        uploaderConfirmedNoHiddenCamera: true,
      })
      .returning({ id: schema.mediaAssets.id })
    cleanAssetId = row.id

    const [existingPhoto] = await db
      .select({ id: schema.profilePhotos.id })
      .from(schema.profilePhotos)
      .where(eq(schema.profilePhotos.mediaAssetId, cleanAssetId))
      .limit(1)

    if (!existingPhoto) {
      await db.insert(schema.profilePhotos).values({
        profileId,
        mediaAssetId: cleanAssetId,
        url: mediaContentProxyPath(cleanAssetId),
        caption: DEMO_MOD_TS_FIXTURE_MARKER,
        sortOrder: 99,
      })
    }
  }

  let malwareAssetId: string | null = null
  const [existingMalware] = await db
    .select({ id: schema.mediaAssets.id })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.quarantineStorageKey, FIXTURE_QUARANTINE_KEY_MALWARE))
    .limit(1)

  if (existingMalware) {
    malwareAssetId = existingMalware.id
  } else {
    await uploadFixtureBytes(FIXTURE_QUARANTINE_KEY_MALWARE, TINY_JPEG)
    const [row] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: uploaderId,
        ownerType: 'profile',
        ownerId: profileId,
        sourceSurface: 'profile_gallery',
        storageKey: FIXTURE_QUARANTINE_KEY_MALWARE,
        quarantineStorageKey: FIXTURE_QUARANTINE_KEY_MALWARE,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
        mimeType: 'image/jpeg',
        sizeBytes: TINY_JPEG.length,
        uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
        scanStatus: SCAN_STATUSES.failed,
        contentRating: 'ADULT_NON_EXPLICIT',
        visibility: 'LOGGED_IN',
        depictedPeople: 'ONLY_ME',
      })
      .returning({ id: schema.mediaAssets.id })
    malwareAssetId = row.id

    await db.insert(schema.mediaScannerResults).values({
      mediaAssetId: malwareAssetId,
      scannerName: SCANNER_NAMES.malwareClamav,
      scannerVersion: 'fixture-1.0',
      status: SCANNER_RESULT_STATUSES.blocked,
      userFacingSummary: 'Fixture: simulated malware block. Mod viewer must not serve bytes.',
      simulated: true,
    })
  }

  return { cleanAssetId, malwareAssetId }
}

export async function ensureFixtureOrgChatMessage(): Promise<string | null> {
  const [existing] = await db
    .select({ id: schema.orgChannelMessages.id })
    .from(schema.orgChannelMessages)
    .where(like(schema.orgChannelMessages.body, `${DEMO_MOD_TS_FIXTURE_MARKER}%`))
    .limit(1)
  if (existing) return existing.id

  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) return null

  const [channel] = await db
    .select({ id: schema.orgChannels.id })
    .from(schema.orgChannels)
    .where(eq(schema.orgChannels.organizationId, org.id))
    .limit(1)
  if (!channel) return null

  const senderId =
    (await resolveUserId('LeatherCraftDemo')) ?? (await resolveUserId('RopeDreamer'))
  if (!senderId) return null

  const [msg] = await db
    .insert(schema.orgChannelMessages)
    .values({
      orgChannelId: channel.id,
      senderId,
      body: FIXTURE_ORG_CHAT_BODY,
    })
    .returning({ id: schema.orgChannelMessages.id })
  return msg.id
}

export async function ensureFixtureDmMessage(): Promise<string | null> {
  const [existing] = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(like(schema.messages.body, `${DEMO_MOD_TS_FIXTURE_MARKER}%`))
    .limit(1)
  if (existing) return existing.id

  const initiatorId = (await resolveUserId('LeatherCraftDemo')) ?? (await resolveUserId('RopeDreamer'))
  const recipientId =
    (await resolveUserId('ShutterSeed')) ??
    (await resolveUserId('RopeDreamer'))
  if (!initiatorId || !recipientId || initiatorId === recipientId) return null

  const [conv] = await db.insert(schema.conversations).values({ initiatorUserId: initiatorId }).returning({
    id: schema.conversations.id,
  })

  await db.insert(schema.conversationParticipants).values([
    { conversationId: conv.id, userId: initiatorId, acceptanceStatus: 'ACCEPTED' },
    { conversationId: conv.id, userId: recipientId, acceptanceStatus: 'ACCEPTED' },
  ])

  const [msg] = await db
    .insert(schema.messages)
    .values({
      conversationId: conv.id,
      senderId: initiatorId,
      body: FIXTURE_DM_BODY,
    })
    .returning({ id: schema.messages.id })
  return msg.id
}
