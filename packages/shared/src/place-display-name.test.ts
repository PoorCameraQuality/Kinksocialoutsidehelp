import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPlaceDisplayName, formatPlaceLocationLabel } from './place-display-name.js'

describe('formatPlaceDisplayName', () => {
  it('strips a single city suffix', () => {
    assert.equal(formatPlaceDisplayName('Fall River city'), 'Fall River')
  })

  it('strips CDP suffix', () => {
    assert.equal(formatPlaceDisplayName('Holbrook CDP'), 'Holbrook')
  })

  it('strips stacked town + city suffixes', () => {
    assert.equal(formatPlaceDisplayName('Easthampton Town city'), 'Easthampton')
    assert.equal(formatPlaceDisplayName('Franklin Town city'), 'Franklin')
  })

  it('leaves already-clean names unchanged', () => {
    assert.equal(formatPlaceDisplayName('Boston'), 'Boston')
    assert.equal(formatPlaceDisplayName('New York'), 'New York')
  })
})

describe('formatPlaceLocationLabel', () => {
  it('formats place and state for display', () => {
    assert.equal(formatPlaceLocationLabel('Holyoke city', 'Massachusetts'), 'Holyoke, Massachusetts')
  })
})
