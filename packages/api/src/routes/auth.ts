import {
  AGE_VERIFICATION_STATUSES,
  CURRENT_POLICY_VERSION,
  defaultFeedSettings,
  defaultNotificationSettings,
  defaultPrivacySettings,
  isStrictScannerRuntime,
} from '@c2k/shared'
import { createHash, timingSafeEqual } from 'node:crypto'
import {
  encodeSession,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from '@c2k/shared/session-token'
import bcrypt from 'bcryptjs'
import { count, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { validatePublicUsername } from '@c2k/shared'
import { getMockPersonByUsername } from '../data/mock-seeds.js'
import { db, schema } from '../db/index.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { rateLimitRoute, passwordResetIdentifierKey } from '../lib/rate-limit-config.js'
import {
  isPgUniqueViolation,
  LOGIN_LOCKOUT_MESSAGE,
  loginLockoutStore,
  REGISTER_CONFLICT_MESSAGE,
} from '../lib/login-lockout.js'
import { registrationIpPrefixFromRequest } from '../lib/client-ip.js'
import { checkIdentityBan, isUserIdentityBanned } from '../lib/peer-reputation.js'
import { changePasswordForUser } from '../lib/change-password.js'
import {
  confirmPasswordReset,
  PASSWORD_RESET_GENERIC_MESSAGE,
  requestPasswordReset,
} from '../lib/password-reset.js'
import { isPasswordResetEnabled } from '../lib/mail-config.js'
import {
  incrementUserSessionVersion,
  loadUserSessionVersion,
  sessionPayloadForUser,
  sessionVersionMatches,
} from '../auth/session-version.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { isProductionRuntime } from '../lib/production-guard.js'
import { findUserByLoginIdentifier, getEmailFromUserRow, prepareEmailStorage } from '../lib/user-email.js'
import { sendAccountWelcomeEmail } from '../lib/transactional-email.js'
import { dbUnavailablePayload, isDbConnectionError } from '../lib/db-connection-error.js'

const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

/**
 * Precomputed bcrypt hash used when no user row exists so login timing does not
 * leak account existence (same cost path as a real password compare).
 */
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('__c2k_login_timing_dummy__', 12)

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireAuthSecret(reply: FastifyReply): boolean {
  if (isProductionRuntime() && !process.env.AUTH_SECRET?.trim()) {
    reply.status(500).send({ error: 'AUTH_SECRET is not set' })
    return false
  }
  return true
}

function sessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    // Secure on production + staging (HTTPS runtimes), not only NODE_ENV=production.
    secure: isStrictScannerRuntime(),
    ...(maxAge !== undefined ? { maxAge } : {}),
  }
}

/** Constant-time invite compare (via digests) so length mismatches do not short-circuit. */
function secretsEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(60 * 60 * 24 * 7),
  })
}

/**
 * In-route session revocation check for the `/api/auth/` endpoints exempted
 * from the global enforcement hook (launch-hardening PR 3, A2). A revoked or
 * banned session must report `authenticated: false` and never leak email.
 * Fails closed for non-UUID subs (A8).
 */
async function isSessionRevoked(payload: SessionPayload): Promise<boolean> {
  const userId = getViewerUserId(payload)
  if (!userId) return true
  if (await isUserIdentityBanned(userId)) return true
  const dbSessionVersion = await loadUserSessionVersion(userId)
  return !sessionVersionMatches(payload, dbSessionVersion)
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/session', async (req, reply) => {
    if (!requireAuthSecret(reply)) return
    const r = resolveViewerFromRequest(req)
    let email: string | null = null
    let displayName: string | null = null
    if (r.authenticated && r.payload?.sub && useDatabase()) {
      try {
        if (await isSessionRevoked(r.payload)) {
          return reply.send({
            authenticated: false,
            username: null,
            fallback: r.fallback,
            userId: null,
            email: null,
            displayName: null,
          })
        }
        const uid = r.payload.sub
        const [row] = await db
          .select({
            email: schema.users.email,
            emailCiphertext: schema.users.emailCiphertext,
            emailKeyVersion: schema.users.emailKeyVersion,
            displayName: schema.profiles.displayName,
            deletedAt: schema.users.deletedAt,
          })
          .from(schema.users)
          .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
          .where(eq(schema.users.id, uid))
          .limit(1)
        if (row?.deletedAt) {
          return reply.send({
            authenticated: false,
            username: null,
            fallback: r.fallback,
            userId: null,
            email: null,
            displayName: null,
          })
        }
        if (row) {
          email = getEmailFromUserRow(row)
          displayName = row.displayName ?? null
        }
      } catch (err) {
        // Fail closed: never report authenticated when ban/sessionVersion/profile
        // lookups error (avoids treating a broken DB as a live session).
        req.log.error({ err }, 'GET /api/auth/session profile lookup failed')
        return reply.send({
          authenticated: false,
          username: null,
          fallback: r.fallback,
          userId: null,
          email: null,
          displayName: null,
        })
      }
    }
    return reply.send({
      authenticated: r.authenticated,
      username: r.username,
      fallback: r.fallback,
      userId: r.authenticated ? (r.payload?.sub ?? null) : null,
      email,
      displayName,
    })
  })

  app.post('/api/auth/session', { ...rateLimitRoute('login') }, async (req, reply) => {
    if (!requireAuthSecret(reply)) return

    const body = req.body as { username?: unknown; password?: unknown } | null
    if (body === null || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Invalid JSON' })
    }

    const loginIdentifier = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!loginIdentifier || !password) {
      return reply.status(400).send({ error: 'Username or email and password required' })
    }
    if (password.length > 128) {
      return reply.status(400).send({ error: 'Invalid credentials' })
    }

    if (useDatabase()) {
      try {
        if (await checkIdentityBan(req)) {
          return reply.status(403).send({ error: 'Access denied' })
        }
        const lockedForMs = loginLockoutStore.remainingLockMs(loginIdentifier)
        if (lockedForMs > 0) {
          // Still burn a bcrypt compare so lockout responses match failure timing.
          await bcrypt.compare(password, DUMMY_BCRYPT_HASH)
          reply.header('Retry-After', String(Math.max(1, Math.ceil(lockedForMs / 1000))))
          return reply.status(429).send({ error: LOGIN_LOCKOUT_MESSAGE, code: 'login_locked' })
        }
        const user = await findUserByLoginIdentifier(loginIdentifier)
        // Always bcrypt.compare (dummy hash when missing) to equalize timing.
        const hash = user?.passwordHash?.trim() ? user.passwordHash : DUMMY_BCRYPT_HASH
        const passwordOk = await bcrypt.compare(password, hash)
        if (!user || !passwordOk || user.deletedAt) {
          // Track failures for known *and* unknown identifiers so lockout does
          // not disclose whether an account exists (PR 3 A7).
          const { lockedForMs: newlyLockedMs } = loginLockoutStore.recordFailure(loginIdentifier)
          if (newlyLockedMs > 0) {
            reply.header('Retry-After', String(Math.max(1, Math.ceil(newlyLockedMs / 1000))))
            return reply.status(429).send({ error: LOGIN_LOCKOUT_MESSAGE, code: 'login_locked' })
          }
          return reply.status(401).send({ error: 'Invalid credentials' })
        }
        if (await isUserIdentityBanned(user.id)) {
          return reply.status(403).send({ error: 'Access denied' })
        }
        loginLockoutStore.clearFailures(loginIdentifier)
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
        // Reactivation / cleanup based on last-online proxy (profiles.updatedAt).
        const [profile] = await db
          .select({ updatedAt: schema.profiles.updatedAt })
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, user.id))
          .limit(1)
        if (profile?.updatedAt && profile.updatedAt <= twoYearsAgo) {
          // Dormant accounts are handled by abandoned-account-sweep — never delete on login.
          // PR 3 (A7): generic failure; do not disclose lifecycle state.
          return reply.status(401).send({ error: 'Invalid credentials' })
        }
        // Login makes the user active again and restarts the countdown.
        if (!profile) {
          await db.insert(schema.profiles).values({ userId: user.id })
        } else if (profile.updatedAt && profile.updatedAt <= oneYearAgo) {
          await db
            .update(schema.profiles)
            .set({ updatedAt: new Date() })
            .where(eq(schema.profiles.userId, user.id))
        } else {
          await db
            .update(schema.profiles)
            .set({ updatedAt: new Date() })
            .where(eq(schema.profiles.userId, user.id))
        }
        await db
          .update(schema.users)
          .set({ lastSeenAt: new Date() })
          .where(eq(schema.users.id, user.id))
        // PR 3 (A9): transparently upgrade below-target bcrypt hashes on
        // successful login. Note bcrypt only reads the first 72 bytes of the
        // password; input length caps (register min 8, change/reset max 128)
        // keep this bounded but the truncation is inherent to bcrypt.
        try {
          const rounds = bcrypt.getRounds(user.passwordHash)
          if (Number.isFinite(rounds) && rounds < 12) {
            const upgradedHash = await bcrypt.hash(password, 12)
            await db
              .update(schema.users)
              .set({ passwordHash: upgradedHash })
              .where(eq(schema.users.id, user.id))
          }
        } catch (err) {
          req.log.warn(
            { err, userId: user.id },
            'password rehash-on-login skipped: could not read bcrypt rounds — investigate hash format',
          )
        }
        const payload = await sessionPayloadForUser({
          id: user.id,
          username: user.username,
          sessionVersion: user.sessionVersion,
        })
        const token = encodeSession(payload)
        setSessionCookie(reply, token)
        return reply.send({
          authenticated: true,
          username: payload.username,
          fallback: false,
        })
      } catch (err) {
        if (isDbConnectionError(err)) {
          req.log.error({ err }, 'POST /api/auth/session database unavailable')
          return reply.status(503).send(dbUnavailablePayload())
        }
        throw err
      }
    }

    // PR 3 (A3): the static demo-password branch must never be reachable in
    // production, even when USE_DATABASE is misconfigured/unset.
    if (isProductionRuntime()) {
      return reply.status(503).send({ error: 'Authentication requires database configuration' })
    }

    if (password !== DEMO_PASSWORD) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const person = getMockPersonByUsername(loginIdentifier)
    if (!person) {
      return reply.status(400).send({ error: 'Unknown username (demo only allows seed users)' })
    }

    const payload: SessionPayload = { username: person.username, sub: person.id }
    const token = encodeSession(payload)
    setSessionCookie(reply, token)
    return reply.send({
      authenticated: true,
      username: payload.username,
      fallback: false,
    })
  })

  app.get('/api/auth/me', async (req, reply) => {
    if (!requireAuthSecret(reply)) return
    const r = resolveViewerFromRequest(req)
    // PR 3 (A2): revoked/banned sessions must not report authenticated here.
    if (r.authenticated && r.payload?.sub && useDatabase()) {
      try {
        if (await isSessionRevoked(r.payload)) {
          return reply.send({
            viewer: { authenticated: false, fallback: r.fallback, username: null, sub: null, person: null },
          })
        }
      } catch (err) {
        req.log.error({ err }, 'GET /api/auth/me session revocation check failed')
        return reply.send({
          viewer: { authenticated: false, fallback: r.fallback, username: null, sub: null, person: null },
        })
      }
    }
    const username = r.username
    const person = username ? (getMockPersonByUsername(username) ?? null) : null

    return reply.send({
      viewer: {
        authenticated: r.authenticated,
        fallback: r.fallback,
        username,
        sub: r.payload?.sub ?? null,
        person,
      },
    })
  })

  app.post('/api/auth/logout', async (req, reply) => {
    // PR 3 (A1): server-side revocation. Bumping sessionVersion invalidates
    // every outstanding cookie for the account (logout-everywhere), instead of
    // only clearing this browser's cookie.
    if (useDatabase()) {
      const r = resolveViewerFromRequest(req)
      const userId = r.authenticated && r.payload ? getViewerUserId(r.payload) : null
      if (userId) {
        try {
          await incrementUserSessionVersion(userId)
        } catch (err) {
          req.log.error({ err, userId }, 'logout session-version bump failed — cookie cleared but other sessions remain valid')
        }
      }
    }
    reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(0))
    return reply.send({ ok: true })
  })

  const registerBody = z.object({
    username: z.string().min(2).max(64),
    email: z.string().email(),
    // Min 8 for register (product); max 128 aligns with change/reset + bcrypt 72-byte note.
    password: z.string().min(8).max(128),
    inviteCode: z.string().optional(),
    ageAffirmed: z.literal(true, {
      errorMap: () => ({ message: 'You must confirm you are at least 18 years old' }),
    }),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms and community rules' }),
    }),
  })

  app.get('/api/auth/registration-policy', async () => {
    const registrationOpen = process.env.C2K_REGISTRATION_OPEN !== 'false'
    const inviteRequired = Boolean(process.env.C2K_REGISTRATION_INVITE_CODE?.trim())
    return {
      registrationOpen,
      inviteRequired,
    }
  })

  app.post('/api/auth/register', { ...rateLimitRoute('register') }, async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Registration requires USE_DATABASE=true' })
    }
    if (process.env.C2K_REGISTRATION_OPEN === 'false') {
      return reply.status(403).send({ error: 'Registration is closed for this test server' })
    }
    const requiredInvite = process.env.C2K_REGISTRATION_INVITE_CODE?.trim()
    if (requiredInvite) {
      const body = req.body as { inviteCode?: unknown } | null
      const provided = typeof body?.inviteCode === 'string' ? body.inviteCode.trim() : ''
      if (!secretsEqual(provided, requiredInvite)) {
        return reply.status(403).send({ error: 'Valid invite code required' })
      }
    }
    try {
      if (await checkIdentityBan(req)) {
        return reply.status(403).send({ error: 'Access denied' })
      }
    } catch (err) {
      if (isDbConnectionError(err)) {
        req.log.error({ err }, 'POST /api/auth/register database unavailable (identity ban check)')
        return reply.status(503).send(dbUnavailablePayload())
      }
      throw err
    }
    const parsed = registerBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const { username, email, password } = parsed.data
    const usernameError = validatePublicUsername(username, email)
    if (usernameError) {
      return reply.status(400).send({ error: usernameError })
    }
    const now = new Date()
    const regIpPrefix = registrationIpPrefixFromRequest(req)
    const hash = await bcrypt.hash(password, 12)
    const emailFields = prepareEmailStorage(email)
    try {
      if (process.env.C2K_ONE_PROFILE_PER_IP_STRICT === 'true' && regIpPrefix.length > 0) {
        const [row] = await db
          .select({ c: count() })
          .from(schema.users)
          .where(eq(schema.users.registrationIpPrefix, regIpPrefix))
        if (Number(row?.c ?? 0) > 0) {
          return reply.status(409).send({ error: 'An account already exists from this network' })
        }
      }
      const [user] = await db
        .insert(schema.users)
        .values({
          username,
          ...emailFields,
          passwordHash: hash,
          registrationIpPrefix: regIpPrefix,
          ageAffirmedAt: now,
          termsAcceptedAt: now,
          policyVersionAccepted: CURRENT_POLICY_VERSION,
          ageVerificationStatus: AGE_VERIFICATION_STATUSES.selfAttested,
        })
        .returning()
      if (!user) throw new Error('insert failed')
      await db.insert(schema.profiles).values({ userId: user.id })
      await db.insert(schema.userSettings).values({
        userId: user.id,
        privacySettings: defaultPrivacySettings,
        notificationSettings: defaultNotificationSettings,
        feedSettings: defaultFeedSettings,
      })
      const payload = await sessionPayloadForUser({
        id: user.id,
        username: user.username,
        sessionVersion: user.sessionVersion,
      })
      const token = encodeSession(payload)
      setSessionCookie(reply, token)
      void (async () => {
        const sent = await sendAccountWelcomeEmail({ to: email, username: user.username })
        if (!sent.ok) {
          req.log.warn({ err: sent.error, userId: user.id }, 'account welcome email failed')
        }
      })()
      return reply.send({ authenticated: true, username: user.username, fallback: false })
    } catch (err) {
      if (isDbConnectionError(err)) {
        req.log.error({ err }, 'POST /api/auth/register database unavailable')
        return reply.status(503).send(dbUnavailablePayload())
      }
      if (isPgUniqueViolation(err)) {
        // Generic conflict — do not disclose which of username/email collided.
        return reply.status(409).send({ error: REGISTER_CONFLICT_MESSAGE, code: 'register_conflict' })
      }
      req.log.error({ err }, 'POST /api/auth/register unexpected error')
      return reply.status(500).send({ error: 'Unable to complete registration. Try again.' })
    }
  })

  const passwordResetRequestBody = z.object({
    identifier: z.string().min(1).max(320),
  })

  app.post('/api/auth/password-reset/request', {
    ...rateLimitRoute('passwordResetRequest', { keySuffix: passwordResetIdentifierKey }),
  }, async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Password reset requires USE_DATABASE=true' })
    }
    if (!isPasswordResetEnabled()) {
      return reply.status(503).send({ error: 'Password reset is disabled on this server' })
    }
    const parsed = passwordResetRequestBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const result = await requestPasswordReset({
      identifier: parsed.data.identifier,
      req,
      log: req.log,
    })
    return reply.send({ ok: true, message: result.message })
  })

  const passwordResetConfirmBody = z.object({
    token: z.string().min(16).max(256),
    password: z.string().min(12).max(128),
  })

  app.post('/api/auth/password-reset/confirm', { ...rateLimitRoute('passwordResetConfirm') }, async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Password reset requires USE_DATABASE=true' })
    }
    if (!isPasswordResetEnabled()) {
      return reply.status(503).send({ error: 'Password reset is disabled on this server' })
    }
    const parsed = passwordResetConfirmBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const result = await confirmPasswordReset({
      rawToken: parsed.data.token,
      newPassword: parsed.data.password,
      log: req.log,
    })
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send({ ok: true })
  })

  app.get('/api/auth/password-reset/policy', async () => ({
    enabled: isPasswordResetEnabled(),
    genericMessage: PASSWORD_RESET_GENERIC_MESSAGE,
  }))

  const passwordChangeBody = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })

  app.post('/api/auth/password/change', { ...rateLimitRoute('passwordChange') }, async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Password change requires USE_DATABASE=true' })
    }
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = v.payload.sub
    const parsed = passwordChangeBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const result = await changePasswordForUser({
      userId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      log: req.log,
    })
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    // Re-issue cookie with the new sessionVersion so this browser stays signed in;
    // other devices remain revoked by the bump.
    const username = v.username ?? v.payload.username
    if (username) {
      const payload = await sessionPayloadForUser({
        id: userId,
        username,
        sessionVersion: result.sessionVersion,
      })
      setSessionCookie(reply, encodeSession(payload))
    }
    return reply.send({ ok: true })
  })
}
