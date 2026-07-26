import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareOrgsForPopularSort, parseOrgListSort } from './org-list-sort.js'

describe('parseOrgListSort', () => {
  it('defaults to popular', () => {
    assert.equal(parseOrgListSort(undefined), 'popular')
    assert.equal(parseOrgListSort('popular'), 'popular')
  })

  it('accepts name', () => {
    assert.equal(parseOrgListSort('name'), 'name')
  })
})

describe('compareOrgsForPopularSort', () => {
  it('ranks higher rating first', () => {
    const high = { displayName: 'B', rating: 4.5, reviewCount: 10 }
    const low = { displayName: 'A', rating: 3.0, reviewCount: 10 }
    assert.ok(compareOrgsForPopularSort(high, low) < 0)
  })

  it('puts unrated orgs last', () => {
    const rated = { displayName: 'Z', rating: 3.5, reviewCount: 1 }
    const unrated = { displayName: 'A', rating: 0, reviewCount: 0 }
    assert.ok(compareOrgsForPopularSort(rated, unrated) < 0)
  })

  it('uses review count as tie-breaker', () => {
    const more = { displayName: 'A', rating: 4.0, reviewCount: 8 }
    const fewer = { displayName: 'B', rating: 4.0, reviewCount: 2 }
    assert.ok(compareOrgsForPopularSort(more, fewer) < 0)
  })
})
