/**
 * Privileged platform staff password step-up (not legal-admin-only).
 *
 * Covers OWNER_ADMIN, SITE_ADMIN, TRUST_SAFETY_ADMIN, and LEGAL_ADMIN before
 * sensitive PII/DM/investigation actions. Filename is historical; prefer
 * `requiresPrivilegedStepUp` / `isPrivilegedPlatformStaff` when importing.
 */
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db, schema } from '../db/index.js'
import {
  getPlatformStaffRole,
  isLegalAdmin,
  isLegalOrSiteAdmin,
  isSiteAdmin,
  isTrustSafetyAdmin,
  type PlatformStaffRole,
} from './platform-staff.js'

const STEP_UP_MS = 30 * 60 * 1000

/** Owner PII/DM investigation surfaces use the same recent password step-up as other admins. */
const PRIVILEGED_ROLES: PlatformStaffRole[] = [
  'OWNER_ADMIN',
  'SITE_ADMIN',
  'TRUST_SAFETY_ADMIN',
  'LEGAL_ADMIN',
]

export async function isPrivilegedPlatformStaff(userId: string): Promise<boolean> {
  const role = await getPlatformStaffRole(userId)
  if (!role) return false
  return PRIVILEGED_ROLES.includes(role)
}

/** Returns true when a password step-up is required before sensitive admin/legal actions. */
export async function requiresPrivilegedStepUp(userId: string): Promise<boolean> {
  const role = await getPlatformStaffRole(userId)
  if (!role || !PRIVILEGED_ROLES.includes(role)) return false

  const [row] = await db
    .select({ lastStepUpAt: schema.platformStaff.lastStepUpAt })
    .from(schema.platformStaff)
    .where(eq(schema.platformStaff.userId, userId))
    .limit(1)

  if (!row?.lastStepUpAt) return true
  return Date.now() - row.lastStepUpAt.getTime() > STEP_UP_MS
}

export async function recordPrivilegedStepUp(userId: string): Promise<void> {
  const role = await getPlatformStaffRole(userId)
  if (!role) return
  const now = new Date()
  await db
    .insert(schema.platformStaff)
    .values({ userId, role, lastStepUpAt: now })
    .onConflictDoUpdate({
      target: schema.platformStaff.userId,
      set: { lastStepUpAt: now },
    })
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const [user] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!user) return false
  return bcrypt.compare(password, user.passwordHash)
}

export { isSiteAdmin, isTrustSafetyAdmin, isLegalAdmin, isLegalOrSiteAdmin }
