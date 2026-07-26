import { PROFILE_ROLE_OPTIONS } from '@c2k/shared'



export const PEOPLE_STREAM_TABS = ['Recommended', 'Near you', 'New', 'Popular', 'Recently active'] as const

/**
 * Display labels for stream tabs. The underlying tab *values* stay stable so the
 * sort mapping in discovery-sort-config keeps working; only the user-facing copy
 * changes. "Popular" → contributor framing; "Recently active" → privacy-safe
 * public-activity wording (no "online now" / presence).
 */
export const PEOPLE_STREAM_TAB_LABELS: Record<string, string> = {
  Recommended: 'Recommended',
  'Near you': 'Near you',
  New: 'New',
  Popular: 'Community contributors',
  'Recently active': 'Recently posted',
}

export function peopleStreamTabLabel(tab: string): string {
  return PEOPLE_STREAM_TAB_LABELS[tab] ?? tab
}



/** Radius slider bounds (mi) on People discover. */

export const PEOPLE_MIN_DISTANCE_MI = 10



export const PEOPLE_COUNTRY_OPTIONS = [

  { value: '', label: 'Any country' },

  { value: 'United States', label: 'United States' },

  { value: 'Canada', label: 'Canada' },

  { value: 'United Kingdom', label: 'United Kingdom' },

  { value: 'Australia', label: 'Australia' },

  { value: 'Germany', label: 'Germany' },

] as const

export const PEOPLE_PAGE_SIZE = 12



/** Power-exchange / dynamics tags - shown only inside collapsed Interests & roles. */

export const INTEREST_ROLE_TAGS = PROFILE_ROLE_OPTIONS.find((g) => g.label === 'Power exchange')?.options ?? []



export type CommunityRoleFilterId = 'organizer' | 'presenter' | 'vendor' | 'volunteer' | 'moderator'



export const COMMUNITY_ROLE_FILTERS: ReadonlyArray<{ id: CommunityRoleFilterId; label: string }> = [

  { id: 'organizer', label: 'Organizer' },

  { id: 'presenter', label: 'Presenter / Educator' },

  { id: 'vendor', label: 'Vendor' },

  { id: 'volunteer', label: 'Volunteer' },

  { id: 'moderator', label: 'Moderator' },

]



/** Discrete minimum trust score steps for the refine rail slider. */

export const TRUST_SCORE_STEPS = [

  { value: 0, label: 'Any' },

  { value: 25, label: '25+' },

  { value: 50, label: '50+' },

  { value: 75, label: '75+' },

] as const



export const EXPERIENCE_OPTIONS = ['any', 'curious', 'new', 'intermediate', 'experienced', 'professional'] as const



/** Values match API `gender` query (substring match, case-insensitive). */

export const PEOPLE_GENDER_FILTER_OPTIONS = [

  { value: '', label: 'Any' },

  { value: 'woman', label: 'Woman' },

  { value: 'man', label: 'Man' },

  { value: 'non-binary', label: 'Non-binary' },

  { value: 'trans', label: 'Trans' },

  { value: 'agender', label: 'Agender' },

] as const



export const EXPERIENCE_TO_SCORE: Record<string, { min: number; max: number }> = {

  any: { min: 0, max: 100 },

  curious: { min: 0, max: 20 },

  new: { min: 20, max: 40 },

  intermediate: { min: 40, max: 60 },

  experienced: { min: 60, max: 80 },

  professional: { min: 80, max: 100 },

}



/** @deprecated Use INTEREST_ROLE_TAGS - kept for imports migrating off ROLE_TAGS. */

export const ROLE_TAGS = INTEREST_ROLE_TAGS


