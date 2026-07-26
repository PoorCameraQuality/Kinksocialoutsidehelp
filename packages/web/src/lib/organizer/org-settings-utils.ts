import type { OrgFlags } from '@/components/org/OrgAdminDashboard'

export type SettingsSection = 'general' | 'branding' | 'features' | 'content' | 'publish'

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; blurb: string }[] = [
  { id: 'general', label: 'General', blurb: 'Name, visibility, and external site settings.' },
  { id: 'branding', label: 'Branding', blurb: 'Logo, banner, and link preview images.' },
  { id: 'features', label: 'Features', blurb: 'Choose which tabs and tools appear on the public hub.' },
  { id: 'content', label: 'Content', blurb: 'Edit organization-wide welcome, FAQ, resources, and overview modules.' },
  { id: 'publish', label: 'Publish', blurb: 'Optional public listing controls for East Coast Kink Events.' },
]

export function parseSettingsSection(raw: string | null): SettingsSection {
  if (raw === 'content' || raw === 'branding' || raw === 'features' || raw === 'publish') {
    return raw
  }
  return 'general'
}

/** Legacy deep link from Settings → Payments. */
export function isLegacyPaymentsSettingsSection(raw: string | null): boolean {
  return raw === 'payments'
}

export const VISIBILITY_OPTIONS = [
  {
    value: 'PUBLIC',
    title: 'Public',
    description: 'Anyone can find and view the hub.',
  },
  {
    value: 'MEMBERS',
    title: 'Members only',
    description: 'Only members can view community details.',
  },
  {
    value: 'PRIVATE',
    title: 'Private',
    description: 'Hidden from public discovery unless invited.',
  },
] as const

export type HubTabPreview = {
  id: string
  label: string
  alwaysOn?: boolean
  shown: boolean
}

export function buildHubTabPreview(flags: OrgFlags, hasFaq: boolean, hasDocumentsModule: boolean): HubTabPreview[] {
  return [
    { id: 'overview', label: 'Overview', alwaysOn: true, shown: true },
    { id: 'calendar', label: 'Calendar', shown: flags.calendarEnabled },
    { id: 'forums', label: 'Forums', shown: flags.forumsEnabled },
    { id: 'chat', label: 'Chat', shown: flags.chatEnabled },
    { id: 'about', label: 'About', shown: true },
    { id: 'faq', label: 'FAQ', shown: hasFaq },
    { id: 'subgroups', label: 'Subgroups', shown: flags.subgroupsEnabled },
    { id: 'documents', label: 'Documents', shown: hasDocumentsModule },
  ]
}

export const FEATURE_DEFINITIONS: {
  key: keyof OrgFlags
  name: string
  description: string
  appears: string
  warning?: string
}[] = [
  {
    key: 'calendarEnabled',
    name: 'Events & conventions',
    description: 'Shows your organization calendar and public programs.',
    appears: 'Calendar tab on the public hub',
  },
  {
    key: 'forumsEnabled',
    name: 'Forums',
    description: 'Lets members browse categories, read threads, and create posts.',
    appears: 'Forums tab',
  },
  {
    key: 'chatEnabled',
    name: 'Chat',
    description: 'Lets members join real-time organization channels.',
    appears: 'Chat tab',
  },
  {
    key: 'externalEmbedEnabled',
    name: 'External site embed',
    description: 'Allows an approved external website to appear on the About tab.',
    appears: 'About tab iframe',
    warning: 'You still need an allowlisted URL under General → External site.',
  },
]
