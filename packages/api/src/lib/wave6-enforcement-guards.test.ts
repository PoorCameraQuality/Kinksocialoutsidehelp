import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

test('hub mutations use requireHubConventionMutation instead of legacy canManage writes', () => {
  const conv = read('routes/conventions-routes.ts')
  assert.ok(conv.includes('requireHubConventionMutation'))
  assert.equal(
    (conv.match(/if \(!resolved\.canManage\) return reply\.status\(403\)/g) ?? []).length,
    0,
  )
  const hubExt = read('routes/convention-hub-ext-routes.ts')
  assert.ok(hubExt.includes('requireHubConventionMutation'))
  assert.ok(!hubExt.includes('canManageConvention'))
  const hubCh = read('routes/convention-hub-channels-routes.ts')
  assert.ok(hubCh.includes('requireHubConventionMutation'))
  assert.ok(!hubCh.includes('canManageConvention'))
})

test('org chat writes enforce scope bans', () => {
  const org = read('routes/organizations.ts')
  const chatPost = org.indexOf("app.post('/api/v1/organizations/:orgKey/channels/:channelId/messages'")
  assert.ok(chatPost > 0)
  const chatBlock = org.slice(chatPost, chatPost + 1200)
  assert.ok(chatBlock.includes("isUserScopeBanned('organization'"))
  const replyPost = org.indexOf(
    "app.post('/api/v1/organizations/:orgKey/channels/:channelId/messages/:messageId/replies'",
  )
  assert.ok(replyPost > 0)
  assert.ok(org.slice(replyPost, replyPost + 800).includes("isUserScopeBanned('organization'"))
})

test('group forum writes enforce bans and locked threads', () => {
  const gf = read('routes/group-forums.ts')
  assert.ok(gf.includes("isUserScopeBanned('group'"))
  assert.ok(gf.includes('Thread is locked'))
})

test('WS subscribe and LiveKit voice enforce org scope bans', () => {
  const ws = read('lib/ws-subscribe-auth.ts')
  assert.ok(ws.includes("isUserScopeBanned('organization'"))
  const lk = read('routes/livekit-voice-routes.ts')
  assert.ok(lk.includes("isUserScopeBanned('organization'"))
})

test('signups PATCH uses resolveCheckInUpdate', () => {
  const orgRoutes = read('routes/convention-organizer-routes.ts')
  assert.ok(orgRoutes.includes('resolveCheckInUpdate'))
  assert.ok(!orgRoutes.includes('computeCheckInEligibility(categoryRow'))
})

test('ConventionPublishActions gates ECKE on bridgeConnected', () => {
  const ui = readFileSync(
    join(root, '../../web/src/components/organizer/ConventionPublishActions.tsx'),
    'utf8',
  )
  assert.ok(ui.includes('bridgeConnected'))
  assert.ok(ui.includes('East Coast Kink Events publish bridge is not connected'))
})
