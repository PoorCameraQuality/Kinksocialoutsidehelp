export type OrgChecklistItem = {
  id: string
  label: string
  done: boolean
  href?: string
  /** Excluded from setup progress percentage. */
  optional?: boolean
  hint?: string
}

type BuildOrgChecklistInput = {
  slug: string
  visibility: string
  featureFlags: {
    calendarEnabled: boolean
    forumsEnabled: boolean
    chatEnabled: boolean
  }
  conventionCount: number
  hasBranding: boolean
  showSettings: boolean
  community?: {
    welcomeHtml?: string | null
    faq?: { q: string; a: string }[] | null
  } | null
}

function settingsHref(slug: string, section?: string) {
  const base = `/organizer/orgs/${encodeURIComponent(slug)}?tab=settings`
  return section ? `${base}&settingsSection=${section}` : base
}

export function buildOrgChecklist(input: BuildOrgChecklistInput): OrgChecklistItem[] {
  const { slug, visibility, featureFlags, conventionCount, hasBranding, showSettings, community } = input
  const base = `/organizer/orgs/${encodeURIComponent(slug)}`
  const hasHubContent =
    Boolean(community?.welcomeHtml?.trim()) ||
    (Array.isArray(community?.faq) && community.faq.length > 0)

  const items: OrgChecklistItem[] = [
    {
      id: 'visibility',
      label: 'Confirm public visibility choice',
      done: Boolean(visibility),
      href: showSettings ? settingsHref(slug, 'general') : undefined,
      hint:
        visibility === 'PUBLIC' ? 'Listed for discovery.'
        : visibility === 'MEMBERS' ? 'Hub visible to members.'
        : 'Invite-only organization.',
    },
    {
      id: 'calendar',
      label: 'Enable event calendar',
      done: featureFlags.calendarEnabled,
      href: showSettings ? settingsHref(slug, 'features') : `${base}?tab=schedule`,
    },
    {
      id: 'branding',
      label: 'Add logo and banner branding',
      done: hasBranding,
      href: showSettings ? settingsHref(slug, 'branding') : undefined,
    },
    {
      id: 'community',
      label: 'Configure forums or chat',
      done: featureFlags.forumsEnabled || featureFlags.chatEnabled,
      href: `${base}?tab=communications`,
    },
    {
      id: 'program',
      label: 'Create or import a convention program',
      done: conventionCount > 0,
      href: `${base}?tab=schedule`,
    },
    {
      id: 'hub-content',
      label: 'Add public hub welcome content',
      done: hasHubContent,
      optional: true,
      href: showSettings ? settingsHref(slug, 'content') : `/orgs/${encodeURIComponent(slug)}`,
      hint: 'Welcome message, FAQ, and overview modules.',
    },
    {
      id: 'payments',
      label: 'Choose how you take payments',
      done: false,
      optional: true,
      href: `/organizer/orgs/${encodeURIComponent(slug)}?tab=payments`,
      hint: 'Left rail → Payments (payments password required).',
    },
  ]

  return items
}

export function buildOrgChecklistWithConventions(
  input: BuildOrgChecklistInput & {
    firstConventionSlug?: string
    /** When false, door checklist item is omitted (no registration grant / org admin). */
    showDoorChecklist?: boolean
  },
): OrgChecklistItem[] {
  const items = buildOrgChecklist(input)
  if (!input.firstConventionSlug || input.conventionCount === 0) return items

  const orgBase = `/organizer/orgs/${encodeURIComponent(input.slug)}`
  const convSlug = input.firstConventionSlug
  const extra: OrgChecklistItem[] = [
    {
      id: 'registration',
      label: 'Test public registration flow',
      done: false,
      optional: true,
      href: `/conventions/${encodeURIComponent(convSlug)}/register`,
      hint: 'Optional after your first program exists.',
    },
  ]
  if (input.showDoorChecklist) {
    extra.push({
      id: 'door',
      label: 'Open door check-in mode',
      done: false,
      optional: true,
      href: `${orgBase}/conventions/${encodeURIComponent(convSlug)}/door`,
      hint: 'Mobile-friendly kiosk for at-the-door staff.',
    })
  }
  return [...items, ...extra]
}

export function checklistProgress(items: OrgChecklistItem[]) {
  const required = items.filter((i) => !i.optional)
  const doneCount = required.filter((i) => i.done).length
  const pct = required.length > 0 ? Math.round((doneCount / required.length) * 100) : 100
  const nextItem = items.find((i) => !i.done && i.href && !i.optional) ?? items.find((i) => !i.done && i.href)
  return { required, doneCount, total: required.length, pct, nextItem }
}

export function visibilityLabel(visibility: string): string {
  if (visibility === 'PUBLIC') return 'Public'
  if (visibility === 'MEMBERS') return 'Members only'
  if (visibility === 'PRIVATE') return 'Private'
  return visibility
}

export function publicHubStatusLabel(visibility: string): string {
  if (visibility === 'PUBLIC') return 'Live'
  if (visibility === 'MEMBERS') return 'Members only'
  return 'Private'
}
