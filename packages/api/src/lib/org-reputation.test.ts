import assert from 'node:assert/strict'

import test from 'node:test'

import { compositeOrgRating } from './org-reputation.js'



test('compositeOrgRating returns 0 when fewer than 3 public reviews', () => {

  assert.equal(compositeOrgRating(4.8, 2, 4.5, 10), 0)

})



test('compositeOrgRating blends 70/30 between 3 and 9 reviews', () => {

  const rating = compositeOrgRating(5, 5, 3, 8)

  assert.ok(Math.abs(rating - (0.7 * 5 + 0.3 * 3)) < 0.001)

})



test('compositeOrgRating blends 85/15 at 10+ reviews', () => {

  const rating = compositeOrgRating(5, 12, 3, 8)

  assert.ok(Math.abs(rating - (0.85 * 5 + 0.15 * 3)) < 0.001)

})


