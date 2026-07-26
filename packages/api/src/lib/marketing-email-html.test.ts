import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  absolutizeMarketingHtmlUrls,
  sanitizeMarketingBodyHtml,
  stripToPlainText,
  wrapMarketingCampaignEmail,
} from './marketing-email-html.js'

describe('marketing-email-html', () => {
  it('absolutizes root-relative upload URLs', () => {
    const html = absolutizeMarketingHtmlUrls(
      '<img src="/c2k-uploads/foo.jpg" /><a href="/api/v1/media/assets/1/content">x</a>',
      'https://kink.social',
    )
    assert.match(html, /https:\/\/kink\.social\/c2k-uploads\/foo\.jpg/)
    assert.match(html, /https:\/\/kink\.social\/api\/v1\/media\/assets\/1\/content/)
  })

  it('strips scripts and keeps safe img/a', () => {
    const out = sanitizeMarketingBodyHtml(
      '<p>Hi<script>alert(1)</script></p><img src="https://kink.social/c2k-uploads/a.jpg" alt="banner" /><a href="javascript:alert(1)">bad</a><a href="https://example.com">ok</a>',
    )
    assert.doesNotMatch(out, /script/i)
    assert.match(out, /https:\/\/kink\.social\/c2k-uploads\/a\.jpg/)
    assert.doesNotMatch(out, /javascript:/i)
    assert.match(out, /https:\/\/example\.com/)
  })

  it('wraps with table layout and plain text fallback', () => {
    const { html, text } = wrapMarketingCampaignEmail({
      subject: 'Hello',
      bodyHtml: '<p>Welcome to <strong>Frostland</strong></p>',
      orgOrEventName: 'Forbidden Frostland',
    })
    assert.match(html, /role="presentation"/)
    assert.match(html, /Forbidden Frostland/)
    assert.match(text, /Welcome to Frostland/)
    assert.equal(stripToPlainText('<p>A<br/>B</p>').includes('A'), true)
  })
})
