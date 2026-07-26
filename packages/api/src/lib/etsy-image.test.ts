import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractEtsyListingImageUrl } from './etsy-client.js'

describe('extractEtsyListingImageUrl', () => {
  it('prefers url_570xN then url_fullxfull', () => {
    assert.equal(
      extractEtsyListingImageUrl({ url_570xN: 'https://i.etsystatic.com/a.jpg', url_fullxfull: 'https://i.etsystatic.com/b.jpg' }),
      'https://i.etsystatic.com/a.jpg',
    )
    assert.equal(extractEtsyListingImageUrl({ url_fullxfull: 'https://i.etsystatic.com/b.jpg' }), 'https://i.etsystatic.com/b.jpg')
    assert.equal(extractEtsyListingImageUrl(null), null)
  })
})
