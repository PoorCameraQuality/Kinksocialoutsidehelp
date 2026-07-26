/**
 * Moderation case context link resolution - lightweight tests.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { resolveModerationCaseContextLinks } from '../lib/moderation-case-context.js'

describe('resolveModerationCaseContextLinks', () => {
  test('falls back to snapshot href for unknown target types', async () => {
    const links = await resolveModerationCaseContextLinks('legacy_custom', 'abc', [
      { snapshot: { href: '/orgs/demo-east-collective?tab=Chat' } },
    ])
    assert.deepEqual(links, [
      { label: 'View in context', href: '/orgs/demo-east-collective?tab=Chat' },
    ])
  })

  test('returns empty when no live or snapshot context exists', async () => {
    const links = await resolveModerationCaseContextLinks('legacy_custom', 'missing', [])
    assert.deepEqual(links, [])
  })
})
