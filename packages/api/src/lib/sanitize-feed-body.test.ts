import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sanitizeFeedHtml } from './sanitize-feed-body.js'

test('sanitizeFeedHtml strips script tags', () => {
  const out = sanitizeFeedHtml('<p>Hi</p><script>alert(1)</script>')
  assert.equal(out, '<p>Hi</p>')
})

test('sanitizeFeedHtml strips javascript: href', () => {
  const out = sanitizeFeedHtml('<a href="javascript:alert(1)">x</a>')
  assert.equal(out, '<a rel="nofollow noopener noreferrer">x</a>')
})

test('sanitizeFeedHtml allows safe links with rel', () => {
  const out = sanitizeFeedHtml('<a href="https://example.com">link</a>')
  assert.match(out, /href="https:\/\/example\.com"/)
  assert.match(out, /rel="nofollow noopener noreferrer"/)
})

test('sanitizeFeedHtml strips event handlers', () => {
  const out = sanitizeFeedHtml('<p onclick="alert(1)">x</p>')
  assert.equal(out, '<p>x</p>')
})

test('sanitizeFeedHtml keeps TipTap formatting and images', () => {
  const out = sanitizeFeedHtml(
    '<h2>Hi</h2><p><strong>bold</strong> <em>i</em></p><ul><li>a</li></ul><img src="https://cdn.example.com/a.jpg" alt="x" /><hr />',
  )
  assert.match(out, /<h2>/)
  assert.match(out, /<strong>bold<\/strong>/)
  assert.match(out, /<em>i<\/em>/)
  assert.match(out, /<ul>/)
  assert.match(out, /src="https:\/\/cdn\.example\.com\/a\.jpg"/)
  assert.match(out, /<hr\s*\/?>/)
})

test('sanitizeFeedHtml maps b/i to strong/em', () => {
  const out = sanitizeFeedHtml('<p><b>B</b><i>I</i></p>')
  assert.match(out, /<strong>B<\/strong>/)
  assert.match(out, /<em>I<\/em>/)
})
