/** Types for convention program slots (aligned with GET /api/v1/conventions/:key/slots). */

export type SlotPresenter = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  vendorSlug?: string | null
  presenterPublic?: boolean
}

export type SlotStaffMember = {
  id: string
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  roleLabel: string
  station: string | null
  notes: string | null
  startsAt: string
  endsAt: string
  vendorSlug?: string | null
  presenterPublic?: boolean
}

export type PresenterOfferingSummary = {
  title: string
  ownerUsername: string
}

export type ScheduleSlot = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  description: string | null
  location: string | null
  linkUrl: string | null
  trackLabel?: string | null
  roomLabel?: string | null
  presenterOfferingId?: string | null
  presenters: SlotPresenter[]
  materials?: Array<{ id: string; title: string; url: string }>
  staff?: SlotStaffMember[]
  presenterOffering?: PresenterOfferingSummary | null
}
