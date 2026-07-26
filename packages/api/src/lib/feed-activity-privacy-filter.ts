import {
  canActorActivityAppearInFeed,
  defaultFeedActivityPrivacy,
  normalizePrivacySettings,
  type FeedActivityPrivacy,
  type FeedActivityVerbKey,
} from '@c2k/shared'
import { inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Map DB feed verb to privacy settings key. */
export function mapFeedVerbToPrivacyKey(verb: string, source: 'post' | 'activity'): FeedActivityVerbKey {
  if (source === 'post') return 'posted'
  switch (verb) {
    case 'post':
      return 'posted'
    case 'loved':
    case 'reacted':
    case 'post_love':
      return 'loved'
    case 'commented':
    case 'post_comment':
    case 'replied_discussion':
    case 'created_discussion':
    case 'group_thread_created':
      return 'commented'
    case 'followed':
    case 'connection_accepted':
      return 'followed'
    case 'event_rsvp':
      return 'event_rsvp'
    case 'event_created':
      return 'event_created'
    case 'group_join':
    case 'joined_group':
      return 'group_join'
    case 'uploaded_media':
      return 'uploaded_media'
    case 'added_vendor_product':
    case 'vendor_shop_live':
      return 'vendor_shop_live'
    case 'published_class':
    case 'presenter_assigned':
      return 'presenter_assigned'
    case 'org_join':
      return 'org_join'
    case 'org_announcement':
      return 'org_announcement'
    case 'convention_pin':
      return 'convention_pin'
    default:
      return 'posted'
  }
}

export async function loadActorFeedPrivacy(actorIds: string[]): Promise<Map<string, FeedActivityPrivacy>> {
  const unique = [...new Set(actorIds.filter(Boolean))]
  const map = new Map<string, FeedActivityPrivacy>()
  if (unique.length === 0) return map

  const rows = await db
    .select({
      userId: schema.userSettings.userId,
      privacySettings: schema.userSettings.privacySettings,
    })
    .from(schema.userSettings)
    .where(inArray(schema.userSettings.userId, unique))

  for (const row of rows) {
    map.set(row.userId, normalizePrivacySettings(row.privacySettings).feedActivityPrivacy)
  }
  for (const id of unique) {
    if (!map.has(id)) map.set(id, defaultFeedActivityPrivacy)
  }
  return map
}

export function actorFeedActivityAllowed(params: {
  actorId: string
  verb: string
  source: 'post' | 'activity'
  viewerId: string
  viewerConnectionIds: Set<string>
  privacyByActor: Map<string, FeedActivityPrivacy>
}): boolean {
  const { actorId, verb, source, viewerId, viewerConnectionIds, privacyByActor } = params
  if (actorId === viewerId) return true
  const privacy = privacyByActor.get(actorId) ?? defaultFeedActivityPrivacy
  const verbKey = mapFeedVerbToPrivacyKey(verb, source)
  return canActorActivityAppearInFeed(privacy, verbKey, {
    viewerFollowsActor: viewerConnectionIds.has(actorId),
  })
}
