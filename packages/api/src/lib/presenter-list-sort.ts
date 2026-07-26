import { asc, desc, sql, type SQL } from 'drizzle-orm'
import { schema } from '../db/index.js'

export type PresenterListSort = 'popular' | 'name'

export type PresenterListSortRow = {
  username: string
  ratingAvg: number
  reviewCount: number
}

export function parsePresenterListSort(raw: string | undefined): PresenterListSort {
  if (raw === 'name') return 'name'
  return 'popular'
}

/** Sort key for popular: unrated (0 rating) last, then rating, review count, username. */
export function comparePresentersForPopularSort(a: PresenterListSortRow, b: PresenterListSortRow): number {
  const aUnrated = a.ratingAvg <= 0 ? 1 : 0
  const bUnrated = b.ratingAvg <= 0 ? 1 : 0
  if (aUnrated !== bUnrated) return aUnrated - bUnrated
  if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
  return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
}

export function presenterListOrderBy(sort: PresenterListSort): SQL[] {
  if (sort === 'name') {
    return [asc(schema.users.username)]
  }
  return [
    sql`CASE WHEN ${schema.presenterProfiles.ratingAvg} = 0 THEN 1 ELSE 0 END`,
    desc(schema.presenterProfiles.ratingAvg),
    desc(schema.presenterProfiles.reviewCount),
    asc(schema.users.username),
  ]
}
