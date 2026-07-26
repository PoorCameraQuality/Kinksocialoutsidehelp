import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('incident resolution maps findings to trust_signal_events', () => {
  const src = readFileSync(join(root, 'lib/incident-resolution.ts'), 'utf8')
  assert.ok(src.includes('trust_signal_events') || src.includes('trustSignalEvents'))
  assert.ok(src.includes('NO_VIOLATION'))
  assert.ok(src.includes('CONFIRMED_HARASSMENT'))
  assert.ok(!src.includes('PUBLIC_POSITIVE'))
})

test('incident resolution route is platform-mod gated', () => {
  const routes = readFileSync(join(root, 'routes/moderation-trust-summary.ts'), 'utf8')
  assert.ok(routes.includes('registerIncidentResolutionRoutes'))
  assert.ok(routes.includes('requirePlatformModerator'))
})

test('messaging health no longer hardcodes contact-after counts to zero', () => {
  const src = readFileSync(join(root, 'lib/messaging-health.ts'), 'utf8')
  assert.ok(!src.includes('const blockAfterContactCount = 0'))
  assert.ok(src.includes('schema.blocks'))
  assert.ok(src.includes('schema.mutes'))
})
