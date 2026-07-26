import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  getPlatformModeratorUserIds,
  isEnvBootstrapPlatformModerator,
} from './platform-moderator.js'

export type PlatformStaffRole =
  | 'OWNER_ADMIN'
  | 'SITE_ADMIN'
  | 'MODERATOR'
  | 'TRUST_SAFETY_ADMIN'
  | 'LEGAL_ADMIN'

function parseUserIdSet(envKey: string): Set<string> {
  const raw = process.env[envKey] ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
}

function getSiteAdminUserIdsFromEnv(): Set<string> {
  return parseUserIdSet('C2K_SITE_ADMIN_USER_IDS')
}

function getSiteOwnerUserIdsFromEnv(): Set<string> {
  return parseUserIdSet('C2K_SITE_OWNER_USER_IDS')
}

let staffCache: {
  at: number
  owners: Set<string>
  admins: Set<string>
  moderators: Set<string>
  trustSafetyAdmins: Set<string>
  legalAdmins: Set<string>
  roleByUser: Map<string, PlatformStaffRole>
} | null = null
const CACHE_MS = 30_000

async function loadStaffSets(): Promise<{
  owners: Set<string>
  admins: Set<string>
  moderators: Set<string>
  trustSafetyAdmins: Set<string>
  legalAdmins: Set<string>
  roleByUser: Map<string, PlatformStaffRole>
}> {
  const now = Date.now()
  if (staffCache && now - staffCache.at < CACHE_MS) {
    return staffCache
  }
  const owners = new Set(getSiteOwnerUserIdsFromEnv())
  const admins = new Set(getSiteAdminUserIdsFromEnv())
  const moderators = new Set(getPlatformModeratorUserIds())
  const trustSafetyAdmins = new Set<string>()
  const legalAdmins = new Set<string>()
  const roleByUser = new Map<string, PlatformStaffRole>()
  // Env site admins also get platform-mod console access.
  for (const id of admins) moderators.add(id)
  if (process.env.USE_DATABASE === 'true') {
    try {
      const rows = await db
        .select({ userId: schema.platformStaff.userId, role: schema.platformStaff.role })
        .from(schema.platformStaff)
      for (const row of rows) {
        roleByUser.set(row.userId, row.role)
        if (row.role === 'OWNER_ADMIN') {
          owners.add(row.userId)
        } else if (row.role === 'SITE_ADMIN') {
          admins.add(row.userId)
          moderators.add(row.userId)
        } else if (row.role === 'MODERATOR') {
          moderators.add(row.userId)
        } else if (row.role === 'TRUST_SAFETY_ADMIN') {
          trustSafetyAdmins.add(row.userId)
          moderators.add(row.userId)
        } else if (row.role === 'LEGAL_ADMIN') {
          legalAdmins.add(row.userId)
        }
      }
    } catch {
      /* table may not exist yet during migrate */
    }
  }
  // Site owner is apex: include in admin + mod sets for list helpers and cache consistency.
  for (const id of owners) {
    admins.add(id)
    moderators.add(id)
  }
  staffCache = { at: now, owners, admins, moderators, trustSafetyAdmins, legalAdmins, roleByUser }
  return staffCache
}

/** Platform owner - sole role for break-glass sensitive data reveal (email, signup IP). */
export async function isSiteOwner(userId: string): Promise<boolean> {
  const { owners } = await loadStaffSets()
  return owners.has(userId)
}

export async function isSiteAdmin(userId: string): Promise<boolean> {
  const { owners, admins } = await loadStaffSets()
  return owners.has(userId) || admins.has(userId)
}

export async function isTrustSafetyAdmin(userId: string): Promise<boolean> {
  const { owners, trustSafetyAdmins, admins } = await loadStaffSets()
  return owners.has(userId) || admins.has(userId) || trustSafetyAdmins.has(userId)
}

export async function isLegalAdmin(userId: string): Promise<boolean> {
  const { owners, legalAdmins, admins } = await loadStaffSets()
  return owners.has(userId) || admins.has(userId) || legalAdmins.has(userId)
}

export async function isLegalOrSiteAdmin(userId: string): Promise<boolean> {
  return (await isLegalAdmin(userId)) || (await isSiteAdmin(userId))
}

/**
 * Full platform moderator capability: site owners, DB `platform_staff` moderators,
 * and env bootstrap IDs. Use this for authorization and privacy bypasses.
 */
export async function isPlatformModeratorUser(userId: string): Promise<boolean> {
  const { owners, moderators } = await loadStaffSets()
  return owners.has(userId) || moderators.has(userId) || isEnvBootstrapPlatformModerator(userId)
}

export async function getPlatformStaffRole(userId: string): Promise<PlatformStaffRole | null> {
  if (await isSiteOwner(userId)) return 'OWNER_ADMIN'
  const { roleByUser, admins, moderators } = await loadStaffSets()
  const dbRole = roleByUser.get(userId)
  if (
    dbRole === 'SITE_ADMIN' ||
    dbRole === 'MODERATOR' ||
    dbRole === 'TRUST_SAFETY_ADMIN' ||
    dbRole === 'LEGAL_ADMIN'
  ) {
    return dbRole
  }
  // Env-only bootstrap (no platform_staff row). Owners already returned above.
  if (admins.has(userId)) return 'SITE_ADMIN'
  if (moderators.has(userId) || isEnvBootstrapPlatformModerator(userId)) return 'MODERATOR'
  return null
}

export async function listPlatformModeratorUserIds(): Promise<string[]> {
  const { moderators } = await loadStaffSets()
  return [...moderators]
}

export async function listSiteOwnerUserIds(): Promise<string[]> {
  const { owners } = await loadStaffSets()
  return [...owners]
}

export async function listSiteAdminOnlyUserIds(): Promise<string[]> {
  const { admins, owners } = await loadStaffSets()
  return [...new Set([...admins, ...owners])]
}

export async function listTrustSafetyAdminUserIds(): Promise<string[]> {
  const { trustSafetyAdmins, admins, owners } = await loadStaffSets()
  return [...new Set([...trustSafetyAdmins, ...admins, ...owners])]
}

export function invalidatePlatformStaffCache(): void {
  staffCache = null
}
