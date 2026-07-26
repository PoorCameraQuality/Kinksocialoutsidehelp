/**
 * Remove alpha-ecke-demo and alpha-social-seed batches plus live audit / legacy demo users.
 *
 * Run (local):
 *   ALLOW_ALPHA_PROD_CLEANUP=true USE_DATABASE=true npm run db:clear:alpha:prod -w @c2k/api
 *
 * Dry run:
 *   DRY_RUN=true ALLOW_ALPHA_PROD_CLEANUP=true USE_DATABASE=true npm run db:clear:alpha:prod -w @c2k/api
 */
import { and, eq, inArray, like, or, sql } from 'drizzle-orm'
import './load-dev-env.js'
import {
  ALPHA_ECKE_BATCH_KEY,
  ALPHA_SOCIAL_BATCH_KEY,
  getAlphaSeedBatchId,
  listAlphaSeedTargetIds,
} from '../lib/alpha-seed-labels.js'
import { isAlphaSocialEmail, isAlphaSocialUsername } from '../lib/alpha-social-seed-catalog.js'
import { db, schema } from './index.js'

const PROTECTED_USERNAMES = new Set(['Brax'])
const LEGACY_DEMO_USERNAMES = new Set([
  'RopeDreamer',
  'LeatherCraftDemo',
  'ShutterSeed',
  'TrustedRoleApplicantDemo',
  'TestAdmin',
])

function dryRun(): boolean {
  return process.env.DRY_RUN === 'true'
}

function assertProdCleanupAllowed(): void {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true')
    process.exit(1)
  }
  if (process.env.ALLOW_ALPHA_PROD_CLEANUP !== 'true') {
    console.error('Set ALLOW_ALPHA_PROD_CLEANUP=true to run production test-data cleanup.')
    process.exit(1)
  }
  if (process.env.FORCE_ALPHA_PROD_CLEANUP !== 'true') {
    console.error('Set FORCE_ALPHA_PROD_CLEANUP=true to confirm intentional prod cleanup.')
    process.exit(1)
  }
}

type IdTable =
  | typeof schema.users
  | typeof schema.feedPostComments
  | typeof schema.messages
  | typeof schema.forumPosts
  | typeof schema.forumThreads
  | typeof schema.conventionHubChannelMessages
  | typeof schema.conventionHubChannels
  | typeof schema.scheduleSlots
  | typeof schema.blocks
  | typeof schema.connections
  | typeof schema.groupMembers
  | typeof schema.groups
  | typeof schema.products
  | typeof schema.vendorProfiles
  | typeof schema.communityPlaces
  | typeof schema.conventions
  | typeof schema.educationArticles
  | typeof schema.organizations
  | typeof schema.conversations

async function deleteByIds(label: string, table: IdTable, ids: string[]) {
  if (!ids.length) return 0
  if (dryRun()) {
    console.log(`[dry-run] Would remove ${ids.length} ${label}`)
    return ids.length
  }
  await db.delete(table).where(inArray(table.id, ids))
  console.log(`Removed ${ids.length} ${label}`)
  return ids.length
}

export async function clearAlphaSeedBatch(
  batchKey: string,
  opts: { deleteAllMarkedUsers?: boolean } = {},
) {
  const batchId = await getAlphaSeedBatchId(batchKey)
  if (!batchId) {
    console.log(`No alpha seed batch "${batchKey}" found.`)
    return
  }

  const byType = async (targetType: string) => listAlphaSeedTargetIds(batchId, targetType)

  const feedPostCommentIds = await byType('feed_post_comment')
  const messageIds = await byType('message')
  const forumPostIds = await byType('forum_post')
  const forumThreadIds = await byType('forum_thread')
  const hubMessageIds = await byType('convention_hub_message')
  const hubChannelIds = await byType('convention_hub_channel')
  const scheduleSlotIds = await byType('schedule_slot')
  const feedPostIds = await byType('feed_post')
  const productIds = await byType('product')
  const vendorProfileIds = await byType('vendor_profile')
  const presenterProfileIds = await byType('presenter_profile')
  const communityPlaceIds = await byType('community_place')
  const eventIds = await byType('event')
  const conventionIds = await byType('convention')
  const organizationIds = await byType('organization')
  const educationSeriesIds = await byType('education_article_series')
  const educationArticleIds = await byType('education_article')
  const groupMemberIds = await byType('group_member')
  const blockIds = await byType('block')
  const connectionIds = await byType('connection')
  const groupIds = await byType('group')
  const conversationIds = await byType('conversation')
  const userIds = await byType('user')

  await deleteByIds('feed post comments', schema.feedPostComments, feedPostCommentIds)
  await deleteByIds('messages', schema.messages, messageIds)
  await deleteByIds('forum posts', schema.forumPosts, forumPostIds)
  await deleteByIds('forum threads', schema.forumThreads, forumThreadIds)
  await deleteByIds('hub messages', schema.conventionHubChannelMessages, hubMessageIds)
  await deleteByIds('hub channels', schema.conventionHubChannels, hubChannelIds)
  await deleteByIds('schedule slots', schema.scheduleSlots, scheduleSlotIds)

  if (feedPostIds.length) {
    if (dryRun()) {
      console.log(`[dry-run] Would remove ${feedPostIds.length} feed posts (+ activities)`)
    } else {
      await db.delete(schema.feedActivities).where(
        and(
          eq(schema.feedActivities.objectType, 'feed_post'),
          inArray(schema.feedActivities.objectId, feedPostIds),
        ),
      )
      await db.delete(schema.feedPosts).where(inArray(schema.feedPosts.id, feedPostIds))
      console.log(`Removed ${feedPostIds.length} feed posts`)
    }
  }

  await deleteByIds('blocks', schema.blocks, blockIds)
  await deleteByIds('connections', schema.connections, connectionIds)
  await deleteByIds('group members', schema.groupMembers, groupMemberIds)
  await deleteByIds('groups', schema.groups, groupIds)

  if (eventIds.length) {
    if (dryRun()) {
      console.log(`[dry-run] Would remove ${eventIds.length} events (+ RSVPs)`)
    } else {
      await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, eventIds))
      await db.delete(schema.events).where(inArray(schema.events.id, eventIds))
      console.log(`Removed ${eventIds.length} events`)
    }
  }

  await deleteByIds('products', schema.products, productIds)
  await deleteByIds('vendor profiles', schema.vendorProfiles, vendorProfileIds)
  if (presenterProfileIds.length) {
    if (dryRun()) {
      console.log(`[dry-run] Would remove ${presenterProfileIds.length} presenter profiles`)
    } else {
      await db
        .delete(schema.presenterProfiles)
        .where(inArray(schema.presenterProfiles.userId, presenterProfileIds))
      console.log(`Removed ${presenterProfileIds.length} presenter profiles`)
    }
  }
  await deleteByIds('community places', schema.communityPlaces, communityPlaceIds)
  await deleteByIds('conventions', schema.conventions, conventionIds)

  if (educationSeriesIds.length) {
    if (dryRun()) {
      console.log(`[dry-run] Would remove ${educationSeriesIds.length} education series`)
    } else {
      await db
        .delete(schema.educationArticleSeriesItems)
        .where(inArray(schema.educationArticleSeriesItems.seriesId, educationSeriesIds))
      await db.delete(schema.educationArticleSeries).where(inArray(schema.educationArticleSeries.id, educationSeriesIds))
      console.log(`Removed ${educationSeriesIds.length} education series`)
    }
  }

  await deleteByIds('education articles', schema.educationArticles, educationArticleIds)
  await deleteByIds('organizations', schema.organizations, organizationIds)
  await deleteByIds('conversations', schema.conversations, conversationIds)

  if (userIds.length) {
    const seedUsers = await db
      .select({ id: schema.users.id, username: schema.users.username, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds))
    const deletable = seedUsers
      .filter((u) => !PROTECTED_USERNAMES.has(u.username))
      .filter((u) => {
        if (opts.deleteAllMarkedUsers) return true
        const email = u.email ?? ''
        return email.endsWith('@ecke-seed.local') || email.endsWith('@ecke-vendor.local')
      })
      .map((u) => u.id)
    await deleteByIds('batch-marked users', schema.users, deletable)
  }

  if (dryRun()) {
    console.log(`[dry-run] Would clear alpha seed registry for "${batchKey}"`)
  } else {
    await db.delete(schema.alphaSeedItems).where(eq(schema.alphaSeedItems.batchId, batchId))
    await db.delete(schema.alphaSeedBatches).where(eq(schema.alphaSeedBatches.id, batchId))
    console.log(`Cleared alpha seed registry for "${batchKey}"`)
  }
}

export function isDeletableSeedUser(u: { username: string; email: string | null }): boolean {
  if (PROTECTED_USERNAMES.has(u.username)) return false
  if (u.username.startsWith('AlphaQATest')) return true
  if (isAlphaSocialUsername(u.username)) return true
  if (LEGACY_DEMO_USERNAMES.has(u.username)) return true
  if (u.username.startsWith('shop-')) return true
  const email = u.email ?? ''
  if (email.endsWith('@ecke-seed.local') || email.endsWith('@ecke-vendor.local')) return true
  if (email.endsWith('@demo.local')) return true
  if (isAlphaSocialEmail(email)) return true
  return false
}

async function clearAlphaQaArtifacts() {
  const qaRows = async (
    label: string,
    table:
      | typeof schema.vendorProfiles
      | typeof schema.educationArticles
      | typeof schema.feedPosts
      | typeof schema.events
      | typeof schema.groups
      | typeof schema.organizations
      | typeof schema.conventions,
    filter: ReturnType<typeof or> | ReturnType<typeof like>,
  ) => {
    const rows = await db.select({ id: table.id }).from(table).where(filter)
    if (!rows.length) return
    if (dryRun()) {
      console.log(`[dry-run] Would remove ${rows.length} ${label}`)
      return
    }
    await db.delete(table).where(
      inArray(
        table.id,
        rows.map((r) => r.id),
      ),
    )
    console.log(`Removed ${rows.length} ${label}`)
  }

  await qaRows(
    'QA vendor profiles',
    schema.vendorProfiles,
    like(schema.vendorProfiles.slug, 'alpha-qa-test%'),
  )
  await qaRows(
    'QA education articles',
    schema.educationArticles,
    like(schema.educationArticles.title, 'ALPHA QA TEST%'),
  )
  await qaRows(
    'QA feed posts',
    schema.feedPosts,
    or(
      like(schema.feedPosts.body, 'ALPHA QA TEST%'),
      like(schema.feedPosts.body, '%[alpha_social_seed:%'),
      like(schema.feedPosts.body, 'e2e-%'),
    ),
  )
  await qaRows('QA events', schema.events, like(schema.events.title, 'ALPHA QA TEST%'))
  await qaRows(
    'QA groups',
    schema.groups,
    or(like(schema.groups.slug, 'alpha-qa-test%'), like(schema.groups.name, 'ALPHA QA TEST%')),
  )
  await qaRows(
    'QA organizations',
    schema.organizations,
    or(
      like(schema.organizations.slug, 'alpha-qa-test%'),
      like(schema.organizations.displayName, 'ALPHA QA TEST%'),
    ),
  )
  await qaRows('QA conventions', schema.conventions, like(schema.conventions.slug, 'alpha-qa-test%'))
}

async function deleteOwnedContentForUsers(userIds: string[]) {
  if (!userIds.length) return
  if (dryRun()) {
    console.log(`[dry-run] Would remove owned content for ${userIds.length} users`)
    return
  }

  const hostedEvents = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(inArray(schema.events.hostId, userIds))
  const hostedEventIds = hostedEvents.map((e) => e.id)
  if (hostedEventIds.length) {
    await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, hostedEventIds))
    await db.delete(schema.events).where(inArray(schema.events.id, hostedEventIds))
  }

  const authoredPosts = await db
    .select({ id: schema.feedPosts.id })
    .from(schema.feedPosts)
    .where(inArray(schema.feedPosts.authorId, userIds))
  const postIds = authoredPosts.map((p) => p.id)
  if (postIds.length) {
    await db.delete(schema.feedActivities).where(
      and(eq(schema.feedActivities.objectType, 'feed_post'), inArray(schema.feedActivities.objectId, postIds)),
    )
    await db.delete(schema.feedPosts).where(inArray(schema.feedPosts.id, postIds))
  }

  await db.delete(schema.vendorProfiles).where(inArray(schema.vendorProfiles.userId, userIds))
  await db.delete(schema.presenterProfiles).where(inArray(schema.presenterProfiles.userId, userIds))
  await db.delete(schema.groups).where(inArray(schema.groups.ownerId, userIds))
  await db.delete(schema.organizations).where(inArray(schema.organizations.ownerId, userIds))
  await db.delete(schema.forumPosts).where(inArray(schema.forumPosts.authorId, userIds))
  await db.delete(schema.forumThreads).where(inArray(schema.forumThreads.authorId, userIds))
  await db
    .delete(schema.orgChannelMessageReplies)
    .where(inArray(schema.orgChannelMessageReplies.senderId, userIds))
  await db.delete(schema.orgChannelMessages).where(inArray(schema.orgChannelMessages.senderId, userIds))
  await db.delete(schema.messages).where(inArray(schema.messages.senderId, userIds))
  await db.delete(schema.educationArticles).where(inArray(schema.educationArticles.authorUserId, userIds))
  console.log(`Removed owned content for ${userIds.length} seed users`)
}

async function deleteRemainingSeedUsers() {
  const allUsers = await db
    .select({ id: schema.users.id, username: schema.users.username, email: schema.users.email })
    .from(schema.users)
  const deletable = allUsers.filter(isDeletableSeedUser).map((u) => u.id)
  await deleteOwnedContentForUsers(deletable)
  await deleteByIds('remaining seed/demo users', schema.users, deletable)
}

async function printSummary() {
  const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.users)
  const remaining = await db
    .select({ username: schema.users.username, email: schema.users.email })
    .from(schema.users)
    .orderBy(schema.users.username)
  console.log(`\nUsers remaining: ${total}`)
  for (const u of remaining) {
    console.log(`  - ${u.username}${u.email ? ` (${u.email})` : ''}`)
  }
}

export async function clearAlphaProdTestData() {
  console.log(dryRun() ? '=== DRY RUN ===' : '=== LIVE CLEANUP ===')
  await clearAlphaSeedBatch(ALPHA_SOCIAL_BATCH_KEY, { deleteAllMarkedUsers: true })
  await clearAlphaSeedBatch(ALPHA_ECKE_BATCH_KEY, { deleteAllMarkedUsers: false })
  await clearAlphaQaArtifacts()
  await deleteRemainingSeedUsers()
  await printSummary()
}

async function main() {
  assertProdCleanupAllowed()
  await clearAlphaProdTestData()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
