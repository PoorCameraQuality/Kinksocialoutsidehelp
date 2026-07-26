import { and, eq, gte } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { requestFeedActivityEmit } from './feed-activities-queue.js'

export type FeedActivityVerb =
  | 'post'
  | 'uploaded_media'
  | 'uploaded_picture'
  | 'uploaded_video'
  | 'media_reacted'
  | 'media_commented'
  | 'media_tagged_user'
  | 'media_added_to_album'
  | 'avatar_updated'
  | 'connection_accepted'
  | 'event_created'
  | 'event_rsvp'
  | 'presenter_assigned'
  | 'convention_pin'
  | 'org_announcement'
  | 'org_join'
  | 'group_join'
  | 'group_thread_created'
  | 'vendor_shop_live'
  | 'loved'
  | 'reacted'
  | 'post_love'
  | 'post_comment'
  | 'commented'
  | 'followed'

export type FeedActivityObjectType =
  | 'feed_post'
  | 'media_post'
  | 'media_item'
  | 'connection'
  | 'event'
  | 'schedule_slot'
  | 'convention'
  | 'organization'
  | 'group'
  | 'forum_thread'
  | 'vendor'
  | 'profile'
  | 'user'

export type EmitActivityParams = {
  actorId: string
  verb: FeedActivityVerb
  objectType: FeedActivityObjectType
  objectId: string
  audienceType?: string
  metadata?: Record<string, unknown>
}

const IDEMPOTENCY_WINDOW_MS = 60_000

/** Insert activity row; skips duplicate actor+verb+object within 60s (worker retry safety). */
export async function insertFeedActivity(params: EmitActivityParams): Promise<string | null> {
  const {
    actorId,
    verb,
    objectType,
    objectId,
    audienceType = 'followers',
    metadata = {},
  } = params
  const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS)
  const [existing] = await db
    .select({ id: schema.feedActivities.id })
    .from(schema.feedActivities)
    .where(
      and(
        eq(schema.feedActivities.actorId, actorId),
        eq(schema.feedActivities.verb, verb),
        eq(schema.feedActivities.objectType, objectType),
        eq(schema.feedActivities.objectId, objectId),
        gte(schema.feedActivities.createdAt, since),
      ),
    )
    .limit(1)
  if (existing) return existing.id

  const [row] = await db
    .insert(schema.feedActivities)
    .values({
      actorId,
      verb,
      objectType,
      objectId,
      audienceType,
      metadata,
    })
    .returning({ id: schema.feedActivities.id })
  return row?.id ?? null
}

/** Enqueue activity emit after DB commit; inline fallback when Redis unavailable. */
export function emitActivity(params: EmitActivityParams): void {
  void requestFeedActivityEmit(params)
}
