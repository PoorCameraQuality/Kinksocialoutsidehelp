import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { resolveModerationReportContext } from './moderation-report-context.js'
import { resolveMediaAssetSnapshotContext } from './moderation-ts-intake.js'
import {
  isModerationReportTargetType,
  toLegacyContextTargetType,
  type ModerationReportTargetType,
} from './moderation-ts-target-validate.js'

export type ModerationCaseContextLink = {
  label: string
  href: string
}

function asLink(label: string, href: string | null | undefined): ModerationCaseContextLink | null {
  const trimmed = href?.trim()
  if (!trimmed) return null
  return { label, href: trimmed }
}

function snapshotHref(snapshots: Array<{ snapshot: unknown }>): string | null {
  for (const snap of snapshots) {
    const payload = snap.snapshot as Record<string, unknown>
    if (typeof payload.href === 'string' && payload.href.trim()) {
      return payload.href.trim()
    }
  }
  return null
}

function labelForTargetType(targetType: ModerationReportTargetType): string {
  switch (targetType) {
    case 'org_chat_message':
      return 'Open org chat'
    case 'org_forum_thread':
    case 'org_forum_reply':
      return 'Open org forums'
    case 'group_thread':
    case 'group_reply':
      return 'Open group forums'
    case 'organization':
      return 'Open organization'
    case 'profile':
      return 'View profile'
    case 'profile_photo':
    case 'media_asset':
      return 'View on profile'
    case 'message':
      return 'Open DM thread'
    case 'post':
      return 'View author profile'
    case 'comment':
      return 'Open discussion'
    case 'group':
      return 'Open group'
    case 'event':
      return 'Open event'
    case 'convention':
      return 'Open convention'
    case 'vendor':
      return 'Open vendor shop'
    case 'presenter':
      return 'Open presenter profile'
    default:
      return 'View in context'
  }
}

async function resolveDirectMessageLink(targetId: string): Promise<ModerationCaseContextLink | null> {
  const [msg] = await db
    .select({ conversationId: schema.messages.conversationId })
    .from(schema.messages)
    .where(eq(schema.messages.id, targetId))
    .limit(1)
  if (!msg) return null
  return asLink('Open DM thread', `/messaging?c=${encodeURIComponent(msg.conversationId)}`)
}

async function resolveProfilePhotoLink(targetId: string): Promise<ModerationCaseContextLink | null> {
  const [photo] = await db
    .select({ profileId: schema.profilePhotos.profileId })
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.id, targetId))
    .limit(1)
  if (!photo) return null

  const [owner] = await db
    .select({ username: schema.users.username })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(eq(schema.profiles.id, photo.profileId))
    .limit(1)
  return asLink('View on profile', owner ? `/profile/${owner.username}?tab=Photos` : null)
}

async function resolveFeedPostLink(targetId: string): Promise<ModerationCaseContextLink | null> {
  const [post] = await db
    .select({ authorId: schema.feedPosts.authorId })
    .from(schema.feedPosts)
    .where(eq(schema.feedPosts.id, targetId))
    .limit(1)
  if (!post) return null

  const [author] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, post.authorId))
    .limit(1)
  return asLink('View author profile', author ? `/profile/${author.username}` : null)
}

async function resolveForumPostLink(targetId: string): Promise<ModerationCaseContextLink | null> {
  for (const legacyType of ['org_forum_post', 'group_forum_post', 'event_discussion_post'] as const) {
    const ctx = await resolveModerationReportContext(legacyType, targetId)
    if (!ctx.contentMissing && ctx.href) {
      return asLink('Open discussion', ctx.href)
    }
  }
  return null
}

async function resolveLegacyContextLink(
  targetType: ModerationReportTargetType,
  targetId: string
): Promise<ModerationCaseContextLink | null> {
  const legacyType = toLegacyContextTargetType(targetType)
  const ctx = await resolveModerationReportContext(legacyType, targetId)
  return asLink(labelForTargetType(targetType), ctx.href)
}

export async function resolveModerationCaseContextLinks(
  targetContentType: string,
  targetContentId: string,
  snapshots: Array<{ snapshot: unknown }> = []
): Promise<ModerationCaseContextLink[]> {
  const links: ModerationCaseContextLink[] = []
  const push = (link: ModerationCaseContextLink | null) => {
    if (link) links.push(link)
  }

  if (!isModerationReportTargetType(targetContentType)) {
    const href = snapshotHref(snapshots)
    if (href) links.push({ label: 'View in context', href })
    return links
  }

  const targetType = targetContentType

  switch (targetType) {
    case 'message':
      push(await resolveDirectMessageLink(targetContentId))
      break
    case 'profile_photo':
      push(await resolveProfilePhotoLink(targetContentId))
      break
    case 'media_asset': {
      const ctx = await resolveMediaAssetSnapshotContext(targetContentId)
      push(asLink('View on profile', ctx.href))
      break
    }
    case 'post':
      push(await resolveFeedPostLink(targetContentId))
      break
    case 'comment':
      push(await resolveForumPostLink(targetContentId))
      break
    case 'group':
      push(asLink('Open group', `/groups/${targetContentId}`))
      break
    case 'event':
      push(asLink('Open event', `/events/${targetContentId}`))
      break
    case 'convention': {
      const [row] = await db
        .select({ slug: schema.conventions.slug })
        .from(schema.conventions)
        .where(eq(schema.conventions.id, targetContentId))
        .limit(1)
      push(asLink('Open convention', row ? `/conventions/${row.slug}` : null))
      break
    }
    case 'vendor': {
      const [row] = await db
        .select({ slug: schema.vendorProfiles.slug })
        .from(schema.vendorProfiles)
        .where(eq(schema.vendorProfiles.id, targetContentId))
        .limit(1)
      push(asLink('Open vendor shop', row ? `/vendors/${row.slug}` : null))
      break
    }
    case 'presenter': {
      const [row] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, targetContentId))
        .limit(1)
      push(asLink('Open presenter profile', row ? `/presenters/${row.username}` : null))
      break
    }
    default:
      push(await resolveLegacyContextLink(targetType, targetContentId))
      break
  }

  if (links.length === 0) {
    const href = snapshotHref(snapshots)
    if (href) {
      links.push({ label: labelForTargetType(targetType), href })
    }
  }

  return links
}
