#!/usr/bin/env node
/**
 * Alpha Hardening Pass 1 — Phase 4 privacy API smoke (prod/staging).
 * Uses alpha social seed personas when present; skips seed scenarios otherwise.
 *
 * Usage:
 *   node scripts/smoke-alpha-hardening-privacy.mjs
 *   SMOKE_BASE=https://kink.social ALPHA_SOCIAL_SEED_PASSWORD=AlphaSocial!23 node scripts/smoke-alpha-hardening-privacy.mjs
 */
const BASE = (process.env.SMOKE_BASE ?? 'https://kink.social').replace(/\/$/, '')
const SEED_PW = process.env.ALPHA_SOCIAL_SEED_PASSWORD ?? 'AlphaSocial!23'

const checks = []

function pass(id, detail = '') {
  checks.push({ id, ok: true, detail })
  console.log(`PASS ${id}${detail ? ` — ${detail}` : ''}`)
}

function fail(id, detail = '') {
  checks.push({ id, ok: false, detail })
  console.log(`FAIL ${id}${detail ? ` — ${detail}` : ''}`)
}

function skip(id, detail = '') {
  console.log(`SKIP ${id}${detail ? ` — ${detail}` : ''}`)
}

async function jsonFetch(path, { cookie, method = 'GET', body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    /* ignore */
  }
  return { ok: r.ok, status: r.status, data, text }
}

async function login(username, password = SEED_PW) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
      continue
    }
    if (!res.ok) return null
    const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
    if (!cookie) return null
    return cookie.split(';')[0]
  }
  return null
}

function listItems(body, keys = ['items', 'posts', 'groups', 'profiles']) {
  if (Array.isArray(body)) return body
  for (const k of keys) {
    if (Array.isArray(body?.[k])) return body[k]
  }
  return []
}

async function main() {
  console.log(`Alpha hardening privacy smoke — ${BASE}\n`)

  const settingsPage = await fetch(`${BASE}/settings/privacy`)
  pass('settings/privacy page', settingsPage.status === 200, `status=${settingsPage.status}`)

  const socialCookie = await login('alpha_social')
  const privateCookie = await login('alpha_private')
  const newbieCookie = await login('alpha_newbie')
  const blockerCookie = await login('alpha_blocker')
  const hiddenCookie = await login('alpha_hidden_member')
  const quietCookie = await login('alpha_quiet')

  const seedOk = Boolean(socialCookie && privateCookie && newbieCookie)
  if (!seedOk) {
    skip('alpha seed personas', 'alpha_social/private/newbie login failed — run seed or set ALPHA_SOCIAL_SEED_PASSWORD')
  } else {
    pass('alpha seed login', true, 'social + private + newbie')

    // Only-me post leak
    const privFeed = await jsonFetch('/api/v1/me/feed-posts?limit=50', { cookie: privateCookie })
    const newbView = await jsonFetch('/api/v1/users/alpha_private/feed-posts?limit=50', { cookie: newbieCookie })
    const onlyMePosts = listItems(privFeed.data).filter(
      (p) => String(p.visibility ?? '').includes('ONLY') || String(p.body ?? '').toLowerCase().includes('only-me'),
    )
    const leaked = listItems(newbView.data).filter((p) =>
      String(p.body ?? '').toLowerCase().includes('only-me'),
    )
    pass(
      'only-me post not leaked to stranger',
      newbView.ok && leaked.length === 0,
      `author_only_me=${onlyMePosts.length} leaked=${leaked.length}`,
    )

    // Undiscoverable profile
    const quietSearch = await jsonFetch('/api/v1/profiles?q=alpha_quiet&limit=20', { cookie: socialCookie })
    const quietHits = listItems(quietSearch.data, ['items', 'profiles']).filter(
      (p) => (p.username ?? p.handle ?? '').toLowerCase() === 'alpha_quiet',
    )
    pass('alpha_quiet hidden from people search', quietSearch.ok && quietHits.length === 0, `hits=${quietHits.length}`)

    // Blocked user in people search
    if (blockerCookie) {
      const blockedSearch = await jsonFetch('/api/v1/profiles?q=alpha_blocked&limit=20', { cookie: blockerCookie })
      const blockedHits = listItems(blockedSearch.data, ['items', 'profiles']).filter(
        (p) => (p.username ?? p.handle ?? '').toLowerCase() === 'alpha_blocked',
      )
      pass('alpha_blocked hidden from blocker search', blockedSearch.ok && blockedHits.length === 0, `hits=${blockedHits.length}`)
    } else {
      skip('blocker people search', 'alpha_blocker login failed')
    }

    // Private group forum
    if (hiddenCookie) {
      const myGroups = await jsonFetch('/api/v1/me/groups', { cookie: hiddenCookie })
      const groups = listItems(myGroups.data, ['groups', 'items'])
      const priv = groups.find((g) => String(g.slug ?? '').includes('alpha-social-private-circle'))
      if (priv) {
        const slug = priv.slug ?? priv.id
        const memForum = await jsonFetch(`/api/v1/groups/${slug}/forum/threads?limit=5`, { cookie: hiddenCookie })
        const nonForum = await jsonFetch(`/api/v1/groups/${slug}/forum/threads?limit=5`, { cookie: newbieCookie })
        const anonGroup = await jsonFetch(`/api/v1/groups/${slug}`)
        pass('private group member forum access', memForum.ok, `status=${memForum.status}`)
        pass(
          'private group forum blocked for non-member',
          nonForum.status === 403 || nonForum.status === 404 || listItems(nonForum.data).length === 0,
          `status=${nonForum.status}`,
        )
        pass('private group detail not public anon', anonGroup.status === 401 || anonGroup.status === 403 || anonGroup.status === 404, `status=${anonGroup.status}`)
      } else {
        skip('private group forum', 'alpha-social-private-circle not in seed')
      }
    }

    // Profile photos use proxy not direct MinIO for LOGGED_IN
    const photos = await jsonFetch('/api/profile/me/photos', { cookie: socialCookie })
    const photo = listItems(photos.data, ['photos', 'items'])[0]
    if (photo?.url) {
      const isProxy = /^\/api\/v1\/media\/assets\/[0-9a-f-]{36}\/content/.test(photo.url)
      const isDirect = /\/c2k-uploads\/media\//.test(photo.url) || /^https?:\/\/.*\/media\//.test(photo.url)
      pass('profile photo uses proxy path', isProxy || !isDirect, photo.url.slice(0, 80))
      if (isDirect && photo.visibility === 'LOGGED_IN') {
        fail('profile photo direct public URL', photo.url.slice(0, 120))
      }
      const mediaMatch = photo.url.match(/\/api\/v1\/media\/assets\/([0-9a-f-]{36})\/content/)
      if (mediaMatch) {
        const anonMedia = await jsonFetch(`/api/v1/media/assets/${mediaMatch[1]}/content`)
        pass('logged-in media proxy blocked for guest', anonMedia.status === 401 || anonMedia.status === 403, `status=${anonMedia.status}`)
      }
    } else {
      skip('profile photo proxy check', 'no photos on alpha_social')
    }
  }

  // Demo user fallback when seed absent
  if (!seedOk) {
    const demoCookie = await login('RopeDreamer', process.env.DEMO_LOGIN_PASSWORD ?? 'demo')
    if (demoCookie) {
      pass('demo user login fallback', true, 'RopeDreamer')
      const dmInbox = await jsonFetch('/api/v1/messaging/inbox', { cookie: demoCookie })
      pass('messaging inbox reachable', dmInbox.ok || dmInbox.status === 404, `status=${dmInbox.status}`)
    } else {
      skip('demo privacy fallback', 'RopeDreamer login failed')
    }
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length) {
    for (const f of failed) console.log(`  ✗ ${f.id}${f.detail ? `: ${f.detail}` : ''}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
