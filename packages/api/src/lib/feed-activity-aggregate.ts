import type { FollowingFeedItem } from './feed-following.js'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** Aggregation windows from product spec (midpoints). */
export function aggregationWindowMs(verb: string): number | null {
  switch (verb) {
    case 'loved':
    case 'reacted':
    case 'post_love':
    case 'commented':
    case 'post_comment':
      return 45 * MINUTE
    case 'followed':
    case 'connection_accepted':
      return 4 * HOUR
    case 'uploaded_media':
      return 4 * HOUR
    case 'event_rsvp':
    case 'rsvped_event':
      return 12 * HOUR
    case 'replied_discussion':
    case 'created_discussion':
      return 2 * HOUR
    default:
      return null
  }
}

function objectTypeKey(item: FollowingFeedItem): string {
  if (item.kind === 'post') return 'post'
  const t = typeof item.object?.type === 'string' ? item.object.type : ''
  return t || 'unknown'
}

function parseTime(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

function mergeMediaPreviews(target: Record<string, unknown>, source: Record<string, unknown>): void {
  const urls = new Set<string>()
  for (const list of [target.previewUrls, source.previewUrls]) {
    if (Array.isArray(list)) {
      for (const u of list) {
        if (typeof u === 'string' && u.trim()) urls.add(u.trim())
      }
    }
  }
  const thumb = typeof source.thumbnailUrl === 'string' ? source.thumbnailUrl : null
  if (thumb) urls.add(thumb)
  if (urls.size > 0) target.previewUrls = [...urls]
}

function mergeFollowUsernames(target: Record<string, unknown>, source: Record<string, unknown>): void {
  const names = new Set<string>()
  for (const list of [target.usernames, source.usernames]) {
    if (Array.isArray(list)) {
      for (const u of list) {
        if (typeof u === 'string' && u.trim()) names.add(u.trim())
      }
    }
  }
  const single =
    typeof source.targetUsername === 'string' ? source.targetUsername
    : typeof source.partnerUsername === 'string' ? source.partnerUsername
    : null
  if (single?.trim()) names.add(single.trim())
  if (names.size > 0) {
    target.usernames = [...names]
    target.count = names.size
  }
}

function mergeAggregatedActivity(
  primary: FollowingFeedItem,
  secondary: FollowingFeedItem,
): FollowingFeedItem {
  const object = { ...(primary.object ?? {}) }
  const secondaryObject = secondary.object ?? {}
  const count =
    (typeof object.count === 'number' ? object.count : 1) +
    (typeof secondaryObject.count === 'number' ? secondaryObject.count : 1)
  object.count = count

  if (primary.verb === 'loved' || primary.verb === 'reacted' || primary.verb === 'post_love') {
    mergeMediaPreviews(object, secondaryObject)
  }
  if (primary.verb === 'followed' || primary.verb === 'connection_accepted') {
    mergeFollowUsernames(object, secondaryObject)
  }

  return {
    ...primary,
    createdAt: primary.createdAt,
    object,
  }
}

/** Collapse similar activity rows from the same actor within time windows. */
export function aggregateFollowingFeedItems(items: FollowingFeedItem[]): FollowingFeedItem[] {
  const out: FollowingFeedItem[] = []

  for (const item of items) {
    if (item.kind !== 'activity' || !item.verb) {
      out.push(item)
      continue
    }

    const windowMs = aggregationWindowMs(item.verb)
    if (!windowMs) {
      out.push(item)
      continue
    }

    const typeKey = objectTypeKey(item)
    const itemTime = parseTime(item.createdAt)
    const existingIdx = out.findIndex((prev) => {
      if (prev.kind !== 'activity' || prev.verb !== item.verb) return false
      if (prev.actor.id !== item.actor.id) return false
      if (objectTypeKey(prev) !== typeKey) return false
      const prevTime = parseTime(prev.createdAt)
      return Math.abs(itemTime - prevTime) <= windowMs
    })

    if (existingIdx === -1) {
      out.push(item)
      continue
    }

    out[existingIdx] = mergeAggregatedActivity(out[existingIdx]!, item)
  }

  return out
}
