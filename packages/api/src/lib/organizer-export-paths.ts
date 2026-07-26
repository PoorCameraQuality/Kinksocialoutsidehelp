/** Convention organizer export paths that must exist on the API (Wave 4 honesty gate). */
export const ORGANIZER_EXPORT_DOWNLOAD_PATHS = [
  '/exports/event-pack',
  '/exports/sessions?format=csv',
  '/exports/conflict-report?format=csv',
  '/registrants/export',
  '/policy-acceptances/export?format=csv',
] as const

/** Paths that must not appear as active download buttons (no route). */
export const ORGANIZER_EXPORT_REMOVED_PATHS = [
  '/exports/presenter-directory',
  '/exports/volunteer-call-sheet',
  '/media/no-photo-list',
] as const
