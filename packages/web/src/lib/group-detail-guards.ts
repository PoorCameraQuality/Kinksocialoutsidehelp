import { GROUPS_SECTION_NAV } from './groups-section-nav-data.ts'
import type { GroupsSectionMode } from './groups-section-mode.ts'

/** Personal library tabs without a backing API yet. */
export const STUB_GROUPS_LIBRARY_MODES = new Set<GroupsSectionMode>(['invitations', 'posts', 'saved'])

/**
 * Mock slug/id group pages (channels, resources, photos) only for unsigned demo fallback.
 * Matches discover: `VITE_HOME_DEMO_FALLBACK && !isAuthenticated`.
 */
export function allowMockGroupExperienceFromFlags(
  homeDemoFallbackEnv: boolean,
  isAuthenticated: boolean,
): boolean {
  return homeDemoFallbackEnv && !isAuthenticated
}

export function allowMockGroupExperience(isAuthenticated: boolean): boolean {
  return allowMockGroupExperienceFromFlags(
    import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true',
    isAuthenticated,
  )
}

/** Try API group detail unless the viewer is in unsigned demo fallback mode. */
export function shouldFetchApiGroupDetailFromFlags(
  groupIdOrSlug: string | undefined,
  homeDemoFallbackEnv: boolean,
  isAuthenticated: boolean,
): boolean {
  if (!groupIdOrSlug) return false
  return !allowMockGroupExperienceFromFlags(homeDemoFallbackEnv, isAuthenticated)
}

export function shouldFetchApiGroupDetail(groupIdOrSlug: string | undefined, isAuthenticated: boolean): boolean {
  return shouldFetchApiGroupDetailFromFlags(
    groupIdOrSlug,
    import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true',
    isAuthenticated,
  )
}

export function groupsSectionNavForViewer(showRealPersonalLibrary: boolean) {
  if (showRealPersonalLibrary) {
    return GROUPS_SECTION_NAV.filter((item) => !STUB_GROUPS_LIBRARY_MODES.has(item.match))
  }
  return GROUPS_SECTION_NAV
}

export function isStubGroupsLibraryMode(mode: GroupsSectionMode): boolean {
  return STUB_GROUPS_LIBRARY_MODES.has(mode)
}
