/**
 * LEGAL-ALPHA-1 - DMCA, legal requests, privacy, step-up auth.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import { assertVendorRegistered, resetVendorRegistryCache } from '../lib/vendor-registry-guard.js'
import { registerLegalAlphaRoutes } from '../routes/legal-alpha-routes.js'
import { buildCookieApp, cookieHeader, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('LEGAL-ALPHA-1 API', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const dmcaCaseIds: string[] = []
  const contactInquiryIds: string[] = []
  const legalRequestIds: string[] = []
  const holdIds: string[] = []
  const privacyRequestIds: string[] = []

  let regularId: string
  let regularUsername: string
  let tsAdminId: string
  let tsAdminUsername: string
  let legalAdminId: string
  let legalAdminUsername: string
  let siteAdminId: string
  let siteAdminUsername: string
  const testPassword = 'legal-alpha-test-pw'

  after(async () => {
    for (const id of privacyRequestIds) {
      await db.delete(schema.userPrivacyRequests).where(eq(schema.userPrivacyRequests.id, id))
    }
    for (const id of holdIds) {
      await db.delete(schema.legalHolds).where(eq(schema.legalHolds.id, id))
    }
    for (const id of legalRequestIds) {
      await db.delete(schema.legalRequests).where(eq(schema.legalRequests.id, id))
    }
    for (const id of dmcaCaseIds) {
      await db.delete(schema.dmcaCases).where(eq(schema.dmcaCases.id, id))
    }
    for (const id of contactInquiryIds) {
      await db.delete(schema.contactInquiries).where(eq(schema.contactInquiries.id, id))
    }
    for (const userId of userIds) {
      await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, userId))
      await db.delete(schema.moderationAuditEvents).where(eq(schema.moderationAuditEvents.actorUserId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
    invalidatePlatformStaffCache()
    resetVendorRegistryCache()
  })

  async function insertStaffUser(tagSuffix: string, role: 'TRUST_SAFETY_ADMIN' | 'LEGAL_ADMIN' | 'SITE_ADMIN') {
    const user = await insertCiUser(`la1_${tagSuffix}_${tag}`)
    const hash = await bcrypt.hash(testPassword, 10)
    await db.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, user.id))
    await db.insert(schema.platformStaff).values({ userId: user.id, role })
    userIds.push(user.id)
    return user
  }

  test('seed users and staff roles', async () => {
    const regular = await insertCiUser(`la1_regular_${tag}`)
    regularId = regular.id
    regularUsername = regular.username
    userIds.push(regular.id)

    const ts = await insertStaffUser('ts', 'TRUST_SAFETY_ADMIN')
    tsAdminId = ts.id
    tsAdminUsername = ts.username

    const legal = await insertStaffUser('legal', 'LEGAL_ADMIN')
    legalAdminId = legal.id
    legalAdminUsername = legal.username

    const admin = await insertStaffUser('site', 'SITE_ADMIN')
    siteAdminId = admin.id
    siteAdminUsername = admin.username

    invalidatePlatformStaffCache()
  })

  async function buildApp() {
    ensureCiAuthSecret()
    process.env.USE_DATABASE = 'true'
    return buildCookieApp(registerLegalAlphaRoutes)
  }

  test('public DMCA intake creates RECEIVED case', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/dmca/intake',
      payload: {
        claimantName: 'Test Claimant',
        claimantEmail: 'claimant@example.com',
        workIdentified: 'Original photo series',
        infringingUrl: 'https://c2k.example/media/123',
      },
    })
    assert.equal(r.statusCode, 201)
    const body = r.json() as { case: { id: string; status: string } }
    assert.equal(body.case.status, 'RECEIVED')
    dmcaCaseIds.push(body.case.id)
    await app.close()
  })

  test('public contact intake creates RECEIVED inquiry', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/contact/intake',
      payload: {
        category: 'privacy',
        subject: 'Data question',
        senderName: 'Test Sender',
        senderEmail: 'sender@example.com',
        message: 'Please confirm export timeline.',
      },
    })
    assert.equal(r.statusCode, 201)
    const body = r.json() as { inquiry: { id: string; status: string } }
    assert.equal(body.inquiry.status, 'RECEIVED')
    contactInquiryIds.push(body.inquiry.id)
    await app.close()
  })

  test('regular user forbidden from admin contact list', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/contact/inquiries',
      headers: cookieHeader(regularId, regularUsername),
    })
    assert.equal(r.statusCode, 403)
    await app.close()
  })

  test('regular user forbidden from admin DMCA list', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dmca/cases',
      headers: cookieHeader(regularId, regularUsername),
    })
    assert.equal(r.statusCode, 403)
    await app.close()
  })

  test('TS admin patch requires step-up then succeeds with audit', async () => {
    const app = await buildApp()
    const [dmcaCase] = await db
      .insert(schema.dmcaCases)
      .values({
        claimantName: 'Audit Test',
        claimantEmail: 'a@example.com',
        workIdentified: 'Work',
        infringingUrl: 'https://example.com/x',
        status: 'RECEIVED',
      })
      .returning()
    dmcaCaseIds.push(dmcaCase!.id)

    const blocked = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/dmca/cases/${dmcaCase!.id}`,
      headers: cookieHeader(tsAdminId, tsAdminUsername),
      payload: { status: 'DISABLED', reason: 'test disable' },
    })
    assert.equal(blocked.statusCode, 403)
    assert.equal((blocked.json() as { code?: string }).code, 'step_up_required')

    const stepUp = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/security/step-up',
      headers: cookieHeader(tsAdminId, tsAdminUsername),
      payload: { password: testPassword },
    })
    assert.equal(stepUp.statusCode, 200)

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/dmca/cases/${dmcaCase!.id}`,
      headers: cookieHeader(tsAdminId, tsAdminUsername),
      payload: { status: 'DISABLED', reason: 'test disable' },
    })
    assert.equal(patched.statusCode, 200)

    const audits = await db
      .select()
      .from(schema.moderationAuditEvents)
      .where(
        and(
          eq(schema.moderationAuditEvents.actorUserId, tsAdminId),
          eq(schema.moderationAuditEvents.targetId, dmcaCase!.id)
        )
      )
    assert.ok(audits.some((a) => a.verb === 'dmca_case_update'))
    await app.close()
  })

  test('legal admin can create legal request and hold', async () => {
    const app = await buildApp()

    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/security/step-up',
      headers: cookieHeader(legalAdminId, legalAdminUsername),
      payload: { password: testPassword },
    })

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/legal/requests',
      headers: cookieHeader(legalAdminId, legalAdminUsername),
      payload: {
        requestType: 'subpoena',
        requesterName: 'Agency',
        reason: 'received inbound request',
      },
    })
    assert.equal(created.statusCode, 201)
    const reqId = (created.json() as { request: { id: string } }).request.id
    legalRequestIds.push(reqId)

    const holdRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/legal/requests/${reqId}/holds`,
      headers: cookieHeader(legalAdminId, legalAdminUsername),
      payload: {
        targetType: 'user',
        targetId: regularId,
        reason: 'preserve account data',
      },
    })
    assert.equal(holdRes.statusCode, 201)
    holdIds.push((holdRes.json() as { hold: { id: string } }).hold.id)
    await app.close()
  })

  test('DELETE privacy request blocked under legal hold', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/me/privacy/requests',
      headers: cookieHeader(regularId, regularUsername),
      payload: { requestType: 'DELETE' },
    })
    assert.equal(r.statusCode, 409)
    const body = r.json() as { request: { status: string; id: string } }
    assert.equal(body.request.status, 'BLOCKED_LEGAL_HOLD')
    privacyRequestIds.push(body.request.id)
    await app.close()
  })

  test('export request returns READY payload', async () => {
    const app = await buildApp()
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/me/privacy/requests',
      headers: cookieHeader(siteAdminId, siteAdminUsername),
      payload: { requestType: 'EXPORT_JSON' },
    })
    assert.equal(created.statusCode, 201)
    const reqId = (created.json() as { request: { id: string; status: string } }).request.id
    privacyRequestIds.push(reqId)
    assert.equal((created.json() as { request: { status: string } }).request.status, 'READY')

    const dl = await app.inject({
      method: 'GET',
      url: `/api/v1/me/privacy/export/${reqId}`,
      headers: cookieHeader(siteAdminId, siteAdminUsername),
    })
    assert.equal(dl.statusCode, 200)
    const exp = dl.json() as { export: { version: string } }
    assert.equal(exp.export.version, 'v1')
    await app.close()
  })

  test('vendor registry guard rejects unknown vendor', () => {
    assert.throws(() => assertVendorRegistered('totally_unknown_vendor_xyz'), /not registered/)
  })

  test('policy version endpoint', async () => {
    const app = await buildApp()
    const r = await app.inject({ method: 'GET', url: '/api/v1/legal/policy-version' })
    assert.equal(r.statusCode, 200)
    assert.ok((r.json() as { version: string }).version.length > 0)
    await app.close()
  })
})
