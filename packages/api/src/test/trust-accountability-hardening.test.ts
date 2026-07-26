/**
 * Alpha hardening - event/convention standing, incident resolution, messaging rollups (DB).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { resolveIncidentFinding } from '../lib/incident-resolution.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import { registerModerationTrustSummaryRoutes } from '../routes/moderation-trust-summary.js'
import { registerScopedStandingRoutes } from '../routes/scoped-standing-routes.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('trust accountability hardening', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let modId: string
  let modUsername: string
  let targetId: string
  let incidentId: string

  after(async () => {
    for (const userId of userIds) {
      await db.delete(schema.trustSignalEvents).where(eq(schema.trustSignalEvents.userId, userId))
      await db.delete(schema.incidentParticipants).where(eq(schema.incidentParticipants.userId, userId))
      await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
    if (incidentId) {
      await db.delete(schema.incidentActions).where(eq(schema.incidentActions.incidentId, incidentId))
      await db.delete(schema.incidentReports).where(eq(schema.incidentReports.incidentId, incidentId))
      await db.delete(schema.moderationIncidents).where(eq(schema.moderationIncidents.id, incidentId))
    }
    invalidatePlatformStaffCache()
  })

  test('seed users and incident', async () => {
    const target = await insertCiUser(`tah_target_${tag}`)
    targetId = target.id
    userIds.push(target.id)

    const mod = await insertCiUser(`tah_mod_${tag}`)
    modId = mod.id
    modUsername = mod.username
    userIds.push(mod.id)
    await db.insert(schema.platformStaff).values({ userId: mod.id, role: 'MODERATOR' })
    invalidatePlatformStaffCache()

    const [inc] = await db
      .insert(schema.moderationIncidents)
      .values({
        primaryUserId: targetId,
        policyReason: 'HARASSMENT_THREATS',
        status: 'OPEN',
      })
      .returning()
    incidentId = inc.id
  })

  test('NO_VIOLATION finding does not create trust signal', async () => {
    const result = await resolveIncidentFinding({
      incidentId,
      finding: 'NO_VIOLATION',
      status: 'CLOSED_NO_VIOLATION',
      reviewedBy: modId,
    })
    assert.equal(result.signalsCreated, 0)
    const signals = await db
      .select()
      .from(schema.trustSignalEvents)
      .where(eq(schema.trustSignalEvents.userId, targetId))
    assert.equal(signals.length, 0)
  })

  test('CONFIRMED_HARASSMENT creates platform mod signal', async () => {
    const [inc2] = await db
      .insert(schema.moderationIncidents)
      .values({
        primaryUserId: targetId,
        policyReason: 'HARASSMENT_THREATS',
        status: 'OPEN',
      })
      .returning()
    const result = await resolveIncidentFinding({
      incidentId: inc2.id,
      finding: 'CONFIRMED_HARASSMENT',
      status: 'RESOLVED',
      reviewedBy: modId,
    })
    assert.equal(result.signalsCreated, 1)
    const [signal] = await db
      .select()
      .from(schema.trustSignalEvents)
      .where(eq(schema.trustSignalEvents.sourceId, inc2.id))
    assert.ok(signal)
    assert.equal(signal.signalType, 'CONFIRMED_HARASSMENT')
    assert.equal(signal.visibility, 'PLATFORM_MOD')
    await db.delete(schema.trustSignalEvents).where(eq(schema.trustSignalEvents.id, signal.id))
    await db.delete(schema.incidentActions).where(eq(schema.incidentActions.incidentId, inc2.id))
    await db.delete(schema.moderationIncidents).where(eq(schema.moderationIncidents.id, inc2.id))
  })

  test('platform mod denied for event standing on random event id', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerScopedStandingRoutes(a)
    })
    const stranger = await insertCiUser(`tah_stranger_${tag}`)
    userIds.push(stranger.id)

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/events/${randomUUID()}/members/${targetId}/standing`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.ok(res.statusCode === 403 || res.statusCode === 404)
  })

  test('trust summary includes trustSignals for platform mod', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerModerationTrustSummaryRoutes(a)
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/moderation/users/${targetId}/trust-summary`,
      headers: cookieHeader(modId, modUsername),
    })
    assert.equal(res.statusCode, 200)
    const body = res.json() as { trustSignals?: { status: string } }
    assert.equal(body.trustSignals?.status, 'available')
  })
})
