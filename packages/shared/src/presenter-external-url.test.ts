import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validatePresenterExternalUrl } from './presenter-external-url.js'

describe('validatePresenterExternalUrl', () => {
  it('accepts HTTPS image URLs', () => {
    const result = validatePresenterExternalUrl('https://cdn.example.com/photo.jpg')
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.href, 'https://cdn.example.com/photo.jpg')
  })

  it('rejects javascript: URLs', () => {
    const result = validatePresenterExternalUrl('javascript:alert(1)')
    assert.equal(result.ok, false)
  })

  it('rejects data: URLs', () => {
    const result = validatePresenterExternalUrl('data:image/png;base64,abc')
    assert.equal(result.ok, false)
  })

  it('rejects file: URLs', () => {
    const result = validatePresenterExternalUrl('file:///etc/passwd')
    assert.equal(result.ok, false)
  })

  it('rejects plain HTTP URLs', () => {
    const result = validatePresenterExternalUrl('http://example.com/a.jpg')
    assert.equal(result.ok, false)
  })

  it('rejects malformed URLs', () => {
    const result = validatePresenterExternalUrl('not-a-url')
    assert.equal(result.ok, false)
  })
})
