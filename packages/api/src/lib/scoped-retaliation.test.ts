import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('scoped retaliation emits review signal type without auto-ban', () => {
  const src = readFileSync(join(root, 'lib/scoped-retaliation.ts'), 'utf8')
  assert.ok(src.includes('ORGANIZER_RETALIATION_REVIEW_RECOMMENDED'))
  assert.ok(!src.includes('identityBans'))
  assert.ok(!src.includes('identity_bans'))
})

test('scoped standing invokes retaliation check on restrictive actions', () => {
  const src = readFileSync(join(root, 'lib/scoped-standing.ts'), 'utf8')
  assert.ok(src.includes('maybeEmitRetaliationReviewSignal'))
})
