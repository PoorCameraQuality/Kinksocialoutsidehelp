/** Mirrors `communityModules` in org `PATCH` / GET (API-validated). */
export type CommunityPageModule =
  | {
      id: string
      type: 'richtext'
      enabled?: boolean
      title?: string | null
      html: string
      variant?: 'default' | 'callout' | 'muted'
    }
  | {
      id: string
      type: 'checklist'
      enabled?: boolean
      title?: string | null
      items: { label: string; href?: string | null; note?: string | null }[]
    }
  | {
      id: string
      type: 'contacts'
      enabled?: boolean
      title?: string | null
      rows: { role: string; detail: string; href?: string | null }[]
    }
  | {
      id: string
      type: 'announcements'
      enabled?: boolean
      title?: string | null
      items: { title: string; body: string; dateLabel?: string | null; link?: string | null }[]
    }
  | {
      id: string
      type: 'documents'
      enabled?: boolean
      title?: string | null
      items: { label: string; url: string; kind?: 'pdf' | 'doc' | 'sheet' | 'link' | 'other' }[]
    }
  | {
      id: string
      type: 'volunteer'
      enabled?: boolean
      title?: string | null
      bodyHtml?: string | null
      signupUrl?: string | null
    }
  | {
      id: string
      type: 'featured_vendors'
      enabled?: boolean
      title?: string | null
      maxItems?: number
      emptyMessage?: string
    }
  | {
      id: string
      type: 'featured_articles'
      enabled?: boolean
      title?: string | null
      maxItems?: number
      emptyMessage?: string
    }
  | {
      id: string
      type: 'event_picks'
      enabled?: boolean
      title?: string | null
      maxItems?: number
      filter?: 'upcoming' | 'beginner_friendly'
      noteHtml?: string | null
    }
  | {
      id: string
      type: 'reporting'
      enabled?: boolean
      title?: string | null
      introHtml: string
      reportUrl?: string | null
      policyHtml?: string | null
    }

export const COMMUNITY_MODULE_TYPE_LABELS: Record<CommunityPageModule['type'], string> = {
  richtext: 'Rich text',
  checklist: 'New-member checklist',
  contacts: 'Contacts & roles',
  announcements: 'Announcements',
  documents: 'Document library',
  volunteer: 'Volunteer / shifts',
  featured_vendors: 'Featured vendors',
  featured_articles: 'Featured education articles',
  event_picks: 'Event picks',
  reporting: 'Safety & reporting',
}
