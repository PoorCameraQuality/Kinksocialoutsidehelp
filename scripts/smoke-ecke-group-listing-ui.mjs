/**
 * kink.social ECKE group listing API smoke (mirrors UI flow).
 * Usage: node scripts/smoke-ecke-group-listing-ui.mjs
 */
const BASE = process.env.C2K_BASE_URL || 'https://kink.social'
const GROUP_ID = process.env.SMOKE_GROUP_ID || '4362af5e-eb8d-40e2-9cc6-700d883604eb'
const USER = process.env.SMOKE_USER || 'alpha_mod'
const PASS = process.env.SMOKE_PASS || 'AlphaSocial!23'

const report = {
  testGroupId: GROUP_ID,
  testGroupName: null,
  eckeTabLoaded: null,
  previewPrivateFieldCheck: null,
  publishResult: null,
  eckeUrl: null,
  eckePageResult: null,
  staleResult: null,
  syncResult: null,
  unpublishResult: null,
  eckeRowDraft: null,
  cacheBehavior: 'ECKE /groups/[slug] uses revalidate=1800; unpublish/sync page updates may lag up to 30 min unless revalidatePath is added.',
  blockers: [],
}

function jarFrom(setCookie) {
  if (!setCookie) return ''
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie]
  return parts.map((c) => c.split(';')[0]).join('; ')
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 500) }
  }
  return { status: res.status, json, headers: res.headers }
}

async function main() {
  console.log('=== ECKE group listing UI smoke (API mirror) ===')
  console.log('Base:', BASE)
  console.log('Group:', GROUP_ID)

  const login = await api('/api/auth/session', {
    method: 'POST',
    body: { username: USER, password: PASS },
  })
  if (login.status !== 200 && login.status !== 201) {
    report.blockers.push(`Login failed for ${USER}: HTTP ${login.status}`)
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  const cookie = jarFrom(login.headers.getSetCookie?.() ?? login.headers.get('set-cookie'))
  console.log('Login OK')

  const status = await api(`/api/v1/groups/${GROUP_ID}/ecke-publish`, { cookie })
  report.eckeTabLoaded = status.status === 200 ? 'yes' : `no (HTTP ${status.status})`
  if (status.status !== 200) {
    report.blockers.push(`ECKE tab status HTTP ${status.status}: ${JSON.stringify(status.json)}`)
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  report.testGroupName = status.json?.group?.name || status.json?.scopeLabel || null
  console.log('ECKE status:', status.json?.cards?.find((c) => c.section === 'group_listing')?.status || status.json)

  const preview = await api(
    `/api/v1/groups/${GROUP_ID}/ecke-publish/preview?sourceKind=group_listing`,
    { cookie },
  )
  if (preview.status !== 200) {
    report.previewPrivateFieldCheck = `fail (HTTP ${preview.status})`
    report.blockers.push(`Preview failed: ${JSON.stringify(preview.json)}`)
  } else {
    const p = preview.json?.preview || preview.json
    const willPublish = (p?.wouldPublish || []).map((x) =>
      typeof x === 'string' ? x.toLowerCase() : `${x.label ?? ''} ${x.value ?? ''}`.toLowerCase(),
    )
    const willNot = (p?.wouldNotPublish || []).map((x) =>
      typeof x === 'string' ? x.toLowerCase() : `${x.label ?? ''} ${x.reason ?? ''}`.toLowerCase(),
    )
    const badInPublish = willPublish.some((f) =>
      /member|private|staff|moderation|message|hidden membership|internal note/.test(f),
    )
    const goodOmitted = willNot.some((f) => /member/.test(f))
    report.previewPrivateFieldCheck =
      !badInPublish && goodOmitted ? 'pass' : `fail (publish=${willPublish.join(', ')}; not=${willNot.join(', ')})`
    if (report.previewPrivateFieldCheck !== 'pass') {
      report.blockers.push('Private fields may appear in wouldPublish preview')
    }
    console.log('Preview wouldPublish:', p?.wouldPublish)
    console.log('Preview wouldNotPublish:', p?.wouldNotPublish)
  }

  const pub = await api(`/api/v1/groups/${GROUP_ID}/ecke-publish/publish`, {
    method: 'POST',
    cookie,
    body: { sourceKind: 'group_listing' },
  })
  report.publishResult = { http: pub.status, body: pub.json }
  report.eckeUrl =
    pub.json?.preview?.eckePublicUrl ||
    pub.json?.eckePublicUrl ||
    pub.json?.target?.eckePublicUrl ||
    pub.json?.result?.eckePublicUrl ||
    null
  if (pub.status !== 200) {
    report.blockers.push(`Publish failed HTTP ${pub.status}`)
  } else {
    console.log('Publish:', pub.json?.status || pub.json)
    console.log('ECKE URL:', report.eckeUrl)
  }

  if (report.eckeUrl) {
    const page = await fetch(report.eckeUrl)
    const html = await page.text()
    const name = report.testGroupName || 'Alpha Social'
    report.eckePageResult =
      page.status === 200 && html.includes(name.split('—')[0].trim().slice(0, 12)) ?
        'pass (page renders group content)'
      : `partial (HTTP ${page.status})`
  }

  // Stale: patch group description via organizer if possible — use groups patch route
  const descSuffix = ` [ECKE smoke ${Date.now()}]`
  const groupGet = await api(`/api/v1/groups/${GROUP_ID}`, { cookie })
  const currentDesc = groupGet.json?.description || groupGet.json?.group?.description || ''
  const patch = await api(`/api/v1/groups/${GROUP_ID}`, {
    method: 'PATCH',
    cookie,
    body: { description: `${currentDesc}${descSuffix}`.slice(0, 2000) },
  })
  console.log('Description patch HTTP', patch.status)

  const statusAfterEdit = await api(`/api/v1/groups/${GROUP_ID}/ecke-publish`, { cookie })
  const listingCard = statusAfterEdit.json?.cards?.find((c) => c.section === 'group_listing')
  const listingStatus = listingCard?.status || statusAfterEdit.json?.targets?.find((t) => t.targetKind === 'group_listing')?.status
  report.staleResult = listingStatus === 'stale' ? 'pass' : `fail (status=${listingStatus})`
  if (report.staleResult !== 'pass') report.blockers.push(`Stale not detected: ${listingStatus}`)

  const sync = await api(`/api/v1/groups/${GROUP_ID}/ecke-publish/sync`, {
    method: 'POST',
    cookie,
    body: { sourceKind: 'group_listing' },
  })
  report.syncResult = { http: sync.status, status: sync.json?.status || sync.json?.target?.status, error: sync.json?.lastError || sync.json?.error }
  if (sync.status !== 200) report.blockers.push(`Sync failed HTTP ${sync.status}`)

  const unpublish = await api(`/api/v1/groups/${GROUP_ID}/ecke-publish/unpublish`, {
    method: 'POST',
    cookie,
    body: { sourceKind: 'group_listing' },
  })
  report.unpublishResult = { http: unpublish.status, body: unpublish.json }
  if (unpublish.status !== 200) report.blockers.push(`Unpublish failed HTTP ${unpublish.status}`)

  // Restore description (best effort)
  await api(`/api/v1/groups/${GROUP_ID}`, {
    method: 'PATCH',
    cookie,
    body: { description: currentDesc },
  })

  console.log('\n=== FINAL REPORT ===')
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.blockers.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
