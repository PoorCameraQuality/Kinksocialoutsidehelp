/**
 * Strategy: stream tab → sort key mapping per entity type.
 * Replaces inline ternaries and getEventsSortBy() in discovery.
 */

export const STREAM_TO_SORT: Record<string, Record<string, string>> = {
  People: { nearby: 'nearby', new: 'new', relevance: 'relevance', diverse: 'diverse', active: 'active' },
  Events: { nearby: 'soon', new: 'new', relevance: 'relevance', diverse: 'diverse' },
  Vendors: { nearby: 'nearby', new: 'new', relevance: 'rating', diverse: 'diverse' },
  Groups: { nearby: 'nearby', new: 'new', relevance: 'relevance', diverse: 'diverse' },
}

export function getSortBy(entityType: string, streamTab: string): string {
  const streamMap: Record<string, string> = {
    'Near you': 'nearby',
    'New': 'new',
    'Popular': 'relevance',
    'Recommended': 'diverse',
    'Recently active': 'active',
  }
  const streamSortBy = streamMap[streamTab] ?? 'diverse'
  return STREAM_TO_SORT[entityType]?.[streamSortBy] ?? 'diverse'
}
