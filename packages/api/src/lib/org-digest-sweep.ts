import { APP_NAME } from '@c2k/shared'
import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { mailTransportMode, sendEmail } from './mailer.js'
import { getUserEmailById } from './user-email.js'

/**
 * Weekly org activity digest. Respects `user_notification_preferences.org_digest_email_weekly`.
 * Sends email when `C2K_MAIL_TRANSPORT` is `smtp` or `resend`; otherwise logs only.
 */
export async function runOrgDigestSweep(): Promise<{
  orgsConsidered: number
  usersEligible: number
  emailsSent: number
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentOrgs = await db
    .selectDistinct({ id: schema.organizations.id })
    .from(schema.organizations)
    .innerJoin(schema.events, eq(schema.events.organizationId, schema.organizations.id))
    .where(gte(schema.events.createdAt, weekAgo))
  const orgIds = recentOrgs.map((r) => r.id)
  if (orgIds.length === 0) {
    return { orgsConsidered: 0, usersEligible: 0, emailsSent: 0 }
  }
  const members = await db
    .select({ userId: schema.organizationMembers.userId })
    .from(schema.organizationMembers)
    .where(
      and(
        inArray(schema.organizationMembers.organizationId, orgIds),
        inArray(schema.organizationMembers.role, ['STAFF', 'MODERATOR', 'ADMIN', 'OWNER'])
      )
    )
  const userIds = [...new Set(members.map((m) => m.userId))]
  if (userIds.length === 0) {
    return { orgsConsidered: orgIds.length, usersEligible: 0, emailsSent: 0 }
  }
  const prefs = await db
    .select()
    .from(schema.userNotificationPreferences)
    .where(inArray(schema.userNotificationPreferences.userId, userIds))
  const optedOut = new Set(
    prefs.filter((p) => p.orgDigestEmailWeekly === false).map((p) => p.userId)
  )
  const eligible = userIds.filter((u) => !optedOut.has(u))
  if (eligible.length === 0) {
    return { orgsConsidered: orgIds.length, usersEligible: 0, emailsSent: 0 }
  }

  const orgMeta = await db
    .select({ id: schema.organizations.id, displayName: schema.organizations.displayName })
    .from(schema.organizations)
    .where(inArray(schema.organizations.id, orgIds))
    .orderBy(asc(schema.organizations.displayName))

  const mode = mailTransportMode()
  if (mode === 'disabled') {
    console.log(
      '[org-digest-sweep] mail disabled (set C2K_MAIL_TRANSPORT=smtp|resend); eligible staff:',
      eligible.length,
      'orgs:',
      orgIds.length
    )
    return { orgsConsidered: orgIds.length, usersEligible: eligible.length, emailsSent: 0 }
  }

  const publicWeb = process.env.C2K_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:5173'
  const settingsUrl = `${publicWeb}/settings`

  const orgLines = orgMeta.map((o) => `- ${o.displayName}`).join('\n')
  const orgHtml = orgMeta.map((o) => `<li>${escHtml(o.displayName)}</li>`).join('')

  let emailsSent = 0
  for (const uid of eligible) {
    const recipient = await getUserEmailById(uid)
    if (!recipient) continue
    const r = await sendEmail({
      to: recipient,
      subject: `Weekly org activity digest (${APP_NAME})`,
      text: `Hi,\n\nOrganizations with recent calendar activity in the last 7 days:\n\n${orgLines}\n\nManage notification preferences: ${settingsUrl}\n`,
      html: `<p>Hi,</p><p>Organizations with recent calendar activity in the last 7 days:</p><ul>${orgHtml}</ul><p><a href="${settingsUrl}">Notification settings</a></p>`,
      headers: {
        'List-Unsubscribe': `<${settingsUrl}>`,
      },
    })
    if (r.ok) emailsSent += 1
    else console.warn('[org-digest-sweep] send failed', uid, r.error)
  }

  console.log('[org-digest-sweep] sent', emailsSent, 'of', eligible.length, 'eligible; orgs', orgIds.length)
  return { orgsConsidered: orgIds.length, usersEligible: eligible.length, emailsSent }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
