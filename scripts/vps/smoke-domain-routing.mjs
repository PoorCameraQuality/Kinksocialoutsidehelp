/**
 * Production domain routing smoke test (run from laptop or CI — not inside containers).
 * Usage: node scripts/vps/smoke-domain-routing.mjs
 * Env: SITE_URL=https://kink.social  WWW_URL=https://www.kink.social
 */
const APEX = (process.env.SITE_URL ?? 'https://kink.social').replace(/\/$/, '')
const WWW = (process.env.WWW_URL ?? 'https://www.kink.social').replace(/\/$/, '')
const APEX_HOST = new URL(APEX).host
const TITLE_SNIPPET = process.env.SMOKE_TITLE_SNIPPET ?? 'Kink Social'

const failures = []

function pass(msg) {
  console.log(`PASS: ${msg}`)
}

function fail(msg) {
  failures.push(msg)
  console.error(`FAIL: ${msg}`)
}

async function fetchNoRedirect(url, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000)
  try {
    return await fetch(url, { redirect: 'manual', signal: controller.signal, ...opts })
  } finally {
    clearTimeout(timer)
  }
}

function expectRedirect(res, expectedLocationPrefix, label) {
  const code = res.status
  if (code !== 301 && code !== 308 && code !== 302 && code !== 307) {
    fail(`${label}: expected redirect, got HTTP ${code}`)
    return
  }
  const loc = res.headers.get('location') ?? ''
  if (!loc.startsWith(expectedLocationPrefix)) {
    fail(`${label}: expected Location starting with ${expectedLocationPrefix}, got ${loc || '(empty)'}`)
    return
  }
  pass(`${label}: HTTP ${code} → ${loc}`)
}

async function main() {
  console.log(`==> Domain routing smoke (apex=${APEX}, www=${WWW})`)

  // 1. Apex HTTPS 200 + title
  try {
    const res = await fetchNoRedirect(`${APEX}/`)
    const body = await res.text()
    if (res.status !== 200) {
      fail(`GET ${APEX}/ → HTTP ${res.status}`)
    } else if (!body.includes(TITLE_SNIPPET)) {
      fail(`GET ${APEX}/ body missing "${TITLE_SNIPPET}"`)
    } else {
      pass(`GET ${APEX}/ → 200 with title`)
    }
  } catch (e) {
    fail(`GET ${APEX}/ → ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2. HTTP apex → HTTPS apex
  try {
    const res = await fetchNoRedirect(`http://${APEX_HOST}/`)
    expectRedirect(res, `${APEX}/`, `http://${APEX_HOST}/`)
  } catch (e) {
    fail(`http://${APEX_HOST}/ → ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3. HTTPS www → HTTPS apex
  try {
    const res = await fetchNoRedirect(`${WWW}/`)
    expectRedirect(res, `${APEX}/`, `GET ${WWW}/`)
  } catch (e) {
    fail(`GET ${WWW}/ → ${e instanceof Error ? e.message : String(e)}`)
  }

  // 4. HTTP www → HTTPS apex (may be one or two hops)
  try {
    const res = await fetchNoRedirect(`http://www.${APEX_HOST}/`)
    const loc = res.headers.get('location') ?? ''
    const ok =
      (res.status === 301 || res.status === 308 || res.status === 302 || res.status === 307) &&
      (loc.startsWith(`${APEX}/`) || loc.startsWith(`${WWW}/`) || loc.startsWith(`https://www.${APEX_HOST}/`))
    if (!ok) {
      fail(`http://www.${APEX_HOST}/ → HTTP ${res.status} Location: ${loc || '(empty)'}`)
    } else if (loc.startsWith(`${APEX}/`)) {
      pass(`http://www.${APEX_HOST}/ → ${loc}`)
    } else {
      pass(`http://www.${APEX_HOST}/ → ${loc} (intermediate; apex redirect expected on follow-up)`)
    }
  } catch (e) {
    fail(`http://www.${APEX_HOST}/ → ${e instanceof Error ? e.message : String(e)}`)
  }

  // 5. API health
  for (const path of ['/api/health', '/api/health/ready']) {
    try {
      const res = await fetchNoRedirect(`${APEX}${path}`)
      const text = await res.text()
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        /* */
      }
      if (res.status !== 200) {
        fail(`GET ${APEX}${path} → HTTP ${res.status}`)
      } else if (!json?.ok) {
        fail(`GET ${APEX}${path} → missing ok:true (${text.slice(0, 120)})`)
      } else {
        pass(`GET ${APEX}${path} → 200 ${text}`)
      }
    } catch (e) {
      fail(`GET ${APEX}${path} → ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('')
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`)
    process.exit(1)
  }
  console.log('All domain routing checks passed.')
}

await main()
