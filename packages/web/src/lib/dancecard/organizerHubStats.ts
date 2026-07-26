export type OrganizerHubEventRow = {
  slug: string
  eventTitle: string
  productTitle: string
  status: string
  role: string
  updatedAt: string
  timezone?: string | null
  windowStartsAt?: string | null
  windowEndsAt?: string | null
}

export type OrganizerHubEventWithStats = OrganizerHubEventRow & {
  programSlotCount: number
  publishedSlotCount: number
}
