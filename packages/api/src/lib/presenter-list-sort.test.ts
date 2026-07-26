import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { comparePresentersForPopularSort, parsePresenterListSort } from './presenter-list-sort.js'

describe('parsePresenterListSort', () => {
  it('defaults to popular', () => {
    assert.equal(parsePresenterListSort(undefined), 'popular')
    assert.equal(parsePresenterListSort('popular'), 'popular')
  })

  it('accepts name', () => {
    assert.equal(parsePresenterListSort('name'), 'name')
  })
})

describe('comparePresentersForPopularSort', () => {
  it('ranks higher rating first', () => {
    const high = { username: 'b', ratingAvg: 4.8, reviewCount: 5 }
    const low = { username: 'a', ratingAvg: 3.2, reviewCount: 5 }
    assert.ok(comparePresentersForPopularSort(high, low) < 0)
  })

  it('puts unrated presenters last', () => {
    const rated = { username: 'z', ratingAvg: 3.5, reviewCount: 1 }
    const unrated = { username: 'a', ratingAvg: 0, reviewCount: 0 }
    assert.ok(comparePresentersForPopularSort(rated, unrated) < 0)
  })

  it('uses review count as tie-breaker', () => {
    const more = { username: 'a', ratingAvg: 4.0, reviewCount: 8 }
    const fewer = { username: 'b', ratingAvg: 4.0, reviewCount: 2 }
    assert.ok(comparePresentersForPopularSort(more, fewer) < 0)
  })
})
