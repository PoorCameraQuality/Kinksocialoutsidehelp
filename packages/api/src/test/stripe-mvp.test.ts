/**
 * Stripe Connect MVP — signature reject, auth gates, optional DB paidConfirmed idempotency.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, describe, test } from 'node:test'
import { and, eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import { db, schema } from '../db/index.js'
import { resetStripeClientForTests } from '../lib/stripe.js'
import { registerStripeConnectOrgRoutes } from '../routes/stripe-connect-org.js'
import { registerStripeConnectVendorRoutes } from '../routes/stripe-connect-vendor.js'
import { registerStripeCheckoutRoutes } from '../routes/stripe-checkout-routes.js'
import { registerStripeWebhookRoutes } from '../routes/stripe-webhooks.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

const runDb = runDbIntegration || process.env.USE_DATABASE === 'true'

describe('stripe connect auth gates', () => {
  const prevSecret = process.env.STRIPE_SECRET_KEY
  const prevWh = process.env.STRIPE_WEBHOOK_SECRET

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prevSecret
    if (prevWh === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
    else process.env.STRIPE_WEBHOOK_SECRET = prevWh
    resetStripeClientForTests()
  })

  test('status returns 401 without session', async () => {
    delete process.env.STRIPE_SECRET_KEY
    resetStripeClientForTests()
    const app = await buildCookieApp(async (a) => {
      await registerStripeConnectOrgRoutes(a)
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations/demo-org/stripe/status',
    })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('connect returns 503 without STRIPE_SECRET_KEY when authenticated', async () => {
    delete process.env.STRIPE_SECRET_KEY
    resetStripeClientForTests()
    ensureCiAuthSecret()
    const userId = randomUUID()
    const app = await buildCookieApp(async (a) => {
      await registerStripeConnectOrgRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/demo-org/stripe/connect',
      headers: {
        ...cookieHeader(userId, `stripe_user_${userId.slice(0, 8)}`),
        'content-type': 'application/json',
      },
      payload: {},
    })
    assert.equal(res.statusCode, 503)
    const body = res.json() as { code?: string }
    assert.equal(body.code, 'stripe_not_configured')
    await app.close()
  })
})

describe('stripe webhook signature', () => {
  const prevSecret = process.env.STRIPE_SECRET_KEY
  const prevWh = process.env.STRIPE_WEBHOOK_SECRET

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prevSecret
    if (prevWh === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
    else process.env.STRIPE_WEBHOOK_SECRET = prevWh
    resetStripeClientForTests()
  })

  test('rejects missing stripe-signature', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_fixture_not_real'
    resetStripeClientForTests()
    const app = await buildCookieApp(async (a) => {
      await registerStripeWebhookRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: Buffer.from('{}'),
    })
    assert.equal(res.statusCode, 400)
    await app.close()
  })

  test('rejects invalid signature', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_fixture_not_real'
    resetStripeClientForTests()
    const app = await buildCookieApp(async (a) => {
      await registerStripeWebhookRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1,v1=deadbeef',
      },
      payload: Buffer.from('{"id":"evt_test"}'),
    })
    assert.equal(res.statusCode, 400)
    const body = res.json() as { error?: string }
    assert.equal(body.error, 'Invalid signature')
    await app.close()
  })
})

describe('stripe webhook paidConfirmed idempotency', { skip: !runDb }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let orgId = ''
  let conventionId = ''
  let attendeeId = ''
  const prevSecret = process.env.STRIPE_SECRET_KEY
  const prevWh = process.env.STRIPE_WEBHOOK_SECRET
  const whSecret = 'whsec_ci_stripe_mvp_not_real'

  after(async () => {
    if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prevSecret
    if (prevWh === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
    else process.env.STRIPE_WEBHOOK_SECRET = prevWh
    resetStripeClientForTests()
    if (conventionId) {
      await db
        .delete(schema.conventionAccessGrants)
        .where(eq(schema.conventionAccessGrants.conventionId, conventionId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, conventionId))
    }
    if (orgId) {
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    }
    for (const id of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, id))
    }
  })

  test('valid checkout.session.completed sets paidConfirmed once; duplicate event is no-op', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    process.env.STRIPE_WEBHOOK_SECRET = whSecret
    resetStripeClientForTests()

    const owner = await insertCiUser(`stripe_own_${tag}`)
    const attendee = await insertCiUser(`stripe_att_${tag}`)
    userIds.push(owner.id, attendee.id)
    attendeeId = attendee.id

    orgId = randomUUID()
    conventionId = randomUUID()
    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `stripe-org-${tag}`,
      displayName: `Stripe Org ${tag}`,
      ownerId: owner.id,
    })
    await db.insert(schema.conventions).values({
      id: conventionId,
      organizationId: orgId,
      slug: `stripe-con-${tag}`,
      name: `Stripe Con ${tag}`,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000),
    })

    const sessionId = `cs_test_${tag}`
    const eventId = `evt_test_${tag}`
    await db.insert(schema.stripeCheckoutSessions).values({
      orgId,
      userId: attendeeId,
      conventionId,
      stripeSessionId: sessionId,
      stripeAccountId: 'acct_test_platform_bound',
      mode: 'payment',
      status: 'open',
      amountCents: 2500,
      currency: 'usd',
    })
    const payloadObj = {
      id: eventId,
      object: 'event',
      type: 'checkout.session.completed',
      account: 'acct_test_platform_bound',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          status: 'complete',
          metadata: {
            c2k_mode: 'ticket',
            c2k_org_id: orgId,
            c2k_user_id: attendeeId,
            c2k_convention_id: conventionId,
          },
          client_reference_id: attendeeId,
        },
      },
    }
    const payload = JSON.stringify(payloadObj)
    const stripe = new Stripe('sk_test_unit_fixture_not_real')
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: whSecret,
    })

    const app = await buildCookieApp(async (a) => {
      await registerStripeWebhookRoutes(a)
    })

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: Buffer.from(payload),
    })
    assert.equal(first.statusCode, 200)
    assert.equal((first.json() as { received?: boolean }).received, true)

    const [grant] = await db
      .select({
        paidConfirmed: schema.conventionAccessGrants.paidConfirmed,
      })
      .from(schema.conventionAccessGrants)
      .where(
        and(
          eq(schema.conventionAccessGrants.conventionId, conventionId),
          eq(schema.conventionAccessGrants.userId, attendeeId),
        ),
      )
      .limit(1)
    assert.ok(grant)
    assert.equal(grant.paidConfirmed, true)

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: Buffer.from(payload),
    })
    assert.equal(second.statusCode, 200)
    assert.equal((second.json() as { duplicate?: boolean }).duplicate, true)

    const grants = await db
      .select({ id: schema.conventionAccessGrants.id })
      .from(schema.conventionAccessGrants)
      .where(
        and(
          eq(schema.conventionAccessGrants.conventionId, conventionId),
          eq(schema.conventionAccessGrants.userId, attendeeId),
        ),
      )
    assert.equal(grants.length, 1)

    await db.delete(schema.stripeWebhookEvents).where(eq(schema.stripeWebhookEvents.stripeEventId, eventId))
    await db
      .delete(schema.stripeCheckoutSessions)
      .where(eq(schema.stripeCheckoutSessions.stripeSessionId, sessionId))
    await app.close()
  })

  test('forged checkout.session.completed metadata without session row does not grant access', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    process.env.STRIPE_WEBHOOK_SECRET = whSecret
    resetStripeClientForTests()

    const owner = await insertCiUser(`stripe_fg_own_${tag}`)
    const victim = await insertCiUser(`stripe_fg_vic_${tag}`)
    userIds.push(owner.id, victim.id)

    const forgedOrgId = randomUUID()
    const forgedConvId = randomUUID()
    await db.insert(schema.organizations).values({
      id: forgedOrgId,
      slug: `stripe-forge-${tag}`,
      displayName: `Forge Org ${tag}`,
      ownerId: owner.id,
    })
    await db.insert(schema.conventions).values({
      id: forgedConvId,
      organizationId: forgedOrgId,
      slug: `stripe-forge-con-${tag}`,
      name: `Forge Con ${tag}`,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000),
    })

    const sessionId = `cs_forge_${tag}`
    const eventId = `evt_forge_${tag}`
    const payloadObj = {
      id: eventId,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          status: 'complete',
          metadata: {
            c2k_mode: 'ticket',
            c2k_org_id: forgedOrgId,
            c2k_user_id: victim.id,
            c2k_convention_id: forgedConvId,
          },
          client_reference_id: victim.id,
        },
      },
    }
    const payload = JSON.stringify(payloadObj)
    const stripe = new Stripe('sk_test_unit_fixture_not_real')
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: whSecret,
    })

    const app = await buildCookieApp(async (a) => {
      await registerStripeWebhookRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: Buffer.from(payload),
    })
    assert.equal(res.statusCode, 200)

    const grants = await db
      .select({ id: schema.conventionAccessGrants.id })
      .from(schema.conventionAccessGrants)
      .where(
        and(
          eq(schema.conventionAccessGrants.conventionId, forgedConvId),
          eq(schema.conventionAccessGrants.userId, victim.id),
        ),
      )
    assert.equal(grants.length, 0)

    await db.delete(schema.stripeWebhookEvents).where(eq(schema.stripeWebhookEvents.stripeEventId, eventId))
    await db.delete(schema.conventionAccessGrants).where(eq(schema.conventionAccessGrants.conventionId, forgedConvId))
    await db.delete(schema.conventions).where(eq(schema.conventions.id, forgedConvId))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, forgedOrgId))
    await app.close()
  })
})

describe('stripe connect org role gate', { skip: !runDb }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let orgId = ''
  const prevSecret = process.env.STRIPE_SECRET_KEY

  after(async () => {
    if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prevSecret
    resetStripeClientForTests()
    if (orgId) {
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    }
    for (const id of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, id))
    }
  })

  test('admin without can_manage_payments gets 403; grant + vault then 200; owner can PATCH processor', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    resetStripeClientForTests()

    const owner = await insertCiUser(`st_own_${tag}`)
    const admin = await insertCiUser(`st_adm_${tag}`)
    userIds.push(owner.id, admin.id)
    orgId = randomUUID()
    const slug = `stripe-role-${tag}`
    await db.insert(schema.organizations).values({
      id: orgId,
      slug,
      displayName: `Stripe Role ${tag}`,
      ownerId: owner.id,
    })
    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: owner.id,
      role: 'OWNER',
    })
    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: admin.id,
      role: 'ADMIN',
      canManagePayments: false,
    })

    const app = await buildCookieApp(async (a) => {
      await registerStripeConnectOrgRoutes(a)
    })

    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${slug}/stripe/status`,
      headers: cookieHeader(admin.id, admin.username),
    })
    assert.equal(forbidden.statusCode, 403)

    await db
      .update(schema.users)
      .set({
        paymentsVaultPasswordHash: await bcrypt.hash('vault-pass-owner1', 12),
        paymentsVaultUnlockedAt: new Date(),
      })
      .where(eq(schema.users.id, owner.id))

    const grant = await app.inject({
      method: 'PUT',
      url: `/api/v1/organizations/${slug}/payments/managers/${admin.id}`,
      headers: {
        ...cookieHeader(owner.id, owner.username),
        'content-type': 'application/json',
      },
      payload: { canManage: true },
    })
    assert.equal(grant.statusCode, 200)

    const adminLocked = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${slug}/stripe/status`,
      headers: cookieHeader(admin.id, admin.username),
    })
    assert.equal(adminLocked.statusCode, 403)
    assert.equal((adminLocked.json() as { code?: string }).code, 'payments_vault_setup_required')

    await db
      .update(schema.users)
      .set({
        paymentsVaultPasswordHash: await bcrypt.hash('vault-pass-admin1', 12),
        paymentsVaultUnlockedAt: new Date(),
      })
      .where(eq(schema.users.id, admin.id))

    const allowed = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${slug}/stripe/status`,
      headers: cookieHeader(admin.id, admin.username),
    })
    assert.equal(allowed.statusCode, 200)
    const body = allowed.json() as { processor?: string; isOwner?: boolean }
    assert.equal(body.processor, 'stripe')
    assert.equal(body.isOwner, false)

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${slug}/payments`,
      headers: {
        ...cookieHeader(owner.id, owner.username),
        'content-type': 'application/json',
      },
      payload: { processor: 'external', externalPaymentUrl: 'https://example.com/tickets' },
    })
    assert.equal(patch.statusCode, 200)
    const patched = patch.json() as { payments?: { processor?: string } }
    assert.equal(patched.payments?.processor, 'external')

    const xss = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${slug}/payments`,
      headers: {
        ...cookieHeader(owner.id, owner.username),
        'content-type': 'application/json',
      },
      payload: { externalPaymentUrl: 'javascript:alert(1)' },
    })
    assert.equal(xss.statusCode, 400)

    await app.close()
  })
})

describe('stripe vendor connect auth gates', () => {
  const prevSecret = process.env.STRIPE_SECRET_KEY

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prevSecret
    resetStripeClientForTests()
  })

  test('vendor status returns 401 without session', async () => {
    delete process.env.STRIPE_SECRET_KEY
    resetStripeClientForTests()
    const app = await buildCookieApp(async (a) => {
      await registerStripeConnectVendorRoutes(a)
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vendors/me/stripe/status',
    })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('vendor connect returns 503 without STRIPE_SECRET_KEY when authenticated', async () => {
    delete process.env.STRIPE_SECRET_KEY
    resetStripeClientForTests()
    ensureCiAuthSecret()
    const userId = randomUUID()
    const app = await buildCookieApp(async (a) => {
      await registerStripeConnectVendorRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vendors/me/stripe/connect',
      headers: {
        ...cookieHeader(userId, `stripe_v_${userId.slice(0, 8)}`),
        'content-type': 'application/json',
      },
      payload: {},
    })
    assert.equal(res.statusCode, 503)
    assert.equal((res.json() as { code?: string }).code, 'stripe_not_configured')
    await app.close()
  })
})

describe('stripe event_ticket webhook paidConfirmed', { skip: !runDb }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let orgId = ''
  let eventId = ''
  let attendeeId = ''
  const prevSecret = process.env.STRIPE_SECRET_KEY
  const prevWh = process.env.STRIPE_WEBHOOK_SECRET
  const whSecret = 'whsec_ci_stripe_event_not_real'

  after(async () => {
    if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prevSecret
    if (prevWh === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
    else process.env.STRIPE_WEBHOOK_SECRET = prevWh
    resetStripeClientForTests()
    if (eventId) {
      await db.delete(schema.stripeCheckoutSessions).where(eq(schema.stripeCheckoutSessions.eventId, eventId))
      await db.delete(schema.eventRsvps).where(eq(schema.eventRsvps.eventId, eventId))
      await db.delete(schema.events).where(eq(schema.events.id, eventId))
    }
    if (orgId) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    }
    for (const id of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, id))
    }
  })

  test('event_ticket checkout.session.completed sets event_rsvps.paid_confirmed', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    process.env.STRIPE_WEBHOOK_SECRET = whSecret
    resetStripeClientForTests()

    const owner = await insertCiUser(`ev_own_${tag}`)
    const attendee = await insertCiUser(`ev_att_${tag}`)
    userIds.push(owner.id, attendee.id)
    attendeeId = attendee.id
    orgId = randomUUID()
    eventId = randomUUID()
    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ev-org-${tag}`,
      displayName: `Event Org ${tag}`,
      ownerId: owner.id,
    })
    await db.insert(schema.events).values({
      id: eventId,
      title: `Paid munch ${tag}`,
      hostId: owner.id,
      organizationId: orgId,
      startsAt: new Date(Date.now() + 86400000),
      priceCents: 1500,
    })

    const stripeEventId = `evt_ev_${tag}`
    const checkoutSessionId = `cs_ev_${tag}`
    await db.insert(schema.stripeCheckoutSessions).values({
      orgId,
      userId: attendeeId,
      eventId,
      stripeSessionId: checkoutSessionId,
      stripeAccountId: 'acct_test_event_bound',
      mode: 'payment',
      status: 'open',
      amountCents: 1500,
      currency: 'usd',
    })
    const payloadObj = {
      id: stripeEventId,
      object: 'event',
      type: 'checkout.session.completed',
      account: 'acct_test_event_bound',
      data: {
        object: {
          id: checkoutSessionId,
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          status: 'complete',
          metadata: {
            c2k_mode: 'event_ticket',
            c2k_org_id: orgId,
            c2k_user_id: attendeeId,
            c2k_event_id: eventId,
          },
          client_reference_id: attendeeId,
        },
      },
    }
    const payload = JSON.stringify(payloadObj)
    const stripe = new Stripe('sk_test_unit_fixture_not_real')
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: whSecret,
    })

    const app = await buildCookieApp(async (a) => {
      await registerStripeWebhookRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      payload: Buffer.from(payload),
    })
    assert.equal(res.statusCode, 200)

    const [rsvp] = await db
      .select({
        paidConfirmed: schema.eventRsvps.paidConfirmed,
        status: schema.eventRsvps.status,
      })
      .from(schema.eventRsvps)
      .where(
        and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, attendeeId)),
      )
      .limit(1)
    assert.ok(rsvp)
    assert.equal(rsvp.paidConfirmed, true)
    assert.equal(rsvp.status, 'going')

    await db.delete(schema.stripeWebhookEvents).where(eq(schema.stripeWebhookEvents.stripeEventId, stripeEventId))
    await db
      .delete(schema.stripeCheckoutSessions)
      .where(eq(schema.stripeCheckoutSessions.stripeSessionId, checkoutSessionId))
    await app.close()
  })
})

describe('stripe event checkout org gate', { skip: !runDb }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let eventId = ''
  const prevSecret = process.env.STRIPE_SECRET_KEY

  after(async () => {
    if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prevSecret
    resetStripeClientForTests()
    if (eventId) {
      await db.delete(schema.events).where(eq(schema.events.id, eventId))
    }
    for (const id of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, id))
    }
  })

  test('event checkout without organizationId returns event_not_org_owned', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    resetStripeClientForTests()
    const host = await insertCiUser(`ev_host_${tag}`)
    const buyer = await insertCiUser(`ev_buy_${tag}`)
    userIds.push(host.id, buyer.id)
    eventId = randomUUID()
    await db.insert(schema.events).values({
      id: eventId,
      title: `Solo event ${tag}`,
      hostId: host.id,
      organizationId: null,
      startsAt: new Date(Date.now() + 86400000),
      priceCents: 2000,
    })

    const app = await buildCookieApp(async (a) => {
      await registerStripeCheckoutRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${eventId}/checkout`,
      headers: {
        ...cookieHeader(buyer.id, buyer.username),
        'content-type': 'application/json',
      },
      payload: {},
    })
    assert.equal(res.statusCode, 400)
    assert.equal((res.json() as { code?: string }).code, 'event_not_org_owned')
    await app.close()
  })
})
