import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, it } from 'node:test'
import { db, schema } from '../db/index.js'
import { redeemOrganizationClaimToken } from '../lib/org-claim.js'
import {
  buildCookieApp,
  cookieHeader,
  deleteUsers,
  ensureCiAuthSecret,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('organization claim redeem', { skip: !runDbIntegration }, () => {
  ensureCiAuthSecret()

  it('transfers ownership and removes bootstrap operator', async () => {
    const operatorId = randomUUID()
    const claimerId = randomUUID()
    const orgId = randomUUID()
    const token = `claim_${randomUUID().replace(/-/g, '')}`

    const operator = await insertCiUser('claim_op', operatorId)
    const claimer = await insertCiUser('claim_new', claimerId)

    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-claim-org-${orgId.slice(0, 8)}`,
      displayName: 'CI Claim Org',
      ownerId: operatorId,
      visibility: 'PUBLIC',
    })
    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: operatorId,
      role: 'OWNER',
    })
    const expiresAt = new Date(Date.now() + 60_000)
    await db.insert(schema.organizationClaimTokens).values({
      organizationId: orgId,
      token,
      createdByUserId: operatorId,
      expiresAt,
    })

    const result = await redeemOrganizationClaimToken({ token, claimerUserId: claimerId })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.alreadyOwner, false)

    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    assert.equal(org?.ownerId, claimerId)

    const members = await db
      .select()
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.organizationId, orgId))
    assert.equal(members.length, 1)
    assert.equal(members[0]?.userId, claimerId)
    assert.equal(members[0]?.role, 'OWNER')

    const [invite] = await db
      .select()
      .from(schema.organizationClaimTokens)
      .where(eq(schema.organizationClaimTokens.token, token))
      .limit(1)
    assert.ok(invite?.redeemedAt)
    assert.equal(invite?.redeemedByUserId, claimerId)

    await db.delete(schema.organizationClaimTokens).where(eq(schema.organizationClaimTokens.organizationId, orgId))
    await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    await deleteUsers([operatorId, claimerId])
  })

  it('rejects redeem when org already claimed by someone else', async () => {
    const bootstrapId = randomUUID()
    const currentOwnerId = randomUUID()
    const claimerId = randomUUID()
    const orgId = randomUUID()
    const token = `claim_${randomUUID().replace(/-/g, '')}`

    await insertCiUser('boot', bootstrapId)
    await insertCiUser('owner', currentOwnerId)
    await insertCiUser('try', claimerId)

    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-claimed-org-${orgId.slice(0, 8)}`,
      displayName: 'Already claimed',
      ownerId: currentOwnerId,
      visibility: 'PUBLIC',
    })
    await db.insert(schema.organizationClaimTokens).values({
      organizationId: orgId,
      token,
      createdByUserId: bootstrapId,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await redeemOrganizationClaimToken({ token, claimerUserId: claimerId })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.status, 409)

    await db.delete(schema.organizationClaimTokens).where(eq(schema.organizationClaimTokens.organizationId, orgId))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    await deleteUsers([bootstrapId, currentOwnerId, claimerId])
  })

  it('HTTP mint + redeem flow', async () => {
    const operatorId = randomUUID()
    const claimerId = randomUUID()
    const orgId = randomUUID()
    const orgSlug = `ci-http-claim-${orgId.slice(0, 8)}`

    const operator = await insertCiUser('http_op', operatorId)
    const claimer = await insertCiUser('http_claim', claimerId)

    await db.insert(schema.organizations).values({
      id: orgId,
      slug: orgSlug,
      displayName: 'HTTP Claim Org',
      ownerId: operatorId,
      visibility: 'PUBLIC',
    })
    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: operatorId,
      role: 'OWNER',
    })

    const app = await buildCookieApp(async (a) => {
      const { registerOrgClaimRoutes } = await import('../routes/org-claim-routes.js')
      await registerOrgClaimRoutes(a)
    })

    try {
      const mint = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgSlug}/claim-tokens`,
        headers: { ...cookieHeader(operatorId, operator.username), 'content-type': 'application/json' },
        payload: { expiresInHours: 24 },
      })
      assert.equal(mint.statusCode, 200)
      const token = (mint.json() as { invite: { token: string } }).invite.token
      assert.ok(token.length >= 16)

      const redeem = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/claim/redeem',
        headers: { ...cookieHeader(claimerId, claimer.username), 'content-type': 'application/json' },
        payload: { token },
      })
      assert.equal(redeem.statusCode, 200)
      assert.equal((redeem.json() as { organizationSlug: string }).organizationSlug, orgSlug)
    } finally {
      await db.delete(schema.organizationClaimTokens).where(eq(schema.organizationClaimTokens.organizationId, orgId))
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
      await deleteUsers([operatorId, claimerId])
    }
  })
})
