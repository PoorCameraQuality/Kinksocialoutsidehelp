import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const communityTrustSrc = readFileSync(join(root, 'lib/community-trust.ts'), 'utf8')
const communityTrustRoutesSrc = readFileSync(join(root, 'routes/community-trust-routes.ts'), 'utf8')
const trustIntegritySrc = readFileSync(join(root, 'lib/trust-integrity-signals.ts'), 'utf8')
const moderationPanelSrc = readFileSync(
  join(root, '../../web/src/components/moderation/ModerationTrustSummaryPanel.tsx'),
  'utf8',
)

test('public Community Trust response omits negative accountability fields', () => {
  assert.match(communityTrustSrc, /references:\s*\{/)
  assert.doesNotMatch(communityTrustSrc, /trust_score/)
  assert.doesNotMatch(communityTrustSrc, /blockedByUsersCount/)
  assert.doesNotMatch(communityTrustSrc, /reportCount/)
  assert.doesNotMatch(communityTrustRoutesSrc, /trustSignals/)
})

test('anti-gaming signals stay mod-only', () => {
  assert.match(trustIntegritySrc, /PLATFORM_MOD/)
  assert.doesNotMatch(moderationPanelSrc, /blockedByUsersCount.*public/i)
  assert.match(moderationPanelSrc, /Reputation integrity signals/)
})
