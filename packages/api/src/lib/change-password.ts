import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { sendEmail } from './mailer.js'
import { buildPasswordChangedEmail } from './password-reset.js'
import { getEmailFromUserRow } from './user-email.js'

export type ChangePasswordResult =
  | { ok: true; sessionVersion: number }
  | { ok: false; status: 400 | 401 | 404; error: string }

export async function changePasswordForUser(input: {
  userId: string
  currentPassword: string
  newPassword: string
  log: { warn: (obj: object, msg?: string) => void; info?: (obj: object, msg?: string) => void }
}): Promise<ChangePasswordResult> {
  if (input.newPassword.length < 12 || input.newPassword.length > 128) {
    return { ok: false, status: 400, error: 'Password must be 12–128 characters' }
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, input.userId)).limit(1)
  if (!user) {
    return { ok: false, status: 404, error: 'Account not found' }
  }

  if (!user.passwordHash) {
    return { ok: false, status: 400, error: 'Password login is not configured for this account' }
  }

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash)
  if (!matches) {
    return { ok: false, status: 401, error: 'Current password is incorrect' }
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12)
  const nextSessionVersion = (user.sessionVersion ?? 0) + 1
  await db
    .update(schema.users)
    .set({ passwordHash, sessionVersion: nextSessionVersion })
    .where(eq(schema.users.id, input.userId))

  input.log.info?.({ userId: input.userId }, 'password changed via logged-in flow')

  const recipient = getEmailFromUserRow(user)
  if (recipient) {
    const changed = buildPasswordChangedEmail()
    const sent = await sendEmail({
      to: recipient,
      subject: changed.subject,
      text: changed.text,
      html: changed.html,
      sensitive: true,
      category: 'password_changed',
    })
    if (!sent.ok) {
      input.log.warn({ err: sent.error, userId: input.userId }, 'password changed email failed')
    }
  }

  return { ok: true, sessionVersion: nextSessionVersion }
}
