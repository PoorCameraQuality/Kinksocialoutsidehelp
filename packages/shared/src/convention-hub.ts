export type ConventionAccessState = {
  canView: boolean
  canManage: boolean
  hasPaidAccess: boolean
  isStaff: boolean
}

export type ConventionDocument = {
  id: string
  title: string
  type: string
  url: string
  visibility: 'ATTENDEE' | 'STAFF' | 'PUBLIC'
}

export type ConventionCustomPage = {
  id: string
  slug: string
  title: string
  visibility: 'ATTENDEE' | 'STAFF' | 'PUBLIC'
  content: Record<string, unknown>
}
