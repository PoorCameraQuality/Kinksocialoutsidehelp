import { APP_NAME } from '@c2k/shared'
import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { mailTransportMode, sendEmail } from './mailer.js'
import { getUserEmailById } from './user-email.js'

/**
 * Weekly email digest for users who pinned conventions (O77).
 * Respects `user_notification_preferences.pinned_digest_email_weekly`.
 */
export async function runPinnedDigestSweep(): Promise<{
  usersEligible: number
  emailsSent: number
}> {
  const pins = await db
    .select({
      userId: schema.conventionPins.userId,
      conventionId: schema.conventionPins.conventionId,
      pinnedAt: schema.conventionPins.pinnedAt,
    })
    .from(schema.conventionPins)
    .orderBy(desc(schema.conventionPins.pinnedAt))

  const byUser = new Map<string, string[]>()
  for (const p of pins) {
    const list = byUser.get(p.userId) ?? []
    if (!list.includes(p.conventionId)) list.push(p.conventionId)
    byUser.set(p.userId, list)
  }

  if (byUser.size === 0) return { usersEligible: 0, emailsSent: 0 }

  const userIds = [...byUser.keys()]
  const prefs = await db
    .select()
    .from(schema.userNotificationPreferences)
    .where(inArray(schema.userNotificationPreferences.userId, userIds))
  const optedOut = new Set(
    prefs.filter((p) => p.pinnedDigestEmailWeekly === false).map((p) => p.userId),
  )
  const eligible = userIds.filter((u) => !optedOut.has(u))
  if (eligible.length === 0) return { usersEligible: 0, emailsSent: 0 }

  const allConvIds = [...new Set(pins.map((p) => p.conventionId))]
  const convRows = await db
    .select({ id: schema.conventions.id, name: schema.conventions.name, slug: schema.conventions.slug })
    .from(schema.conventions)
    .where(inArray(schema.conventions.id, allConvIds))
  const convMap = new Map(convRows.map((c) => [c.id, c]))

  const mode = mailTransportMode()
  if (mode === 'disabled') {
    console.log('[pinned-digest-sweep] mail disabled; eligible users:', eligible.length)
    return { usersEligible: eligible.length, emailsSent: 0 }
  }

  const publicWeb = process.env.C2K_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:5173'
  let emailsSent = 0

  for (const uid of eligible) {
    const recipient = await getUserEmailById(uid)
    if (!recipient) continue
    const convIds = byUser.get(uid) ?? []
    const lines = convIds
      .map((id) => {
        const c = convMap.get(id)
        return c ? `- ${c.name}: ${publicWeb}/conventions/${c.slug}` : null
      })
      .filter(Boolean) as string[]
    if (lines.length === 0) continue
    const r = await sendEmail({
      to: recipient,
      subject: `Your pinned conventions (${APP_NAME})`,
      text: `Hi,\n\nUpdates for conventions you pinned:\n\n${lines.join('\n')}\n\nManage pins: ${publicWeb}/home?tab=Conventions\n`,
      html: `<p>Hi,</p><p>Conventions you pinned:</p><ul>${lines.map((l) => `<li>${l.replace(/^- /, '')}</li>`).join('')}</ul><p><a href="${publicWeb}/home?tab=Conventions">View pinned conventions</a></p>`,
    })
    if (r.ok) emailsSent += 1
  }

  return { usersEligible: eligible.length, emailsSent }
}
