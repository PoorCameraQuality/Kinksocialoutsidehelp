import { asc, desc, sql, type SQL } from 'drizzle-orm'
import { schema } from '../db/index.js'

export type OrgListSort = 'popular' | 'name'

export type OrgListSortRow = {
  displayName: string
  rating: number
  reviewCount: number
}

export function parseOrgListSort(raw: string | undefined): OrgListSort {
  if (raw === 'name') return 'name'
  return 'popular'
}

/** Sort key for popular: unrated (0 rating) last, then rating, review count, name. */
export function compareOrgsForPopularSort(a: OrgListSortRow, b: OrgListSortRow): number {
  const aUnrated = a.rating <= 0 ? 1 : 0
  const bUnrated = b.rating <= 0 ? 1 : 0
  if (aUnrated !== bUnrated) return aUnrated - bUnrated
  if (b.rating !== a.rating) return b.rating - a.rating
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
}

export function orgListOrderBy(sort: OrgListSort): SQL[] {
  if (sort === 'name') {
    return [asc(schema.organizations.displayName)]
  }
  return [
    sql`CASE WHEN ${schema.organizations.rating} = 0 THEN 1 ELSE 0 END`,
    desc(schema.organizations.rating),
    desc(schema.organizations.reviewCount),
    asc(schema.organizations.displayName),
  ]
}
