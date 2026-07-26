import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { estimateReadingMinutes, sanitizeEducationHtml } from './sanitize-education-body.js'

describe('sanitizeEducationHtml', () => {
  it('preserves TipTap formatting tags', () => {
    const html =
      '<h2>Title</h2><p>Hello <strong>bold</strong> and <em>italic</em></p><ul><li>One</li></ul><ol><li>Two</li></ol>'
    const out = sanitizeEducationHtml(html)
    assert.match(out, /<h2>/)
    assert.match(out, /<strong>bold<\/strong>/)
    assert.match(out, /<em>italic<\/em>/)
    assert.match(out, /<ul>/)
    assert.match(out, /<ol>/)
  })

  it('maps b/i to strong/em', () => {
    const out = sanitizeEducationHtml('<p><b>B</b> <i>I</i></p>')
    assert.match(out, /<strong>B<\/strong>/)
    assert.match(out, /<em>I<\/em>/)
  })

  it('keeps safe images and links', () => {
    const out = sanitizeEducationHtml(
      '<p><a href="https://example.com">link</a></p><img src="https://kink.social/c2k-uploads/edu/x.jpg" alt="demo" />',
    )
    assert.match(out, /href="https:\/\/example\.com"/)
    assert.match(out, /src="https:\/\/kink\.social\/c2k-uploads\/edu\/x\.jpg"/)
  })

  it('allows YouTube embed iframe with safe src', () => {
    const html =
      '<p>Intro</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>'
    const out = sanitizeEducationHtml(html)
    assert.match(out, /youtube\.com\/embed\/dQw4w9WgXcQ/)
    assert.match(out, /<\/iframe>/)
  })

  it('strips unsafe iframe src', () => {
    const html = '<iframe src="https://evil.example/phish"></iframe>'
    assert.equal(sanitizeEducationHtml(html).includes('<iframe'), false)
  })

  it('strips scripts and event handlers', () => {
    const out = sanitizeEducationHtml('<p onclick="alert(1)">Hi</p><script>alert(1)</script>')
    assert.equal(out.includes('script'), false)
    assert.equal(out.includes('onclick'), false)
    assert.match(out, /Hi/)
  })

  it('estimateReadingMinutes returns at least 1', () => {
    assert.equal(estimateReadingMinutes('<p>' + 'word '.repeat(250) + '</p>'), 2)
  })
})
