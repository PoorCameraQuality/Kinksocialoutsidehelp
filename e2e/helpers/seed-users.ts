/**
 * Deterministic seeded users from `npm run db:seed` - use for role-based E2E.
 * Password for all demo users: E2E_DEMO_PASSWORD (default `demo`).
 */
export const SEED_USERS = {
  /** Platform site admin + org owner */
  siteAdmin: process.env.E2E_SITE_ADMIN_USER ?? 'Brax',
  /** Member, org moderator, platform MODERATOR, door/check-in QA */
  member: process.env.E2E_DEMO_USER ?? 'RopeDreamer',
  /** Convention staff / attendee alternate */
  staff: 'LeatherCraftDemo',
  /** Attendee / reporter in moderation demo */
  attendee: 'ShutterSeed',
  /** Role-application demo applicant */
  applicant: 'TrustedRoleApplicantDemo',
} as const

export type SeedUserRole =
  | 'guest'
  | 'member'
  | 'incompleteProfileMember'
  | 'orgMember'
  | 'orgModerator'
  | 'groupMember'
  | 'groupModerator'
  | 'conventionOrganizer'
  | 'doorStaff'
  | 'platformModerator'
  | 'siteAdmin'
  | 'attendee'

/** Map E2E role → seeded username (same password for all). */
export function usernameForRole(role: SeedUserRole): string | null {
  switch (role) {
    case 'guest':
      return null
    case 'member':
    case 'incompleteProfileMember':
    case 'orgMember':
    case 'orgModerator':
    case 'groupMember':
    case 'groupModerator':
    case 'conventionOrganizer':
    case 'doorStaff':
    case 'platformModerator':
      return SEED_USERS.member
    case 'siteAdmin':
      return SEED_USERS.siteAdmin
    case 'attendee':
      return SEED_USERS.attendee
    default:
      return SEED_USERS.member
  }
}
