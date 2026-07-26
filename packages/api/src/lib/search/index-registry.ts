import { readSearchConfig } from './config.js'

/** Canonical index keys — collection suffix = key unless noted. */
export const SEARCH_INDEX_KEYS = [
  'education_articles',
  'organizations_public',
  'vendors_public',
  'events_public',
  'groups_public',
  'people_discoverable',
  'explore_federated',
] as const

export type SearchIndexKey = (typeof SEARCH_INDEX_KEYS)[number]

export type SearchIndexDefinition = {
  key: SearchIndexKey
  /** Typesense collection name suffix (prefixed at runtime). */
  collectionSuffix: string
  /** Human label for ops docs. */
  label: string
  rolloutPhase: number
  /** When true, this index may sync/query once global Typesense flags allow. */
  enabled: boolean
  /** Privacy notes for future implementers. */
  privacyNotes: string
}

/**
 * Sitewide index registry. Only `education_articles` is enabled in Pass 2B.
 * Other entries are defined for schema/worker conventions — not wired yet.
 */
export const SEARCH_INDEX_REGISTRY: Record<SearchIndexKey, SearchIndexDefinition> = {
  education_articles: {
    key: 'education_articles',
    collectionSuffix: 'education_articles',
    label: 'Education hub articles',
    rolloutPhase: 1,
    enabled: true,
    privacyNotes:
      'Index only listInEducation + PUBLISHED + visibility PUBLIC. No body HTML. API post-filters after hydrate.',
  },
  organizations_public: {
    key: 'organizations_public',
    collectionSuffix: 'organizations_public',
    label: 'Public organizations directory',
    rolloutPhase: 2,
    enabled: false,
    privacyNotes: 'PUBLIC orgs only. No member rosters or billing fields.',
  },
  vendors_public: {
    key: 'vendors_public',
    collectionSuffix: 'vendors_public',
    label: 'Public vendors directory',
    rolloutPhase: 2,
    enabled: false,
    privacyNotes: 'PUBLIC vendors only. No prices in directory index.',
  },
  events_public: {
    key: 'events_public',
    collectionSuffix: 'events_public',
    label: 'Global public events',
    rolloutPhase: 3,
    enabled: false,
    privacyNotes: 'visibility=public global events only. No group/org/private scoped events.',
  },
  groups_public: {
    key: 'groups_public',
    collectionSuffix: 'groups_public',
    label: 'Discoverable public groups',
    rolloutPhase: 5,
    enabled: false,
    privacyNotes: 'Public group metadata only. No member lists or private posts.',
  },
  people_discoverable: {
    key: 'people_discoverable',
    collectionSuffix: 'people_discoverable',
    label: 'People directory (opt-in)',
    rolloutPhase: 6,
    enabled: false,
    privacyNotes: 'discoverable_in_people_search + PUBLIC visibility + coarse fields only.',
  },
  explore_federated: {
    key: 'explore_federated',
    collectionSuffix: 'explore_federated',
    label: 'Explore federated multi_search',
    rolloutPhase: 4,
    enabled: false,
    privacyNotes: 'Virtual federated queries across enabled public indexes — no People.',
  },
}

export function resolveCollectionName(indexKey: SearchIndexKey, prefix?: string): string {
  const cfg = readSearchConfig()
  const p = (prefix ?? cfg.indexPrefix).trim() || 'c2k'
  const def = SEARCH_INDEX_REGISTRY[indexKey]
  return `${p}_${def.collectionSuffix}`
}

export function isIndexRolloutEnabled(indexKey: SearchIndexKey): boolean {
  return SEARCH_INDEX_REGISTRY[indexKey]?.enabled === true
}

export function isIndexIndexingActive(indexKey: SearchIndexKey): boolean {
  const cfg = readSearchConfig()
  return cfg.indexingEnabled && isIndexRolloutEnabled(indexKey)
}

export function isIndexQueryActive(indexKey: SearchIndexKey): boolean {
  const cfg = readSearchConfig()
  return cfg.queryEnabled && isIndexRolloutEnabled(indexKey)
}
