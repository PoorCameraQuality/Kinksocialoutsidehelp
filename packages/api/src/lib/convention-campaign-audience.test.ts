import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCampaignAudienceMode } from './convention-campaign-audience.js'

describe('parseCampaignAudienceMode', () => {
  it('defaults to going_and_interested', () => {
    assert.equal(parseCampaignAudienceMode(null), 'going_and_interested')
    assert.equal(parseCampaignAudienceMode({}), 'going_and_interested')
  })

  it('reads audience / mode keys', () => {
    assert.equal(parseCampaignAudienceMode({ audience: 'going' }), 'going')
    assert.equal(parseCampaignAudienceMode({ mode: 'interested' }), 'interested')
  })

  it('reads rsvpStatuses arrays', () => {
    assert.equal(parseCampaignAudienceMode({ rsvpStatuses: ['going'] }), 'going')
    assert.equal(parseCampaignAudienceMode({ rsvpStatuses: ['maybe'] }), 'interested')
    assert.equal(parseCampaignAudienceMode({ rsvpStatuses: ['going', 'interested'] }), 'going_and_interested')
  })
})
