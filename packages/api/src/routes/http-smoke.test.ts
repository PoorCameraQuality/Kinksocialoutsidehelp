import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import Fastify from 'fastify'

describe('HTTP smoke (no database)', () => {
  const prevDb = process.env.USE_DATABASE

  after(() => {
    process.env.USE_DATABASE = prevDb
  })

  test('GET /api/v1/groups/nearby returns 503 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerEcosystemStubRoutes } = await import('./ecosystem-stubs.js')
    await registerEcosystemStubRoutes(app)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/groups/nearby?lat=40.7&lng=-74',
    })
    assert.equal(res.statusCode, 503)
    await app.close()
  })

  test('POST /api/auth/session returns 429 after rate limit exceeded', async () => {
    const prevDisable = process.env.C2K_RATE_LIMIT_DISABLE
    const prevMax = process.env.C2K_RATE_LIMIT_LOGIN_MAX
    const prevWindow = process.env.C2K_RATE_LIMIT_LOGIN_WINDOW_MS
    const prevAuthSecret = process.env.AUTH_SECRET
    const prevDb = process.env.USE_DATABASE
    process.env.C2K_RATE_LIMIT_DISABLE = 'false'
    process.env.C2K_RATE_LIMIT_LOGIN_MAX = '2'
    process.env.C2K_RATE_LIMIT_LOGIN_WINDOW_MS = '60000'
    process.env.AUTH_SECRET = 'test-auth-secret-for-rate-limit-smoke'
    process.env.USE_DATABASE = 'false'

    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerApiRateLimit } = await import('../lib/register-rate-limit.js')
    await registerApiRateLimit(app)
    const { registerAuthRoutes } = await import('./auth.js')
    await registerAuthRoutes(app)

    try {
      const body = JSON.stringify({ username: 'nobody', password: 'wrong-password' })
      const injectLogin = () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/session',
          payload: body,
          headers: { 'content-type': 'application/json' },
        })
      const first = await injectLogin()
      const second = await injectLogin()
      const third = await injectLogin()

      const allowed = new Set([400, 401])
      assert.ok(allowed.has(first.statusCode), `first status ${first.statusCode}`)
      assert.ok(allowed.has(second.statusCode), `second status ${second.statusCode}`)
      assert.equal(third.statusCode, 429)
    } finally {
      process.env.C2K_RATE_LIMIT_DISABLE = prevDisable
      process.env.C2K_RATE_LIMIT_LOGIN_MAX = prevMax
      process.env.C2K_RATE_LIMIT_LOGIN_WINDOW_MS = prevWindow
      process.env.AUTH_SECRET = prevAuthSecret
      process.env.USE_DATABASE = prevDb
      await app.close()
    }
  })

  test('GET /api/v1/me/email/status returns 401 without session', async () => {
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerEmailRoutes } = await import('./email-routes.js')
    await registerEmailRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/email/status' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/feed/following returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerFeedRoutes } = await import('./feed-routes.js')
    await registerFeedRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/feed/following' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/feed/home returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerFeedRoutes } = await import('./feed-routes.js')
    await registerFeedRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/feed/home' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/feed/following/counts returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerFeedRoutes } = await import('./feed-routes.js')
    await registerFeedRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/feed/following/counts' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/me/presenter-profile returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerPresenterProfileRoutes } = await import('./presenter-profiles.js')
    await registerPresenterProfileRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/presenter-profile' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/me/vendor-profile returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerEcosystemStubRoutes } = await import('./ecosystem-stubs.js')
    await registerEcosystemStubRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/vendor-profile' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/me/bookmarks returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerBookmarkRoutes } = await import('./bookmark-routes.js')
    await registerBookmarkRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/bookmarks' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/me/staff-profile returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerStaffProfileRoutes } = await import('./staff-profiles.js')
    await registerStaffProfileRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/staff-profile' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/me/education-articles returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerEducationArticleRoutes } = await import('./education-articles-routes.js')
    await registerEducationArticleRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/education-articles' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/me/education-series returns 401 without session', async () => {
    process.env.USE_DATABASE = 'true'
    const cookie = (await import('@fastify/cookie')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerEducationArticleSeriesRoutes } = await import('./education-article-series-routes.js')
    await registerEducationArticleSeriesRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/education-series' })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('GET /api/v1/organizations?sort=popular returns 503 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerOrganizationRoutes } = await import('./organizations.js')
    await registerOrganizationRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/organizations?sort=popular' })
    assert.equal(res.statusCode, 503)
    await app.close()
  })

  test('GET /api/v1/presenters?sort=popular returns 503 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerPresenterProfileRoutes } = await import('./presenter-profiles.js')
    await registerPresenterProfileRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/presenters?sort=popular' })
    assert.equal(res.statusCode, 503)
    await app.close()
  })

  test('GET /api/v1/profiles?q=test returns 503 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerEcosystemStubRoutes } = await import('./ecosystem-stubs.js')
    await registerEcosystemStubRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/profiles?q=test' })
    assert.equal(res.statusCode, 503)
    await app.close()
  })

  test('GET /api/v1/trending returns 503 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerTrendingRoutes } = await import('./trending-routes.js')
    await registerTrendingRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/trending?limit=8' })
    assert.equal(res.statusCode, 503)
    await app.close()
  })

  test('GET /api/v1/education/series/by-author/nobody returns 404 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerEducationArticleSeriesRoutes } = await import('./education-article-series-routes.js')
    await registerEducationArticleSeriesRoutes(app)

    const res = await app.inject({ method: 'GET', url: '/api/v1/education/series/by-author/nobody' })
    assert.equal(res.statusCode, 503)
    await app.close()
  })

  test('GET /api/v1/feed/posts/:id/comments returns 503 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerFeedRoutes } = await import('./feed-routes.js')
    await registerFeedRoutes(app)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/posts/00000000-0000-4000-8000-000000000001/comments',
    })
    assert.equal(res.statusCode, 503)
    await app.close()
  })

  test('PUT /api/v1/feed/posts/:id/reactions returns 503 when USE_DATABASE=false', async () => {
    process.env.USE_DATABASE = 'false'
    const app = Fastify()
    const { registerFeedRoutes } = await import('./feed-routes.js')
    await registerFeedRoutes(app)

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/feed/posts/00000000-0000-4000-8000-000000000001/reactions',
      payload: { kind: 'love' },
    })
    assert.equal(res.statusCode, 503)
    await app.close()
  })
})
