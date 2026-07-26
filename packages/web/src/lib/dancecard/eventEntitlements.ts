export type DancecardModules = {
  schedule_embed?: boolean
  map_embed?: boolean
  shift_swaps?: boolean
  vetting_applications?: boolean
  policy_public_summary?: boolean
  ecke_sign?: boolean
  rabbitsign_sync?: boolean
  iso_board?: boolean
  session_feedback?: boolean
  attendee_groups?: boolean
  meal_signups?: boolean
  exhibitor_directory?: boolean
  attendee_directory?: boolean
  activity_feed?: boolean
}

export const DEFAULT_DANCECARD_MODULES: Required<DancecardModules> = {
  schedule_embed: true,
  map_embed: true,
  shift_swaps: false,
  vetting_applications: false,
  policy_public_summary: true,
  ecke_sign: true,
  rabbitsign_sync: false,
  iso_board: false,
  session_feedback: false,
  attendee_groups: false,
  meal_signups: false,
  exhibitor_directory: false,
  attendee_directory: false,
  activity_feed: true,
}
