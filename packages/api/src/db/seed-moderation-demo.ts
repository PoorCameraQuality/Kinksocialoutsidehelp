/**
 * Demo moderation rows for local QA - open reports, scoped org inbox, pending platform action.
 */
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from './index.js'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'

export async function seedModerationDemo(braxId: string, ropeId: string): Promise<void> {
  await db
    .insert(schema.platformStaff)
    .values({ userId: braxId, role: 'SITE_ADMIN' })
    .onConflictDoUpdate({ target: schema.platformStaff.userId, set: { role: 'SITE_ADMIN' } })

  await db
    .insert(schema.platformStaff)
    .values({ userId: ropeId, role: 'MODERATOR' })
    .onConflictDoUpdate({ target: schema.platformStaff.userId, set: { role: 'MODERATOR' } })

  const [org] = await db
    .select({ id: schema.organizations.id, slug: schema.organizations.slug })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) {
    console.log('Moderation demo: no demo-east-collective org; skip sample reports.')
    return
  }

  const [forumPost] = await db
    .select({ id: schema.forumPosts.id })
    .from(schema.forumPosts)
    .innerJoin(schema.forumThreads, eq(schema.forumPosts.threadId, schema.forumThreads.id))
    .where(eq(schema.forumThreads.organizationId, org.id))
    .orderBy(asc(schema.forumPosts.createdAt))
    .limit(1)

  const [leather] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, 'LeatherCraftDemo'))
    .limit(1)

  const reporterId = leather?.id ?? ropeId

  const existingOrgReport = await db
    .select({ id: schema.reports.id })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.scopeType, 'organization'),
        eq(schema.reports.scopeId, org.id),
        eq(schema.reports.body, 'demo-moderation-org-forum-report')
      )
    )
    .limit(1)

  let orgReportId = existingOrgReport[0]?.id
  if (!orgReportId && forumPost) {
    const [row] = await db
      .insert(schema.reports)
      .values({
        reporterId,
        targetType: 'org_forum_post',
        targetId: forumPost.id,
        scopeType: 'organization',
        scopeId: org.id,
        category: 'harassment',
        body: 'demo-moderation-org-forum-report',
        status: 'OPEN',
        meta: { demo: true },
      })
      .returning({ id: schema.reports.id })
    orgReportId = row?.id
  }

  const [existingPlatform] = await db
    .select({ id: schema.reports.id })
    .from(schema.reports)
    .where(eq(schema.reports.body, 'demo-moderation-platform-escalation'))
    .limit(1)

  let platformReportId = existingPlatform?.id
  if (!platformReportId) {
    const [row] = await db
      .insert(schema.reports)
      .values({
        reporterId,
        targetType: 'platform_organization',
        targetId: org.id,
        scopeType: 'organization',
        scopeId: org.id,
        category: 'other',
        body: 'demo-moderation-platform-escalation',
        status: 'OPEN',
        meta: { escalated: true, demo: true },
      })
      .returning({ id: schema.reports.id })
    platformReportId = row?.id
  }

  const existingAction = await db
    .select({ id: schema.moderationActions.id })
    .from(schema.moderationActions)
    .where(eq(schema.moderationActions.actionType, 'RESOLVE_REPORT'))
    .limit(1)

  if (existingAction.length === 0) {
    const [action] = await db
      .insert(schema.moderationActions)
      .values({
        actionType: 'RESOLVE_REPORT',
        targetType: 'report',
        targetId: platformReportId ?? orgReportId ?? org.id,
        status: 'PENDING_APPROVAL',
        proposedByUserId: ropeId,
        requiredApprovals: 2,
        reportId: platformReportId ?? orgReportId ?? null,
        payload: { note: 'Demo: resolve after review', demo: true },
      })
      .returning({ id: schema.moderationActions.id })

    if (action) {
      await db.insert(schema.moderationAuditEvents).values({
        actorUserId: ropeId,
        scopeType: 'platform',
        scopeId: null,
        verb: MODERATION_AUDIT_VERBS.actionProposed,
        targetType: 'moderation_action',
        targetId: action.id,
        payload: { demo: true },
      })
    }
  }

  console.log('Moderation demo seed:')
  console.log(`  Org hub: http://127.0.0.1:5173/orgs/${org.slug}`)
  console.log(`  Org moderation: http://127.0.0.1:5173/organizer/orgs/${org.slug}?tab=moderation`)
  console.log('  Platform dashboard: http://127.0.0.1:5173/moderation/reports')
  console.log('  Actions queue: http://127.0.0.1:5173/moderation/actions')
  console.log('  Admin (Brax): http://127.0.0.1:5173/moderation/admin')
  console.log(`  Login Brax: brax@coast2coast.kink / Airship!2 (id ${braxId})`)
  console.log(`  Login RopeDreamer: demo password (MODERATOR, id ${ropeId})`)

  const { seedModerationTsFixtures } = await import('./seed-moderation-ts-fixtures.js')
  await seedModerationTsFixtures()
}
