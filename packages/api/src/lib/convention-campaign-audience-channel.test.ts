import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parseCampaignDeliveryChannel } from './convention-campaign-audience.js'

describe('parseCampaignDeliveryChannel', () => {
  test('defaults to inbox', () => {
    assert.equal(parseCampaignDeliveryChannel(null), 'inbox')
    assert.equal(parseCampaignDeliveryChannel({}), 'inbox')
  })

  test('reads deliveryChannel and channel aliases', () => {
    assert.equal(parseCampaignDeliveryChannel({ deliveryChannel: 'email' }), 'email')
    assert.equal(parseCampaignDeliveryChannel({ channel: 'both' }), 'both')
    assert.equal(parseCampaignDeliveryChannel({ deliveryChannel: 'inbox' }), 'inbox')
  })
})
