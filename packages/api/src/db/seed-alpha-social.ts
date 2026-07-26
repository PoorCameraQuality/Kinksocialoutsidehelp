/**
 * Alpha social seed — append-only fictional social layer around existing ECKE/event data.
 *
 * Run:
 *   ALLOW_ALPHA_SOCIAL_SEED=true USE_DATABASE=true npm run seed:alpha-social
 *
 * Does NOT wipe, truncate, or overwrite existing ECKE listings.
 */
import bcrypt from 'bcryptjs'
import { and, count, desc, eq, gte, like, sql } from 'drizzle-orm'
import {
  defaultFeedSettings,
  defaultNotificationSettings,
  defaultPrivacySettings,
  mergeFeedSettings,
  mergePrivacySettings,
  NOTIFICATION_TYPES,
} from '@c2k/shared'
import { assertAlphaSocialSeedAllowed } from '../lib/alpha-social-seed-guard.js'
import {
  ALPHA_SOCIAL_BATCH_KEY,
  ALPHA_SOCIAL_COMMENTS,
  ALPHA_SOCIAL_CONNECTIONS,
  ALPHA_SOCIAL_DMS,
  ALPHA_SOCIAL_FOLLOWS,
  ALPHA_SOCIAL_FORUM_THREADS,
  ALPHA_SOCIAL_GROUPS,
  ALPHA_SOCIAL_ONLY_EVENTS,
  ALPHA_SOCIAL_PASSWORD_DEFAULT,
  ALPHA_SOCIAL_PASSWORD_ENV,
  ALPHA_SOCIAL_POSTS,
  ALPHA_SOCIAL_REACTIONS,
  ALPHA_SOCIAL_RSVPS,
  ALPHA_SOCIAL_USERS,
  alphaSocialEmail,
  alphaSocialMarker,
  type AlphaSocialUserDef,
} from '../lib/alpha-social-seed-catalog.js'
import {
  ALPHA_ECKE_BATCH_KEY,
  createAlphaSeedMarker,
  ensureAlphaSeedBatch,
  getAlphaSeedBatchId,
} from '../lib/alpha-seed-labels.js'
import { createNotification } from '../lib/create-notification.js'
import { insertFeedActivity } from '../lib/feed-activities.js'
import { refreshEventRsvpCount } from '../lib/event-rsvp-helpers.js'
import { resolveVendorCategoryTags } from '../lib/vendor-public-dto.js'
import './load-dev-env.js'
import { db, schema } from './index.js'

type MarkFn = ReturnType<typeof createAlphaSeedMarker>
type UserMap = Map<string, string>
type GroupMap = Map<string, string>
type EventMap = Map<string, string>
type PostMap = Map<string, string>

function password(): string {
  return process.env[ALPHA_SOCIAL_PASSWORD_ENV] ?? ALPHA_SOCIAL_PASSWORD_DEFAULT
}

function daysFromNow(days: number, hour = 18): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(hour, 0, 0, 0)
  return d
}

type InventoryReport = {
  events: number
  organizations: number
  groups: number
  communityPlaces: number
  educationArticles: number
  vendorProfiles: number
  presenterProfiles: number
  eckeBatchEvents: number
  eckeBatchUsers: number
  existingAlphaSocialUsers: number
  sampleEventTitles: string[]
}

async function inventoryExistingData(): Promise<InventoryReport> {
  const [[{ events }], [{ organizations }], [{ groups }], [{ communityPlaces }], [{ educationArticles }], [{ vendorProfiles }], [{ presenterProfiles }]] =
    await Promise.all([
      db.select({ events: count() }).from(schema.events),
      db.select({ organizations: count() }).from(schema.organizations),
      db.select({ groups: count() }).from(schema.groups),
      db.select({ communityPlaces: count() }).from(schema.communityPlaces),
      db.select({ educationArticles: count() }).from(schema.educationArticles),
      db.select({ vendorProfiles: count() }).from(schema.vendorProfiles),
      db.select({ presenterProfiles: count() }).from(schema.presenterProfiles),
    ])

  let eckeBatchEvents = 0
  let eckeBatchUsers = 0
  const eckeBatchId = await getAlphaSeedBatchId(ALPHA_ECKE_BATCH_KEY)
  if (eckeBatchId) {
    const [{ eckeEvents }] = await db
      .select({ eckeEvents: count() })
      .from(schema.alphaSeedItems)
      .where(and(eq(schema.alphaSeedItems.batchId, eckeBatchId), eq(schema.alphaSeedItems.targetType, 'event')))
    const [{ eckeUsers }] = await db
      .select({ eckeUsers: count() })
      .from(schema.alphaSeedItems)
      .where(and(eq(schema.alphaSeedItems.batchId, eckeBatchId), eq(schema.alphaSeedItems.targetType, 'user')))
    eckeBatchEvents = Number(eckeEvents)
    eckeBatchUsers = Number(eckeUsers)
  }

  const [{ existingAlphaSocialUsers }] = await db
    .select({ existingAlphaSocialUsers: count() })
    .from(schema.users)
    .where(like(schema.users.username, 'alpha_%'))

  const upcoming = await db
    .select({ title: schema.events.title })
    .from(schema.events)
    .where(gte(schema.events.endsAt, new Date()))
    .orderBy(desc(schema.events.startsAt))
    .limit(8)

  return {
    events: Number(events),
    organizations: Number(organizations),
    groups: Number(groups),
    communityPlaces: Number(communityPlaces),
    educationArticles: Number(educationArticles),
    vendorProfiles: Number(vendorProfiles),
    presenterProfiles: Number(presenterProfiles),
    eckeBatchEvents,
    eckeBatchUsers,
    existingAlphaSocialUsers: Number(existingAlphaSocialUsers),
    sampleEventTitles: upcoming.map((r) => r.title),
  }
}

function printInventory(report: InventoryReport): void {
  console.log('')
  console.log('── Existing database inventory (read-only) ──')
  console.log(`  Events:              ${report.events}`)
  console.log(`  Organizations:       ${report.organizations}`)
  console.log(`  Groups:              ${report.groups}`)
  console.log(`  Community places:    ${report.communityPlaces}`)
  console.log(`  Education articles:  ${report.educationArticles}`)
  console.log(`  Vendor profiles:     ${report.vendorProfiles}`)
  console.log(`  Presenter profiles:  ${report.presenterProfiles}`)
  console.log(`  ECKE batch events:   ${report.eckeBatchEvents}`)
  console.log(`  ECKE batch users:    ${report.eckeBatchUsers}`)
  console.log(`  alpha_* users now:   ${report.existingAlphaSocialUsers}`)
  if (report.sampleEventTitles.length) {
    console.log('  Upcoming event sample:')
    for (const title of report.sampleEventTitles) console.log(`    · ${title}`)
  }
  console.log('')
  console.log('── Plan (non-destructive) ──')
  console.log('  WILL reuse: existing upcoming events for RSVPs (no event row updates)')
  console.log('  WILL NOT touch: ECKE imports, orgs, venues, education, vendor listings, or media')
  console.log('  WILL add: alpha_* users, social graph, feed, groups/forums, DMs, notifications')
  console.log('  WILL add: namespaced alpha-only events only when privacy scenarios need them')
  console.log('')
}

async function ensureAlphaUser(def: AlphaSocialUserDef, mark: MarkFn): Promise<string> {
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, def.username))
    .limit(1)

  if (existing) {
    await mark({
      targetType: 'user',
      targetId: existing.id,
      isSynthetic: true,
      sourceType: 'alpha_social_user',
      sourceSlug: def.username,
    })
    return existing.id
  }

  const hash = await bcrypt.hash(password(), 10)
  const [user] = await db
    .insert(schema.users)
    .values({
      username: def.username,
      email: alphaSocialEmail(def.username),
      passwordHash: hash,
    })
    .returning()
  if (!user) throw new Error(`Failed to create user ${def.username}`)

  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName: def.displayName,
    bio: def.sparse ? def.bio ?? '' : `${def.bio ?? ''}\n\n${alphaSocialMarker(`user:${def.username}`)}`.trim(),
    location: def.location,
    visibility: def.visibility ?? 'PUBLIC',
    discoverableInPeopleSearch: def.discoverable ?? true,
    roles: def.roles ?? [],
    trustScore: def.sparse ? 20 : 55,
    verified: def.roles?.includes('vendor') ?? false,
  })

  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: mergePrivacySettings(defaultPrivacySettings, def.privacyPatch ?? {}),
    notificationSettings: defaultNotificationSettings,
    feedSettings: mergeFeedSettings(defaultFeedSettings, def.feedPatch ?? {}),
  })

  await mark({
    targetType: 'user',
    targetId: user.id,
    isSynthetic: true,
    sourceType: 'alpha_social_user',
    sourceSlug: def.username,
  })
  return user.id
}

async function seedUsers(mark: MarkFn): Promise<UserMap> {
  const map: UserMap = new Map()
  for (const def of ALPHA_SOCIAL_USERS) {
    map.set(def.username, await ensureAlphaUser(def, mark))
  }
  console.log(`Alpha social: ${map.size} fictional users ready.`)
  return map
}

async function seedBlockRelationship(users: UserMap, mark: MarkFn): Promise<void> {
  const blockerId = users.get('alpha_blocker')
  const blockedId = users.get('alpha_blocked')
  if (!blockerId || !blockedId) return

  const [ex] = await db
    .select()
    .from(schema.blocks)
    .where(and(eq(schema.blocks.blockerId, blockerId), eq(schema.blocks.blockedId, blockedId)))
    .limit(1)
  if (ex) return

  const [row] = await db
    .insert(schema.blocks)
    .values({ blockerId, blockedId })
    .returning()
  if (row) await mark({ targetType: 'block', targetId: row.id, isSynthetic: true, sourceType: 'alpha_social_block' })
}

async function seedConnections(users: UserMap, mark: MarkFn): Promise<void> {
  let added = 0
  for (const edge of ALPHA_SOCIAL_CONNECTIONS) {
    const requesterId = users.get(edge.requester)
    const recipientId = users.get(edge.recipient)
    if (!requesterId || !recipientId) continue

    const [ex] = await db
      .select()
      .from(schema.connections)
      .where(and(eq(schema.connections.requesterId, requesterId), eq(schema.connections.recipientId, recipientId)))
      .limit(1)
    if (ex) continue

    const [row] = await db
      .insert(schema.connections)
      .values({ requesterId, recipientId, status: edge.status })
      .returning()
    if (!row) continue
    await mark({ targetType: 'connection', targetId: row.id, isSynthetic: true, sourceType: 'alpha_social_connection' })
    added++

    if (edge.status === 'ACCEPTED') {
      await insertFeedActivity({
        actorId: requesterId,
        verb: 'connection_accepted',
        objectType: 'connection',
        objectId: recipientId,
        metadata: { seed: ALPHA_SOCIAL_BATCH_KEY },
      })
    }
  }
  console.log(`Alpha social: ${added} new connection edges.`)
}

async function seedFollows(users: UserMap, mark: MarkFn): Promise<void> {
  let added = 0
  for (const edge of ALPHA_SOCIAL_FOLLOWS) {
    const followerId = users.get(edge.follower)
    const followingId = users.get(edge.following)
    if (!followerId || !followingId) continue

    const [ex] = await db
      .select()
      .from(schema.userFollows)
      .where(and(eq(schema.userFollows.followerId, followerId), eq(schema.userFollows.followingId, followingId)))
      .limit(1)
    if (ex) continue

    await db.insert(schema.userFollows).values({ followerId, followingId })
    await insertFeedActivity({
      actorId: followerId,
      verb: 'followed',
      objectType: 'user',
      objectId: followingId,
      metadata: { seed: ALPHA_SOCIAL_BATCH_KEY },
    })
    added++
  }
  console.log(`Alpha social: ${added} new follow edges.`)
}

async function ensureGroup(
  def: (typeof ALPHA_SOCIAL_GROUPS)[number],
  users: UserMap,
  mark: MarkFn,
): Promise<string> {
  const ownerId = users.get(def.ownerUsername)
  if (!ownerId) throw new Error(`Missing owner ${def.ownerUsername}`)

  const [ex] = await db.select().from(schema.groups).where(eq(schema.groups.slug, def.slug)).limit(1)
  if (ex) {
    await mark({
      targetType: 'group',
      targetId: ex.id,
      isSynthetic: true,
      sourceType: 'alpha_social_group',
      sourceSlug: def.slug,
    })
    return ex.id
  }

  const [group] = await db
    .insert(schema.groups)
    .values({
      slug: def.slug,
      name: def.name,
      description: `${def.description}\n\n${alphaSocialMarker(`group:${def.slug}`)}`,
      visibility: def.visibility,
      category: def.category,
      ownerId,
      tags: ['alpha-social', 'test'],
    })
    .returning()
  if (!group) throw new Error(`Failed to create group ${def.slug}`)

  await db.insert(schema.groupMembers).values({
    groupId: group.id,
    userId: ownerId,
    role: 'owner',
    memberListVisibility: 'visible',
    showGroupOnProfile: true,
    announceGroupJoinInFeed: def.slug === 'alpha-social-regional-hub',
  })

  await mark({
    targetType: 'group',
    targetId: group.id,
    isSynthetic: true,
    sourceType: 'alpha_social_group',
    sourceSlug: def.slug,
  })
  return group.id
}

async function seedGroups(users: UserMap, mark: MarkFn): Promise<GroupMap> {
  const map: GroupMap = new Map()
  for (const def of ALPHA_SOCIAL_GROUPS) {
    map.set(def.slug, await ensureGroup(def, users, mark))
  }

  const privateGroupId = map.get('alpha-social-private-circle')
  const hiddenMemberId = users.get('alpha_hidden_member')
  const modId = users.get('alpha_mod')
  if (privateGroupId && hiddenMemberId) {
    const [ex] = await db
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, privateGroupId), eq(schema.groupMembers.userId, hiddenMemberId)))
      .limit(1)
    if (!ex) {
      const [member] = await db
        .insert(schema.groupMembers)
        .values({
          groupId: privateGroupId,
          userId: hiddenMemberId,
          role: 'member',
          memberListVisibility: 'hidden',
          showGroupOnProfile: false,
          announceGroupJoinInFeed: false,
        })
        .returning()
      if (member) {
        await mark({ targetType: 'group_member', targetId: member.id, isSynthetic: true, sourceType: 'alpha_social_group_member' })
        await insertFeedActivity({
          actorId: hiddenMemberId,
          verb: 'group_join',
          objectType: 'group',
          objectId: privateGroupId,
          audienceType: 'connections',
          metadata: { seed: ALPHA_SOCIAL_BATCH_KEY, hiddenMembership: true },
        })
      }
    }
  }

  const publicGroupId = map.get('alpha-social-regional-hub')
  const socialId = users.get('alpha_social')
  const newbieId = users.get('alpha_newbie')
  for (const [uid, announce] of [
    [socialId, true],
    [newbieId, false],
  ] as const) {
    if (!publicGroupId || !uid) continue
    const [ex] = await db
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, publicGroupId), eq(schema.groupMembers.userId, uid)))
      .limit(1)
    if (ex) continue
    await db.insert(schema.groupMembers).values({
      groupId: publicGroupId,
      userId: uid,
      role: 'member',
      memberListVisibility: 'visible',
      showGroupOnProfile: true,
      announceGroupJoinInFeed: announce,
    })
  }

  const eduGroupId = map.get('alpha-social-education-guild')
  const educatorId = users.get('alpha_educator')
  const connectedId = users.get('alpha_connected')
  if (eduGroupId && educatorId && modId) {
    for (const uid of [educatorId, connectedId, modId].filter(Boolean) as string[]) {
      const [ex] = await db
        .select()
        .from(schema.groupMembers)
        .where(and(eq(schema.groupMembers.groupId, eduGroupId), eq(schema.groupMembers.userId, uid)))
        .limit(1)
      if (ex) continue
      await db.insert(schema.groupMembers).values({ groupId: eduGroupId, userId: uid, role: uid === educatorId ? 'owner' : 'member' })
    }
  }

  console.log(`Alpha social: ${map.size} groups ready.`)
  return map
}

async function seedForumThreads(users: UserMap, groups: GroupMap, mark: MarkFn): Promise<void> {
  let threads = 0
  for (const th of ALPHA_SOCIAL_FORUM_THREADS) {
    const groupId = groups.get(th.groupSlug)
    const authorId = users.get(th.authorUsername)
    if (!groupId || !authorId) continue

    let [cat] = await db
      .select()
      .from(schema.forumCategories)
      .where(eq(schema.forumCategories.groupId, groupId))
      .limit(1)
    if (!cat) {
      const [created] = await db
        .insert(schema.forumCategories)
        .values({ groupId, name: 'General', sortOrder: 0 })
        .returning()
      cat = created
    }
    if (!cat) continue

    const marker = alphaSocialMarker(`forum-thread:${th.key}`)
    const [exThread] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.groupId, groupId), like(schema.forumThreads.title, `%${th.key}%`)))
      .limit(1)
    if (exThread) continue

    const [thread] = await db
      .insert(schema.forumThreads)
      .values({
        groupId,
        categoryId: cat.id,
        title: `${th.title} ${marker}`,
        authorId,
        updatedAt: new Date(),
      })
      .returning()
    if (!thread) continue
    await mark({ targetType: 'forum_thread', targetId: thread.id, isSynthetic: true, sourceType: 'alpha_social_forum' })
    threads++

    for (const post of th.posts) {
      const postAuthorId = users.get(post.authorUsername)
      if (!postAuthorId) continue
      const [exPost] = await db
        .select()
        .from(schema.forumPosts)
        .where(like(schema.forumPosts.body, `%${alphaSocialMarker(post.bodyKey)}%`))
        .limit(1)
      if (exPost) continue
      const [row] = await db
        .insert(schema.forumPosts)
        .values({ threadId: thread.id, authorId: postAuthorId, body: post.body })
        .returning()
      if (row) await mark({ targetType: 'forum_post', targetId: row.id, isSynthetic: true, sourceType: 'alpha_social_forum' })
    }

    await insertFeedActivity({
      actorId: authorId,
      verb: 'group_thread_created',
      objectType: 'forum_thread',
      objectId: thread.id,
      audienceType: th.followingVisible ? 'followers' : 'connections',
      metadata: { seed: ALPHA_SOCIAL_BATCH_KEY, groupId },
    })
  }
  console.log(`Alpha social: ${threads} new forum threads.`)
}

async function loadReusableEvents(): Promise<{ id: string; title: string }[]> {
  const now = new Date()
  const rows = await db
    .select({ id: schema.events.id, title: schema.events.title })
    .from(schema.events)
    .where(gte(schema.events.endsAt, now))
    .orderBy(desc(schema.events.startsAt))
    .limit(6)

  const eckeBatchId = await getAlphaSeedBatchId(ALPHA_ECKE_BATCH_KEY)
  if (!eckeBatchId) return rows

  const eckeEventIds = await db
    .select({ targetId: schema.alphaSeedItems.targetId })
    .from(schema.alphaSeedItems)
    .where(and(eq(schema.alphaSeedItems.batchId, eckeBatchId), eq(schema.alphaSeedItems.targetType, 'event')))

  const eckeSet = new Set(eckeEventIds.map((r) => r.targetId))
  const eckeFirst = rows.filter((r) => eckeSet.has(r.id))
  const rest = rows.filter((r) => !eckeSet.has(r.id))
  return [...eckeFirst, ...rest].slice(0, 4)
}

async function seedAlphaOnlyEvents(users: UserMap, groups: GroupMap, mark: MarkFn): Promise<EventMap> {
  const map: EventMap = new Map()
  for (const def of ALPHA_SOCIAL_ONLY_EVENTS) {
    const hostId = users.get(def.hostUsername)
    if (!hostId) continue

    const marker = alphaSocialMarker(`event:${def.key}`)
    const [ex] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.title, def.title))
      .limit(1)

    if (ex) {
      map.set(def.key, ex.id)
      await mark({ targetType: 'event', targetId: ex.id, isSynthetic: true, sourceType: 'alpha_social_event', sourceSlug: def.key })
      continue
    }

    const startsAt = daysFromNow(def.key === 'event-online-class' ? 10 : 21)
    const endsAt = new Date(startsAt.getTime() + (def.eventFormat === 'virtual' ? 90 : 180) * 60 * 1000)
    const groupId = def.groupSlug ? groups.get(def.groupSlug) : undefined

    const [ev] = await db
      .insert(schema.events)
      .values({
        hostId,
        groupId,
        title: def.title,
        description: `Fictional alpha social seed event for privacy and RSVP testing.\n\n${marker}`,
        location: def.eventFormat === 'virtual' ? 'Online (fictional)' : 'Demo community center · fictional city',
        startsAt,
        endsAt,
        category: def.category,
        tags: ['alpha-social', 'test'],
        eventFormat: def.eventFormat,
        virtualSessionStyle: def.virtualSessionStyle,
        attendeeListVisibility: def.attendeeListVisibility,
        newcomerFriendly: true,
        visibility: 'public',
      })
      .returning()
    if (!ev) continue
    map.set(def.key, ev.id)
    await mark({ targetType: 'event', targetId: ev.id, isSynthetic: true, sourceType: 'alpha_social_event', sourceSlug: def.key })
    await insertFeedActivity({
      actorId: hostId,
      verb: 'event_created',
      objectType: 'event',
      objectId: ev.id,
      metadata: { seed: ALPHA_SOCIAL_BATCH_KEY },
    })
  }
  console.log(`Alpha social: ${map.size} namespaced alpha-only events.`)
  return map
}

async function seedRsvps(users: UserMap, eventMap: EventMap, reusable: { id: string; title: string }[], mark: MarkFn): Promise<void> {
  if (reusable[0]) eventMap.set('reuse-existing-0', reusable[0].id)
  if (reusable[1]) eventMap.set('reuse-existing-1', reusable[1].id)

  let added = 0
  const touched = new Set<string>()
  for (const rsvp of ALPHA_SOCIAL_RSVPS) {
    const eventId = eventMap.get(rsvp.eventKey)
    const userId = users.get(rsvp.username)
    if (!eventId || !userId) continue

    const [ex] = await db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, userId)))
      .limit(1)
    if (ex) continue

    await db.insert(schema.eventRsvps).values({ eventId, userId, status: rsvp.status })
    touched.add(eventId)
    added++

    if (rsvp.status === 'going' || rsvp.status === 'maybe') {
      await insertFeedActivity({
        actorId: userId,
        verb: 'event_rsvp',
        objectType: 'event',
        objectId: eventId,
        metadata: { seed: ALPHA_SOCIAL_BATCH_KEY, status: rsvp.status },
      })
    }
  }

  for (const eventId of touched) await refreshEventRsvpCount(eventId)
  console.log(`Alpha social: ${added} RSVPs (${reusable.length} existing events reused for RSVPs).`)
}

async function seedEventDiscussions(users: UserMap, eventMap: EventMap, mark: MarkFn): Promise<void> {
  const munchId = eventMap.get('event-regional-munch')
  const organizerId = users.get('alpha_organizer')
  const socialId = users.get('alpha_social')
  if (!munchId || !organizerId) return

  const marker = alphaSocialMarker('event-discussion-munch')
  const [ex] = await db
    .select()
    .from(schema.forumThreads)
    .where(and(eq(schema.forumThreads.eventId, munchId), like(schema.forumThreads.title, `%${marker}%`)))
    .limit(1)
  if (ex) return

  const [thread] = await db
    .insert(schema.forumThreads)
    .values({
      eventId: munchId,
      title: `Munch logistics Q&A ${marker}`,
      authorId: organizerId,
    })
    .returning()
  if (!thread) return
  await mark({ targetType: 'forum_thread', targetId: thread.id, isSynthetic: true, sourceType: 'alpha_social_event_forum' })

  const lines = [
    { authorId: organizerId, key: 'event-disc-1', body: 'Doors open 30 minutes early for name tags.' },
    { authorId: socialId, key: 'event-disc-2', body: 'Is there a vegetarian option at the venue?' },
    { authorId: organizerId, key: 'event-disc-3', body: 'Yes — please note dietary needs in your RSVP reply.' },
  ]
  for (const line of lines) {
    if (!line.authorId) continue
    await db.insert(schema.forumPosts).values({
      threadId: thread.id,
      authorId: line.authorId,
      body: `${alphaSocialMarker(line.key)} ${line.body}`,
    })
  }
}

async function seedFeedPosts(users: UserMap, mark: MarkFn): Promise<PostMap> {
  const map: PostMap = new Map()
  let added = 0

  for (const def of ALPHA_SOCIAL_POSTS) {
    const authorId = users.get(def.authorUsername)
    if (!authorId) continue

    const marker = alphaSocialMarker(def.key)
    const [ex] = await db
      .select()
      .from(schema.feedPosts)
      .where(like(schema.feedPosts.body, `%${marker}%`))
      .limit(1)
    if (ex) {
      map.set(def.key, ex.id)
      continue
    }

    let repostOfId: string | undefined
    if (def.kind === 'repost' && def.repostOfKey) {
      repostOfId = map.get(def.repostOfKey)
      if (!repostOfId) {
        const [src] = await db
          .select()
          .from(schema.feedPosts)
          .where(like(schema.feedPosts.body, `%${alphaSocialMarker(def.repostOfKey)}%`))
          .limit(1)
        repostOfId = src?.id
      }
    }

    const [post] = await db
      .insert(schema.feedPosts)
      .values({
        authorId,
        kind: def.kind ?? 'status',
        title: def.title,
        body: def.body,
        repostOfId,
      })
      .returning()
    if (!post) continue
    map.set(def.key, post.id)
    await mark({ targetType: 'feed_post', targetId: post.id, isSynthetic: true, sourceType: 'alpha_social_post', sourceSlug: def.key })
    await insertFeedActivity({
      actorId: authorId,
      verb: 'post',
      objectType: 'feed_post',
      objectId: post.id,
      metadata: { seed: ALPHA_SOCIAL_BATCH_KEY },
    })
    added++
  }

  console.log(`Alpha social: ${added} new feed posts.`)
  return map
}

async function seedCommentsAndReactions(users: UserMap, posts: PostMap, mark: MarkFn): Promise<void> {
  let comments = 0
  for (const def of ALPHA_SOCIAL_COMMENTS) {
    const postId = posts.get(def.postKey)
    const authorId = users.get(def.authorUsername)
    if (!postId || !authorId) continue
    const [ex] = await db
      .select()
      .from(schema.feedPostComments)
      .where(like(schema.feedPostComments.body, `%${alphaSocialMarker(def.key)}%`))
      .limit(1)
    if (ex) continue
    const [row] = await db
      .insert(schema.feedPostComments)
      .values({ postId, authorId, body: def.body })
      .returning()
    if (row) {
      await mark({ targetType: 'feed_post_comment', targetId: row.id, isSynthetic: true, sourceType: 'alpha_social_comment' })
      comments++
    }
  }

  let reactions = 0
  for (const def of ALPHA_SOCIAL_REACTIONS) {
    const postId = posts.get(def.postKey)
    const userId = users.get(def.username)
    if (!postId || !userId) continue
    const [ex] = await db
      .select()
      .from(schema.postLikes)
      .where(and(eq(schema.postLikes.postId, postId), eq(schema.postLikes.userId, userId)))
      .limit(1)
    if (ex) continue
    await db.insert(schema.postLikes).values({ postId, userId, kind: def.kind ?? 'love' })
    await insertFeedActivity({
      actorId: userId,
      verb: 'loved',
      objectType: 'feed_post',
      objectId: postId,
      metadata: { seed: ALPHA_SOCIAL_BATCH_KEY },
    })
    reactions++
  }
  console.log(`Alpha social: ${comments} comments, ${reactions} reactions.`)
}

async function findConversationByMarker(marker: string): Promise<string | undefined> {
  const [msg] = await db
    .select({ conversationId: schema.messages.conversationId })
    .from(schema.messages)
    .where(like(schema.messages.body, `%${marker}%`))
    .limit(1)
  return msg?.conversationId
}

async function seedMessaging(users: UserMap, mark: MarkFn): Promise<void> {
  let added = 0
  for (const def of ALPHA_SOCIAL_DMS) {
    const initiatorId = users.get(def.initiator)
    const partnerId = users.get(def.partner)
    if (!initiatorId || !partnerId) continue

    const firstMarker = alphaSocialMarker(def.messages[0]!.bodyKey)
    const existingConvoId = await findConversationByMarker(firstMarker)
    if (existingConvoId) continue

    const [convo] = await db
      .insert(schema.conversations)
      .values({ initiatorUserId: initiatorId })
      .returning()
    if (!convo) continue

    await db.insert(schema.conversationParticipants).values([
      { conversationId: convo.id, userId: initiatorId, acceptanceStatus: 'ACCEPTED' },
      {
        conversationId: convo.id,
        userId: partnerId,
        acceptanceStatus: def.acceptanceStatus,
      },
    ])

    for (const msg of def.messages) {
      const senderId = users.get(msg.sender)
      if (!senderId) continue
      const [row] = await db
        .insert(schema.messages)
        .values({ conversationId: convo.id, senderId, body: msg.body })
        .returning()
      if (row) await mark({ targetType: 'message', targetId: row.id, isSynthetic: true, sourceType: 'alpha_social_dm', sourceSlug: def.key })
    }

    await mark({ targetType: 'conversation', targetId: convo.id, isSynthetic: true, sourceType: 'alpha_social_dm', sourceSlug: def.key })
    added++
  }
  console.log(`Alpha social: ${added} DM conversations.`)
}

async function notificationExists(userId: string, type: string, seedKey: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.type, type),
        sql`${schema.notifications.payload}->>'seedKey' = ${seedKey}`,
      ),
    )
    .limit(1)
  return Boolean(row)
}

async function seedNotifications(users: UserMap, mark: MarkFn): Promise<void> {
  const organizerId = users.get('alpha_organizer')
  const socialId = users.get('alpha_social')
  const connectionsDmId = users.get('alpha_connections_dm')
  const newbieId = users.get('alpha_newbie')
  const quietId = users.get('alpha_quiet')

  const defs: { seedKey: string; userId?: string; type: string; payload: Record<string, unknown> }[] = [
    {
      seedKey: 'notif-connection-request',
      userId: organizerId,
      type: NOTIFICATION_TYPES.connectionRequest,
      payload: {
        seedKey: 'notif-connection-request',
        requesterId: newbieId,
        requesterUsername: 'alpha_newbie',
        requesterDisplayName: 'Casey (new member)',
      },
    },
    {
      seedKey: 'notif-connection-accepted',
      userId: socialId,
      type: NOTIFICATION_TYPES.connectionAccepted,
      payload: {
        seedKey: 'notif-connection-accepted',
        accepterId: organizerId,
        accepterUsername: 'alpha_organizer',
        accepterDisplayName: 'Jordan Rivers',
      },
    },
    {
      seedKey: 'notif-dm-request',
      userId: connectionsDmId,
      type: NOTIFICATION_TYPES.dmRequest,
      payload: {
        seedKey: 'notif-dm-request',
        conversationId: 'alpha-social-seed-pending',
        senderId: newbieId,
        senderUsername: 'alpha_newbie',
        senderDisplayName: 'Casey (new member)',
      },
    },
    {
      seedKey: 'notif-new-message',
      userId: users.get('alpha_open_dm'),
      type: NOTIFICATION_TYPES.newMessage,
      payload: {
        seedKey: 'notif-new-message',
        conversationId: 'alpha-social-seed-accepted',
        senderId: socialId,
        senderUsername: 'alpha_social',
        preview: 'Hey Quinn — are you going to the regional munch?',
      },
    },
    {
      seedKey: 'notif-message-request-quiet',
      userId: quietId,
      type: NOTIFICATION_TYPES.dmRequest,
      payload: {
        seedKey: 'notif-message-request-quiet',
        senderId: organizerId,
        senderUsername: 'alpha_organizer',
        senderDisplayName: 'Jordan Rivers',
      },
    },
  ]

  let added = 0
  for (const def of defs) {
    if (!def.userId) continue
    if (await notificationExists(def.userId, def.type, def.seedKey)) continue
    await createNotification(def.userId, def.type, def.payload)
    added++
  }
  console.log(`Alpha social: ${added} notifications.`)
}

async function seedMinimalOrgVendorPresenter(users: UserMap, mark: MarkFn): Promise<void> {
  const organizerId = users.get('alpha_organizer')
  const educatorId = users.get('alpha_educator')
  const vendorUserId = users.get('alpha_vendor')
  if (!organizerId || !educatorId || !vendorUserId) return

  const orgSlug = 'alpha-social-collective'
  let orgId: string
  const [exOrg] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, orgSlug)).limit(1)
  if (exOrg) {
    orgId = exOrg.id
  } else {
    const [org] = await db
      .insert(schema.organizations)
      .values({
        slug: orgSlug,
        displayName: 'Alpha Social Collective (test)',
        bio: `Fictional org for alpha social seed testing.\n\n${alphaSocialMarker('org:alpha-social-collective')}`,
        ownerId: organizerId,
        visibility: 'PUBLIC',
      })
      .returning()
    if (!org) return
    orgId = org.id
    await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: organizerId, role: 'OWNER' })
    await mark({ targetType: 'organization', targetId: org.id, isSynthetic: true, sourceType: 'alpha_social_org' })
  }

  const [exPresenter] = await db
    .select()
    .from(schema.presenterProfiles)
    .where(eq(schema.presenterProfiles.userId, educatorId))
    .limit(1)
  if (!exPresenter) {
    await db.insert(schema.presenterProfiles).values({
      userId: educatorId,
      headline: 'Negotiation & facilitation (alpha test)',
      bioShort: 'Fictional presenter profile for alpha social seed.',
      bio: `${alphaSocialMarker('presenter:alpha_educator')} Community educator demo profile.`,
      directoryVisibility: 'PUBLIC',
      expertiseTags: ['negotiation', 'boundaries'],
    })
    await mark({ targetType: 'presenter_profile', targetId: educatorId, isSynthetic: true, sourceType: 'alpha_social_presenter' })
  }

  const vendorSlug = 'alpha-social-gear-co'
  const [exVendor] = await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.slug, vendorSlug)).limit(1)
  if (!exVendor) {
    const taxonomy = resolveVendorCategoryTags({ categories: ['gear', 'accessories'] })
    const [vp] = await db
      .insert(schema.vendorProfiles)
      .values({
        userId: vendorUserId,
        slug: vendorSlug,
        displayName: 'Alpha Social Gear Co. (test)',
        bio: `${alphaSocialMarker('vendor:alpha-social-gear-co')} Fictional vendor for alpha UI tests.`,
        category: taxonomy.category,
        tags: taxonomy.tags,
        categories: taxonomy.categories,
        website: 'https://example.test/alpha-social-gear',
        verified: false,
      })
      .returning()
    if (vp) {
      await mark({ targetType: 'vendor_profile', targetId: vp.id, isSynthetic: true, sourceType: 'alpha_social_vendor' })
      await db.insert(schema.products).values({
        vendorId: vp.id,
        title: 'Demo tote bag (alpha test)',
        priceCents: 1500,
        primaryImageUrl: 'https://picsum.photos/seed/alpha-social-tote/400/400',
        listingUrl: vp.website?.trim() || 'https://example.com/demo-tote',
      })
    }
  }

  const orgEventTitle = 'Alpha Social Seed — Org Munch (test)'
  const [exOrgEvent] = await db.select().from(schema.events).where(eq(schema.events.title, orgEventTitle)).limit(1)
  if (!exOrgEvent) {
    const startsAt = daysFromNow(28)
    const [ev] = await db
      .insert(schema.events)
      .values({
        hostId: organizerId,
        organizationId: orgId,
        title: orgEventTitle,
        description: `Org-linked fictional munch for alpha testing.\n\n${alphaSocialMarker('event:org-munch')}`,
        location: 'Fictional community hall',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
        category: 'Munch',
        tags: ['alpha-social', 'org'],
        eventFormat: 'in-person',
        attendeeListVisibility: 'public',
      })
      .returning()
    if (ev) {
      await mark({ targetType: 'event', targetId: ev.id, isSynthetic: true, sourceType: 'alpha_social_org_event' })
      await insertFeedActivity({
        actorId: organizerId,
        verb: 'event_created',
        objectType: 'event',
        objectId: ev.id,
        metadata: { seed: ALPHA_SOCIAL_BATCH_KEY, organizationId: orgId },
      })
    }
  }
}

async function main(): Promise<void> {
  assertAlphaSocialSeedAllowed()

  const inventory = await inventoryExistingData()
  printInventory(inventory)

  const batch = await ensureAlphaSeedBatch({
    batchKey: ALPHA_SOCIAL_BATCH_KEY,
    sourceName: 'Alpha social fictional test world',
    sourceUrl: 'https://example.test/alpha-social-seed',
    notes: 'Non-destructive social wrapper around existing ECKE/event data.',
  })
  const mark = createAlphaSeedMarker(batch.id)
  console.log(`Alpha social batch ${batch.batchKey} (${batch.id})`)

  const users = await seedUsers(mark)
  await seedBlockRelationship(users, mark)
  await seedConnections(users, mark)
  await seedFollows(users, mark)
  const groups = await seedGroups(users, mark)
  await seedForumThreads(users, groups, mark)

  const reusableEvents = await loadReusableEvents()
  if (reusableEvents.length) {
    console.log('Alpha social: reusing existing events (read-only):')
    for (const ev of reusableEvents) console.log(`  · ${ev.title}`)
  } else {
    console.log('Alpha social: no upcoming existing events found — RSVPs will use alpha-only events.')
  }

  const eventMap = await seedAlphaOnlyEvents(users, groups, mark)
  await seedRsvps(users, eventMap, reusableEvents, mark)
  await seedEventDiscussions(users, eventMap, mark)

  const posts = await seedFeedPosts(users, mark)
  await seedCommentsAndReactions(users, posts, mark)
  await seedMessaging(users, mark)
  await seedNotifications(users, mark)
  await seedMinimalOrgVendorPresenter(users, mark)

  console.log('')
  console.log('Alpha social seed complete.')
  console.log(`Login password (all alpha_* users): ${password()}`)
  console.log('Suggested login: alpha_social / alpha_organizer / alpha_newbie')
  console.log('Existing ECKE and event data was not modified except new alpha RSVPs on existing events.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
