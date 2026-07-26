import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('peer-reputation.ts does not auto-insert identity bans from peer votes', () => {
  const src = readFileSync(join(root, 'lib/peer-reputation.ts'), 'utf8')
  assert.ok(!src.includes('insert(schema.identityBans)'))
  assert.ok(!src.includes('profileReputationEvents'))
  assert.ok(!src.includes('maybeBanForNegativeTrust'))
  assert.ok(src.includes('deprecated'))
  assert.ok(src.includes('checkIdentityBan'))
})

test('peer-reputation routes return 410 Gone', () => {
  const src = readFileSync(join(root, 'routes/peer-reputation-routes.ts'), 'utf8')
  assert.ok(src.includes('410'))
  assert.ok(src.includes('peer_reputation_deprecated'))
  assert.ok(!src.includes('applyPeerReputationVote'))
})

test('public feed serializers omit authorTrustScore', () => {
  const feed = readFileSync(join(root, 'routes/feed-routes.ts'), 'utf8')
  const bookmarks = readFileSync(join(root, 'routes/bookmark-routes.ts'), 'utf8')
  const following = readFileSync(join(root, 'lib/feed-following.ts'), 'utf8')
  const refs = readFileSync(join(root, 'routes/profile-references.ts'), 'utf8')
  assert.ok(!feed.includes('authorTrustScore'))
  assert.ok(!bookmarks.includes('authorTrustScore'))
  assert.ok(!following.includes('authorTrustScore'))
  assert.ok(!refs.includes('referrerTrustScore'))
})
