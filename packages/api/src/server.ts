import './load-dev-env.js'
import { initErrorTracking, setupFastifyErrorTracking } from './lib/error-tracking.js'
import {
  assertAuthFallbackSafeForStartup,
  assertCorsOriginForStartup,
  assertDatabaseConfiguredForStartup,
  assertMediaScannerSafeForStartup,
  assertProductionSecretsForStartup,
  assertRateLimitEnabledForStartup,
} from './lib/production-guard.js'
import { corsOriginsFromEnv } from './lib/cors-origins.js'
import { registerSecurityHeaders } from './lib/security-headers.js'
import { assertMailConfiguredForPasswordReset } from './lib/mail-config.js'
import { assertFieldEncryptionConfigured } from './lib/field-encryption.js'
import { PINO_REDACT_PATHS } from './lib/log-redact.js'
import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { registerAuthRoutes } from './routes/auth.js'
import { registerEmailVerificationRoutes } from './routes/email-verification.js'
import { registerEcosystemStubRoutes } from './routes/ecosystem-stubs.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerPublicSeedAssetRoutes } from './routes/public-seed-assets.js'
import { registerKinkTagRoutes } from './routes/kink-tags.js'
import { registerLocationRoutes } from './routes/locations.js'
import { registerMutesRoutes } from './routes/mutes.js'
import { registerOrganizationRoutes } from './routes/organizations.js'
import { registerOrgClaimRoutes } from './routes/org-claim-routes.js'
import { registerProfileKinksRoutes } from './routes/profile-kinks.js'
import { registerProfilePhotosRoutes } from './routes/profile-photos.js'
import { registerMediaAssetRoutes } from './routes/media-assets.js'
import { registerUserMediaRoutes } from './routes/user-media-routes.js'
import { registerProfileRoutes } from './routes/profile.js'
import { registerProfileRelationshipRoutes } from './routes/profile-relationships.js'
import { registerProfileConnectionRoutes } from './routes/profile-connections.js'
import { registerProfileLinkRoutes } from './routes/profile-links.js'
import { registerSettingsRoutes } from './routes/settings.js'
import { registerUploadRoutes } from './routes/upload.js'
import { registerShopifyIntegrationRoutes } from './routes/shopify-integration.js'
import { registerEtsyIntegrationRoutes } from './routes/etsy-integration.js'
import { registerVendorEtsyRoutes } from './routes/vendor-etsy.js'
import { registerVendorExternalRoutes } from './routes/vendor-external.js'
import { registerVendorProductRoutes } from './routes/vendor-products.js'
import { registerGroupForumRoutes } from './routes/group-forums.js'
import { registerConventionRoutes } from './routes/conventions-routes.js'
import { registerConventionIsoRoutes } from './routes/convention-iso-routes.js'
import { registerConventionDancecardV2Routes } from './routes/convention-dancecard-routes.js'
import { registerPlaySpaceRoutes } from './routes/play-spaces-routes.js'
import { registerPlaySpaceDancecardRoutes } from './routes/play-spaces-dancecard-routes.js'
import { registerConventionOrganizerRoutes } from './routes/convention-organizer-routes.js'
import { registerConventionPublicRoutes } from './routes/convention-public-routes.js'
import { registerConventionAttendeeRoutes } from './routes/convention-attendee-routes.js'
import { registerConventionHubExtRoutes } from './routes/convention-hub-ext-routes.js'
import { registerConventionHubChannelsRoutes } from './routes/convention-hub-channels-routes.js'
import { registerPlaySpaceHubChannelsRoutes } from './routes/play-space-hub-channels-routes.js'
import { registerPushRoutes } from './routes/push-routes.js'
import { registerIsoRoutes } from './routes/iso-routes.js'
import { registerIsoShareRoutes } from './routes/iso-share-routes.js'
import { registerNotificationPreferencesRoutes } from './routes/notification-preferences-routes.js'
import { registerEmailRoutes } from './routes/email-routes.js'
import { registerScopeEmailRoutes } from './routes/scope-email-routes.js'
import { registerPresenterProfileRoutes } from './routes/presenter-profiles.js'
import { registerUserEcosystemRoutes } from './routes/user-ecosystem.js'
import { registerMatchmakerRoutes } from './routes/matchmaker-routes.js'
import { registerPlaySpaceIsoMatchmakerRoutes } from './routes/play-space-iso-matchmaker-routes.js'
import { registerFeedRoutes } from './routes/feed-routes.js'
import { registerEducationArticleRoutes } from './routes/education-articles-routes.js'
import { registerMediaRoutes } from './routes/media-routes.js'
import { registerEducationArticleSeriesRoutes } from './routes/education-article-series-routes.js'
import { registerBookmarkRoutes } from './routes/bookmark-routes.js'
import { registerTrendingRoutes } from './routes/trending-routes.js'
import { registerProfileReferenceRoutes } from './routes/profile-references.js'
import { registerPeerReputationRoutes } from './routes/peer-reputation-routes.js'
import { registerVendorBlindFeedbackRoutes } from './routes/vendor-blind-feedback.js'
import { registerGroupReputationRoutes } from './routes/group-reputation-routes.js'
import { registerModerationProfileFlagsRoutes } from './routes/moderation-profile-flags.js'
import { registerModerationTrustSummaryRoutes } from './routes/moderation-trust-summary.js'
import { registerCommunityTrustRoutes } from './routes/community-trust-routes.js'
import { registerScopedStandingRoutes } from './routes/scoped-standing-routes.js'
import { registerModerationReportsRoutes } from './routes/moderation-reports.js'
import { registerModerationTsReportsRoutes } from './routes/moderation-ts-reports.js'
import { registerModerationActionsRoutes } from './routes/moderation-actions.js'
import { registerModerationAdminRoutes } from './routes/moderation-admin.js'
import { registerModerationTsAdminRoutes } from './routes/moderation-ts-admin.js'
import { registerLegalAlphaRoutes } from './routes/legal-alpha-routes.js'
import { registerMailIntakeRoutes } from './routes/mail-intake-routes.js'
import { registerPrivacyDataRoutes } from './routes/privacy-data-routes.js'
import { registerAdminPrivacyRoutes } from './routes/admin-privacy-routes.js'
import { registerOwnerInvestigationRoutes } from './routes/owner-investigation-routes.js'
import { registerOrganizationModerationRoutes } from './routes/organization-moderation.js'
import { registerGroupModerationRoutes } from './routes/group-moderation.js'
import { registerEventModerationRoutes } from './routes/event-moderation.js'
import { registerGroupLeadershipRoutes } from './routes/group-leadership-routes.js'
import { registerOrganizerRoutes } from './routes/organizer-routes.js'
import { registerEckePublishEntityRoutes } from './routes/ecke-publish-entity-routes.js'
import { registerEckePublishControlRoutes } from './routes/ecke-publish-control-routes.js'
import { registerShareRoutes } from './routes/share-routes.js'
import { registerLiveKitVoiceRoutes } from './routes/livekit-voice-routes.js'
import { registerStaffProfileRoutes } from './routes/staff-profiles.js'
import { registerStripeConnectOrgRoutes } from './routes/stripe-connect-org.js'
import { registerStripeConnectVendorRoutes } from './routes/stripe-connect-vendor.js'
import { registerPaymentsVaultRoutes } from './routes/payments-vault-routes.js'
import { registerStripeCheckoutRoutes } from './routes/stripe-checkout-routes.js'
import { registerStripeWebhookRoutes } from './routes/stripe-webhooks.js'
import { subscribeToScope } from './lib/realtime-bus.js'
import { initRealtimeRedisBridge } from './lib/realtime-redis-bridge.js'
import { registerApiRateLimit } from './lib/register-rate-limit.js'
import { authorizeWebSocketSubscribe } from './lib/ws-subscribe-auth.js'
import { resolveViewerFromRequest } from './auth/resolve-viewer.js'
import { getViewerUserId } from './auth/viewer-user-id.js'
import { loadUserSessionVersion, sessionVersionMatches } from './auth/session-version.js'
import { isUserIdentityBanned } from './lib/peer-reputation.js'
import { isTrustProxyEnabled } from './lib/client-ip.js'
import { enforceCookieCsrf } from './lib/csrf-guard.js'

initErrorTracking()

assertProductionSecretsForStartup()
assertAuthFallbackSafeForStartup()
assertDatabaseConfiguredForStartup()
assertRateLimitEnabledForStartup()
assertCorsOriginForStartup()
assertMediaScannerSafeForStartup()
assertMailConfiguredForPasswordReset()
assertFieldEncryptionConfigured()

const app = Fastify({
  logger: {
    redact: {
      paths: PINO_REDACT_PATHS,
      censor: '[REDACTED]',
    },
  },
  trustProxy: isTrustProxyEnabled(),
})

setupFastifyErrorTracking(app)

const origin = corsOriginsFromEnv()

await app.register(cors, {
  origin,
  credentials: true,
})

await registerSecurityHeaders(app)

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET ?? 'dev-cookie-secret-change-in-production',
})

await registerApiRateLimit(app)

app.addHook('preHandler', async (req, reply) => {
  if (!enforceCookieCsrf(req, reply)) return
})

/**
 * Auth endpoints exempt from the session-version / identity-ban hook.
 * Narrow allowlist (launch-hardening PR 3, A2): only endpoints that must work
 * without a live session. `GET /api/auth/session` and `/api/auth/me` validate
 * revocation in-route (returning `authenticated: false` instead of 401);
 * `POST /api/auth/password/change` and other authenticated auth routes are
 * enforced here like any other route.
 */
function authPathExemptFromSessionEnforcement(path: string): boolean {
  if (path === '/api/auth/session') return true // GET validated in-route; POST is login
  if (path === '/api/auth/me') return true // validated in-route
  if (path === '/api/auth/logout') return true
  if (path === '/api/auth/register') return true
  if (path === '/api/auth/registration-policy') return true
  if (path.startsWith('/api/auth/password-reset/')) return true
  return false
}

app.addHook('preHandler', async (req, reply) => {
  if (process.env.USE_DATABASE !== 'true') return
  const path = (req.url.split('?')[0] ?? '').replace(/\/+$/, '') || '/'
  if (path.startsWith('/api/health')) return
  if (path.startsWith('/api/auth/') && authPathExemptFromSessionEnforcement(path)) return
  const viewer = resolveViewerFromRequest(req)
  if (!viewer.authenticated || !viewer.payload?.sub) return
  // PR 3 (A8): never fall back to a raw token `sub` — a non-UUID sub cannot be
  // enforced against the users table, so it is treated as an invalid session.
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    return reply.status(401).send({ error: 'Session invalid', code: 'session_invalid' })
  }
  if (await isUserIdentityBanned(userId)) {
    return reply.status(403).send({ error: 'Access denied' })
  }
  const dbSessionVersion = await loadUserSessionVersion(userId)
  if (!sessionVersionMatches(viewer.payload, dbSessionVersion)) {
    return reply.status(401).send({ error: 'Session expired', code: 'session_revoked' })
  }
})

const WS_MAX_MESSAGE_BYTES = 16 * 1024
const WS_MAX_SCOPES_PER_SOCKET = 32

await app.register(websocket)
app.get('/api/ws', { websocket: true }, (connection, req) => {
  const socket = connection.socket
  const subsByScope = new Map<string, () => void>()
  const sendEvent = (event: unknown) => {
    try {
      socket.send(JSON.stringify(event))
    } catch {
      /* socket closed */
    }
  }
  socket.on('message', async (raw: unknown) => {
    let text: string
    try {
      text =
        typeof raw === 'string'
          ? raw
          : Buffer.isBuffer(raw)
            ? raw.toString('utf8')
            : raw instanceof ArrayBuffer
              ? Buffer.from(raw).toString('utf8')
              : String(raw)
    } catch {
      text = ''
    }
    if (Buffer.byteLength(text, 'utf8') > WS_MAX_MESSAGE_BYTES) {
      sendEvent({ type: 'error', code: 'message_too_large' })
      return
    }
    const trimmed = text.trim()
    if (trimmed === 'ping' || trimmed === '{"type":"ping"}') {
      socket.send(JSON.stringify({ type: 'pong' }))
      return
    }
    try {
      const parsed = JSON.parse(trimmed) as { type?: string; scope?: string }
      if (parsed.type === 'subscribe' && parsed.scope) {
        try {
          const allowed = await authorizeWebSocketSubscribe(req, parsed.scope)
          if (!allowed) {
            sendEvent({ type: 'error', code: 'forbidden', scope: parsed.scope })
            return
          }
        } catch (err) {
          app.log.warn({ err }, 'ws subscribe authorize failed')
          sendEvent({ type: 'error', code: 'authorize_failed', scope: parsed.scope })
          return
        }
        if (subsByScope.size >= WS_MAX_SCOPES_PER_SOCKET) {
          sendEvent({ type: 'error', code: 'too_many_subscriptions' })
          return
        }
        const existingUnsub = subsByScope.get(parsed.scope)
        if (existingUnsub) existingUnsub()
        const unsub = subscribeToScope(parsed.scope, (event) => sendEvent({ type: 'event', ...event }))
        subsByScope.set(parsed.scope, unsub)
        socket.send(JSON.stringify({ type: 'subscribed', scope: parsed.scope }))
        return
      }
      if (parsed.type === 'unsubscribe' && parsed.scope) {
        const unsub = subsByScope.get(parsed.scope)
        const removed = Boolean(unsub)
        if (unsub) {
          unsub()
          subsByScope.delete(parsed.scope)
        }
        socket.send(JSON.stringify({ type: 'unsubscribed', scope: parsed.scope, removed }))
        return
      }
    } catch {
      /* non-JSON fallback — ignore unknown payloads (no echo ack) */
    }
  })
  socket.on('close', () => {
    for (const unsub of subsByScope.values()) unsub()
    subsByScope.clear()
  })
})

await registerHealthRoutes(app)
await registerPublicSeedAssetRoutes(app)
await registerAuthRoutes(app)
await registerEmailVerificationRoutes(app)
await registerLocationRoutes(app)
await registerProfileRoutes(app)
await registerProfileConnectionRoutes(app)
await registerProfileRelationshipRoutes(app)
await registerProfileLinkRoutes(app)
await registerIsoRoutes(app)
await registerIsoShareRoutes(app)
await registerSettingsRoutes(app)
await registerKinkTagRoutes(app)
await registerProfileKinksRoutes(app)
await registerProfilePhotosRoutes(app)
await registerMediaAssetRoutes(app)
await registerUserMediaRoutes(app)
await registerMutesRoutes(app)
await registerUploadRoutes(app)
await registerEcosystemStubRoutes(app)
const { registerSocialGraphRoutes } = await import('./routes/social-graph-routes.js')
await registerSocialGraphRoutes(app)
const { registerCommunityPlacesRoutes } = await import('./routes/community-places-routes.js')
await registerCommunityPlacesRoutes(app)
const { registerEventDiscussionRoutes } = await import('./routes/event-discussions-routes.js')
await registerEventDiscussionRoutes(app)
await registerFeedRoutes(app)
await registerEducationArticleRoutes(app)
await registerEducationArticleSeriesRoutes(app)
await registerMediaRoutes(app)
await registerBookmarkRoutes(app)
await registerTrendingRoutes(app)
await registerUserEcosystemRoutes(app)
await registerVendorExternalRoutes(app)
await registerVendorProductRoutes(app)
await registerVendorEtsyRoutes(app)
await registerEtsyIntegrationRoutes(app)
await registerShopifyIntegrationRoutes(app)
await registerOrganizationRoutes(app)
await registerStripeWebhookRoutes(app)
await registerPaymentsVaultRoutes(app)
await registerStripeConnectOrgRoutes(app)
await registerStripeConnectVendorRoutes(app)
await registerStripeCheckoutRoutes(app)
await registerOrgClaimRoutes(app)
await registerLiveKitVoiceRoutes(app)
await registerGroupForumRoutes(app)
await registerConventionRoutes(app)
await registerConventionHubExtRoutes(app)
await registerConventionHubChannelsRoutes(app)
await registerConventionIsoRoutes(app)
await registerConventionDancecardV2Routes(app)
await registerPlaySpaceRoutes(app)
await registerPlaySpaceDancecardRoutes(app)
await registerPlaySpaceHubChannelsRoutes(app)
await registerPlaySpaceIsoMatchmakerRoutes(app)
await registerConventionOrganizerRoutes(app)
registerConventionPublicRoutes(app)
await registerConventionAttendeeRoutes(app)
await registerNotificationPreferencesRoutes(app)
const { registerAdultContentPreferenceRoutes } = await import('./routes/adult-content-preference-routes.js')
await registerAdultContentPreferenceRoutes(app)
await registerEmailRoutes(app)
await registerScopeEmailRoutes(app)
await registerPushRoutes(app)
await registerPresenterProfileRoutes(app)
await registerMatchmakerRoutes(app)
await registerProfileReferenceRoutes(app)
await registerPeerReputationRoutes(app)
await registerVendorBlindFeedbackRoutes(app)
await registerGroupReputationRoutes(app)
await registerModerationProfileFlagsRoutes(app)
await registerModerationTrustSummaryRoutes(app)
await registerCommunityTrustRoutes(app)
await registerScopedStandingRoutes(app)
await registerModerationReportsRoutes(app)
await registerModerationTsReportsRoutes(app)
await registerModerationActionsRoutes(app)
await registerModerationAdminRoutes(app)
await registerModerationTsAdminRoutes(app)
await registerLegalAlphaRoutes(app)
await registerMailIntakeRoutes(app)
await registerPrivacyDataRoutes(app)
await registerAdminPrivacyRoutes(app)
await registerOwnerInvestigationRoutes(app)
await registerOrganizationModerationRoutes(app)
await registerGroupModerationRoutes(app)
await registerEventModerationRoutes(app)
await registerGroupLeadershipRoutes(app)
await registerOrganizerRoutes(app)
await registerEckePublishEntityRoutes(app)
await registerEckePublishControlRoutes(app)
await registerShareRoutes(app)
await registerStaffProfileRoutes(app)

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'

try {
  await app.listen({ port, host })
  const { imgproxyStartupDiagnostic } = await import('./lib/imgproxy.js')
  const imgproxy = imgproxyStartupDiagnostic()
  if (imgproxy.warning) app.log.warn({ imgproxy }, imgproxy.warning)
  else if (imgproxy.operational) app.log.info({ imgproxy: { enabled: true } }, 'imgproxy image delivery enabled')
  await initRealtimeRedisBridge(app.log)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
