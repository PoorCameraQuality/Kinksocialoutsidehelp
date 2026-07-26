/**
 * Env bootstrap list of platform moderator UUIDs (`C2K_PLATFORM_MODERATOR_USER_IDS`).
 *
 * This is not the full staff check. Prefer `isPlatformModeratorUser` from
 * `platform-staff.ts` (DB `platform_staff` + env bootstrap + owners).
 * Use these helpers only when building the staff cache or for sync env-only probes.
 */

/** Comma-separated user UUIDs granted moderator powers via env bootstrap. */
export function getPlatformModeratorUserIds(): Set<string> {
  const raw = process.env.C2K_PLATFORM_MODERATOR_USER_IDS ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
}

/** True when `userId` appears in `C2K_PLATFORM_MODERATOR_USER_IDS` only (no DB staff lookup). */
export function isEnvBootstrapPlatformModerator(userId: string): boolean {
  return getPlatformModeratorUserIds().has(userId)
}

/**
 * @deprecated Use `isEnvBootstrapPlatformModerator` for env-only checks, or
 * `isPlatformModeratorUser` for authorization. Kept as an alias for older imports.
 */
export function isPlatformModerator(userId: string): boolean {
  return isEnvBootstrapPlatformModerator(userId)
}
