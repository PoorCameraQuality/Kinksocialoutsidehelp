import {
  getConventionOmittedFields,
  getEducationOmittedFields,
  getEventOmittedFields,
  getGroupOmittedFields,
  getOrgOmittedFields,
  getPresenterOmittedFields,
  getVendorOmittedFields,
  getVenueOmittedFields,
} from './ecke-redaction.js'

export type EckeSourceKind =
  | 'education_article'
  | 'vendor_profile'
  | 'organization_listing'
  | 'group_listing'
  | 'event_listing'
  | 'convention_listing'
  | 'dancecard_event'
  | 'dancecard_location'
  | 'dancecard_program_slot'
  | 'dancecard_staff_shift'
  | 'presenter_profile'
  | 'dungeon_profile'
  | 'venue_profile'
  | 'convention_event_anchor'

/** Four owner-facing ECKE public surfaces (Phase 0 product model). */
export type EckeOwnerFacingSurface = 'events' | 'places' | 'vendors' | 'education'

export type EckePublishSupportState =
  | 'active_existing'
  | 'preview_only'
  | 'planned'
  | 'unsupported'

export type EckePublishTransport = 'ingest_api' | 'supabase_rest' | 'listing_webhook' | 'none'

export type EckeOwnerKind = 'user' | 'group' | 'organization' | 'convention' | 'event'

export type EckeRegistryEntry = {
  sourceKind: EckeSourceKind
  label: string
  description: string
  ownerKind: EckeOwnerKind
  visibleInGroupDashboard: boolean
  visibleInOrgDashboard: boolean
  visibleInConventionDashboard: boolean
  visibleInUserDashboard: boolean
  /** Primary ECKE public surface, when applicable. Null = not a main surface (legacy / internal). */
  ownerFacingSurface: EckeOwnerFacingSurface | null
  /** Legacy transport retained internally; hidden from owner-facing publish UI. */
  deprecated: boolean
  /** Show publish controls on owner dashboards (respects dashboard visibility flags). */
  ownerDashboardVisible: boolean
  supportState: EckePublishSupportState
  eckeTargetKind: string
  currentTransport: EckePublishTransport
  requiresPermission: string
  privacySummary: string
  omittedFields: readonly string[]
  eckeSurfacesAffected: readonly string[]
}

/**
 * ECKE rollout Pass 2 default action flags: preview-only control plane
 * (registry + status/preview; no outbound publish/sync/unpublish).
 *
 * Despite the name, each key is **allowed when true** (matches `EckePublishActions`).
 * Pass 2 keeps `preview: true` and write actions `false`. Runtime gating after Pass 3+
 * uses per-kind helpers (e.g. `computeGroupListingActions`); this constant remains for
 * tests and rollout docs — see `docs/ECKE_PUBLISH_ROLLOUT_PLAN.md`.
 */
export const PASS2_DISABLED_ACTIONS = {
  preview: true,
  publish: false,
  sync: false,
  unpublish: false,
} as const

/** UI copy for write buttons still gated behind Pass 3 in the control plane. */
export const PASS2_ACTION_LABELS = {
  publish: 'Coming in Pass 3',
  sync: 'Coming in Pass 3',
  unpublish: 'Coming in Pass 3',
} as const

export const ECKE_OWNER_FACING_SURFACES: readonly EckeOwnerFacingSurface[] = [
  'events',
  'places',
  'vendors',
  'education',
] as const

const GROUP_LISTING_SURFACES = [
  'ECKE thin public listing (legacy webhook)',
] as const

const EVENT_SURFACES = [
  'ECKE Events index (/events)',
  'ECKE event detail (/events/{slug})',
  'ECKE calendar and state pages',
  'ECKE sitemap after publish',
] as const

const PLACE_SURFACES = [
  'ECKE Places directory (nav: Places, route: /dungeons)',
  'ECKE place detail (/dungeons/{slug})',
  'ECKE sitemap after publish',
] as const

export const ECKE_PUBLISH_REGISTRY: readonly EckeRegistryEntry[] = [
  {
    sourceKind: 'education_article',
    label: 'Education article',
    description: 'Public education articles on ECKE Education (/education/{slug}).',
    ownerKind: 'user',
    visibleInGroupDashboard: true,
    visibleInOrgDashboard: true,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: true,
    ownerFacingSurface: 'education',
    deprecated: false,
    ownerDashboardVisible: true,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_article',
    currentTransport: 'ingest_api',
    requiresPermission: 'article.author',
    privacySummary: 'Only published public articles with ECKE opt-in.',
    omittedFields: getEducationOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: [
      'Education article page',
      'Education index',
      'Sitemap',
    ],
  },
  {
    sourceKind: 'vendor_profile',
    label: 'Vendor profile',
    description: 'Public vendor profiles on ECKE Vendors (/vendors/{slug}).',
    ownerKind: 'user',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: true,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: true,
    ownerFacingSurface: 'vendors',
    deprecated: false,
    ownerDashboardVisible: true,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_vendor',
    currentTransport: 'supabase_rest',
    requiresPermission: 'vendor.owner_or_co_owner',
    privacySummary: 'Only public vendor profiles with ECKE opt-in. Owner/co-owner publish only.',
    omittedFields: getVendorOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: [
      'ECKE vendor detail page',
      'ECKE vendors index',
      'ECKE sitemap',
    ],
  },
  {
    sourceKind: 'organization_listing',
    label: 'Organization listing',
    description: 'Deprecated — ECKE does not publish organization profile pages.',
    ownerKind: 'organization',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: true,
    ownerDashboardVisible: false,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_listing',
    currentTransport: 'listing_webhook',
    requiresPermission: 'org.moderator',
    privacySummary: 'Legacy listing webhook only; not a public ECKE org directory surface.',
    omittedFields: getOrgOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: ['Legacy listing webhook (retired from owner UI)'],
  },
  {
    sourceKind: 'group_listing',
    label: 'Group listing',
    description: 'Low-priority thin public listing when group owner explicitly opts in.',
    ownerKind: 'group',
    visibleInGroupDashboard: true,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: false,
    ownerDashboardVisible: true,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_listing',
    currentTransport: 'listing_webhook',
    requiresPermission: 'group.moderator',
    privacySummary: 'Only public groups with explicit opt-in. Member lists never publish.',
    omittedFields: getGroupOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: GROUP_LISTING_SURFACES,
  },
  {
    sourceKind: 'event_listing',
    label: 'Event',
    description: 'Standalone public events on ECKE Events (/events/{slug}).',
    ownerKind: 'event',
    visibleInGroupDashboard: true,
    visibleInOrgDashboard: true,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: 'events',
    deprecated: false,
    ownerDashboardVisible: true,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_event',
    currentTransport: 'supabase_rest',
    requiresPermission: 'event.host_or_org_mod',
    privacySummary: 'Only public events. Location visibility rules apply.',
    omittedFields: getEventOmittedFields('rsvp').map((f) => f.label),
    eckeSurfacesAffected: EVENT_SURFACES,
  },
  {
    sourceKind: 'convention_listing',
    label: 'Convention listing',
    description: 'Deprecated legacy listing webhook — conventions publish to ECKE Events.',
    ownerKind: 'convention',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: true,
    ownerDashboardVisible: false,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_listing',
    currentTransport: 'listing_webhook',
    requiresPermission: 'convention.full_admin',
    privacySummary: 'Legacy transport only; user-facing outcome is ECKE Events.',
    omittedFields: ['Attendee roster', 'Staff notes', 'Private operational notes'],
    eckeSurfacesAffected: ['Legacy listing webhook (superseded by Events surface)'],
  },
  {
    sourceKind: 'dancecard_event',
    label: 'Dancecard event',
    description: 'Deprecated ECKE sync — Dancecard program stays on kink.social; ECKE may link only.',
    ownerKind: 'convention',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: true,
    ownerDashboardVisible: false,
    supportState: 'active_existing',
    eckeTargetKind: 'dancecard_event',
    currentTransport: 'supabase_rest',
    requiresPermission: 'convention.full_admin',
    privacySummary: 'Program data is not synced to ECKE. Link-only from ECKE event pages when enabled.',
    omittedFields: ['Staff user IDs', 'Private operational notes', 'Program slots', 'Locations', 'Staff shifts'],
    eckeSurfacesAffected: ['kink.social Dancecard only'],
  },
  {
    sourceKind: 'dancecard_location',
    label: 'Dancecard locations',
    description: 'Deprecated — not an ECKE publish surface.',
    ownerKind: 'convention',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: true,
    ownerDashboardVisible: false,
    supportState: 'active_existing',
    eckeTargetKind: 'dancecard_event',
    currentTransport: 'supabase_rest',
    requiresPermission: 'convention.full_admin',
    privacySummary: 'Dancecard locations are kink.social-only.',
    omittedFields: ['Private address details'],
    eckeSurfacesAffected: ['kink.social Dancecard only'],
  },
  {
    sourceKind: 'dancecard_program_slot',
    label: 'Dancecard program slots',
    description: 'Deprecated — not an ECKE publish surface.',
    ownerKind: 'convention',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: true,
    ownerDashboardVisible: false,
    supportState: 'active_existing',
    eckeTargetKind: 'dancecard_event',
    currentTransport: 'supabase_rest',
    requiresPermission: 'convention.full_admin',
    privacySummary: 'Dancecard schedule is kink.social-only.',
    omittedFields: ['Staff notes', 'Private slot notes'],
    eckeSurfacesAffected: ['kink.social Dancecard only'],
  },
  {
    sourceKind: 'dancecard_staff_shift',
    label: 'Dancecard staff shifts',
    description: 'Deprecated — not an ECKE publish surface.',
    ownerKind: 'convention',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: true,
    ownerDashboardVisible: false,
    supportState: 'active_existing',
    eckeTargetKind: 'dancecard_event',
    currentTransport: 'supabase_rest',
    requiresPermission: 'convention.full_admin',
    privacySummary: 'Dancecard staff data is kink.social-only.',
    omittedFields: ['User IDs', 'Private contact info'],
    eckeSurfacesAffected: ['kink.social Dancecard only'],
  },
  {
    sourceKind: 'presenter_profile',
    label: 'Presenter profile',
    description: 'Low-priority thin public listing when presenter opts in (legacy webhook).',
    ownerKind: 'user',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: true,
    ownerFacingSurface: null,
    deprecated: false,
    ownerDashboardVisible: true,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_listing',
    currentTransport: 'listing_webhook',
    requiresPermission: 'presenter.owner',
    privacySummary: 'Public presenter directory only; private materials omitted.',
    omittedFields: getPresenterOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: ['ECKE thin presenter listing (legacy)'],
  },
  {
    sourceKind: 'dungeon_profile',
    label: 'Dungeon listing (legacy org path)',
    description: 'Deprecated — place listings publish from community_places, not org profile.',
    ownerKind: 'organization',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: null,
    deprecated: true,
    ownerDashboardVisible: false,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_dungeon',
    currentTransport: 'supabase_rest',
    requiresPermission: 'org.moderator',
    privacySummary: 'Legacy org-scoped dungeon row; use place publish instead.',
    omittedFields: getVenueOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: ['Legacy Supabase dungeon_venues (interim)'],
  },
  {
    sourceKind: 'venue_profile',
    label: 'Place listing',
    description: 'Public venue/place on ECKE Places (/dungeons/{slug}).',
    ownerKind: 'organization',
    visibleInGroupDashboard: true,
    visibleInOrgDashboard: true,
    visibleInConventionDashboard: false,
    visibleInUserDashboard: false,
    ownerFacingSurface: 'places',
    deprecated: false,
    ownerDashboardVisible: true,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_listing',
    currentTransport: 'listing_webhook',
    requiresPermission: 'org.moderator',
    privacySummary: 'Published community places only; hidden addresses omitted.',
    omittedFields: getVenueOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: PLACE_SURFACES,
  },
  {
    sourceKind: 'convention_event_anchor',
    label: 'Convention event',
    description: 'Convention on ECKE Events (/events/{slug}) with Convention badge.',
    ownerKind: 'convention',
    visibleInGroupDashboard: false,
    visibleInOrgDashboard: false,
    visibleInConventionDashboard: true,
    visibleInUserDashboard: false,
    ownerFacingSurface: 'events',
    deprecated: false,
    ownerDashboardVisible: true,
    supportState: 'active_existing',
    eckeTargetKind: 'ecke_event',
    currentTransport: 'supabase_rest',
    requiresPermission: 'convention.full_admin',
    privacySummary: 'Public convention fields only; c2k_source_type=convention. No attendee data.',
    omittedFields: getConventionOmittedFields().map((f) => f.label),
    eckeSurfacesAffected: EVENT_SURFACES,
  },
] as const

export function getRegistryEntry(sourceKind: EckeSourceKind): EckeRegistryEntry | undefined {
  return ECKE_PUBLISH_REGISTRY.find((e) => e.sourceKind === sourceKind)
}

export function isRegistryEntryOwnerVisible(
  entry: EckeRegistryEntry,
  dashboard: 'group' | 'org' | 'convention' | 'user',
): boolean {
  if (!entry.ownerDashboardVisible || entry.deprecated) return false
  switch (dashboard) {
    case 'group':
      return entry.visibleInGroupDashboard
    case 'org':
      return entry.visibleInOrgDashboard
    case 'convention':
      return entry.visibleInConventionDashboard
    case 'user':
      return entry.visibleInUserDashboard
  }
}

export function listRegistryForGroupDashboard(): EckeRegistryEntry[] {
  return ECKE_PUBLISH_REGISTRY.filter(
    (e) => e.visibleInGroupDashboard && isRegistryEntryOwnerVisible(e, 'group'),
  )
}

export function listRegistryForOrgDashboard(): EckeRegistryEntry[] {
  return ECKE_PUBLISH_REGISTRY.filter((e) => e.visibleInOrgDashboard && isRegistryEntryOwnerVisible(e, 'org'))
}

export function listRegistryForConventionDashboard(): EckeRegistryEntry[] {
  return ECKE_PUBLISH_REGISTRY.filter(
    (e) => e.visibleInConventionDashboard && isRegistryEntryOwnerVisible(e, 'convention'),
  )
}

export function listOwnerFacingRegistryEntries(): EckeRegistryEntry[] {
  return ECKE_PUBLISH_REGISTRY.filter((e) => e.ownerFacingSurface !== null && !e.deprecated)
}

export function listDeprecatedRegistryEntries(): EckeRegistryEntry[] {
  return ECKE_PUBLISH_REGISTRY.filter((e) => e.deprecated)
}

export function listAllRegistryEntries(): EckeRegistryEntry[] {
  return [...ECKE_PUBLISH_REGISTRY]
}

export function isValidEckeSourceKind(value: string): value is EckeSourceKind {
  return ECKE_PUBLISH_REGISTRY.some((e) => e.sourceKind === value)
}
