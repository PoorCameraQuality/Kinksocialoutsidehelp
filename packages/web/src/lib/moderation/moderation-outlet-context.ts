export type ModerationSummary = {
  openReports: number
  openProfileFlags: number
}

export type ModerationOutletContext = {
  /** Bump to refetch dashboard counts, nav badges, and list pages. */
  refreshModeration: () => void
  moderationRefreshKey: number
  summary: ModerationSummary | null
}

export const defaultModerationOutletContext: ModerationOutletContext = {
  refreshModeration: () => {},
  moderationRefreshKey: 0,
  summary: null,
}
