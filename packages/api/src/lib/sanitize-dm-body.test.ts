import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { looksLikeHtml, sanitizeDmHtml } from './sanitize-dm-body.js'
import { buildOrganizerCampaignMessageHtml } from './organizer-inbox-campaign.js'

describe('sanitizeDmHtml', () => {
  it('allows images and strips scripts', () => {
    const out = sanitizeDmHtml(
      '<p>Hi</p><script>x</script><img src="https://kink.social/c2k-uploads/a.jpg" alt="a" />',
    )
    assert.doesNotMatch(out, /script/i)
    assert.match(out, /c2k-uploads\/a\.jpg/)
  })

  it('detects html', () => {
    assert.equal(looksLikeHtml('<p>x</p>'), true)
    assert.equal(looksLikeHtml('plain'), false)
  })
})

describe('buildOrganizerCampaignMessageHtml', () => {
  it('includes subject heading and event footer', () => {
    const html = buildOrganizerCampaignMessageHtml({
      subject: 'Hello',
      bodyHtml: '<p>Body</p>',
      eventName: 'Frostland',
    })
    assert.match(html, /<h2>Hello<\/h2>/)
    assert.match(html, /Frostland/)
    assert.match(html, /Body/)
  })
})
