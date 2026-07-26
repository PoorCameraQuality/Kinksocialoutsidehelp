/**
 * Live alpha audit phase 6: vendor Etsy, test-con registration, block/report API.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://kink.social'
const PASSWORD = 'AlphaQA!Test2026Secure'
const ETSY_SHOP_URL = 'https://www.etsy.com/shop/CraftSupplies'
const CONV_SLUG = 'alpha-qa-test-con-1782561899684'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const report = { ts: new Date().toISOString(), phase6: {} }

async function login(u) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: PASSWORD }),
  })
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  return { cookie, body: await res.json(), ok: res.ok }
}

async function req(method, p, cookie, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return { status: res.status, json, text }
}

async function uploadProfilePhoto(cookie) {
  const png = path.join(__dirname, '..', '.qa-audit-assets', 'test-avatar-square.png')
  const buf = fs.readFileSync(png)
  const form = new FormData()
  form.append('purpose', 'profile_photo')
  form.append('file', new Blob([buf], { type: 'image/png' }), 'alpha-qa-test.png')
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { Cookie: cookie }, body: form })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return { status: res.status, json, text }
}

// --- Vendor ---
const vendor = await login('AlphaQATestVendor01')
report.phase6.vendorLogin = vendor.body.authenticated ?? false

let vendorMe = await req('GET', '/api/v1/vendors/me', vendor.cookie)
if (vendorMe.status === 404) {
  report.phase6.vendorCreate = await req('POST', '/api/v1/vendors', vendor.cookie, {
    displayName: 'ALPHA QA TEST Shop',
    slug: 'alpha-qa-test-shop',
    bio: 'ALPHA QA TEST vendor — safe audit placeholder.',
    category: 'gear',
    shipsTo: 'US',
  })
  vendorMe = await req('GET', '/api/v1/vendors/me', vendor.cookie)
} else {
  report.phase6.vendorCreate = { skip: 'already exists', status: vendorMe.status }
}
report.phase6.vendorMe = vendorMe.json

report.phase6.etsyPatch = await req('PATCH', '/api/v1/vendors/me/etsy', vendor.cookie, {
  shopUrl: ETSY_SHOP_URL,
})
report.phase6.etsySync = await req('POST', '/api/v1/vendors/me/etsy/sync', vendor.cookie, {})

const vendorSlug = vendorMe.json?.vendor?.slug ?? report.phase6.vendorCreate?.json?.vendor?.slug
if (vendorSlug) {
  report.phase6.vendorPublic = await req('GET', `/api/v1/vendors/${vendorSlug}`, vendor.cookie)
  report.phase6.vendorListings = await req('GET', `/api/v1/vendors/${vendorMe.json?.vendor?.id ?? report.phase6.vendorCreate?.json?.vendor?.id}/listings`, vendor.cookie)
}

// --- Convention registration on test con ---
const org = await login('AlphaQATestOrg01')
report.phase6.regCategory = await req('POST', `/api/v1/conventions/${CONV_SLUG}/registration-categories`, org.cookie, {
  name: 'ALPHA QA TEST Pass',
  description: 'Safe audit registration type',
  isPublic: true,
  sortOrder: 0,
})
const catId = report.phase6.regCategory.json?.category?.id
report.phase6.regForm = await req('PUT', `/api/v1/conventions/${CONV_SLUG}/registration-form`, org.cookie, {
  status: 'published',
  introText: 'ALPHA QA TEST registration form',
  confirmationText: 'Thanks for registering (audit test).',
})
report.phase6.regInfo = await req('GET', `/api/v1/public/conventions/${CONV_SLUG}/register-info`, (await login('AlphaQATestMember02')).cookie)

const m2 = await login('AlphaQATestMember02')
if (catId) {
  report.phase6.regSubmit = await req('POST', `/api/v1/public/conventions/${CONV_SLUG}/registrations`, m2.cookie, {
    categoryId: catId,
    answers: {},
  })
}

// --- Block + report ---
const m1Profile = await req('GET', '/api/profile/AlphaQATestMember01', m2.cookie)
const m1UserId = m1Profile.json?.user?.id
report.phase6.reportProfile = await req('POST', '/api/v1/reports', m2.cookie, {
  targetType: 'profile',
  targetId: m1UserId,
  category: 'spam',
  body: 'ALPHA QA TEST report — spam category smoke test only.',
})
report.phase6.block = await req('POST', '/api/v1/me/blocks', m2.cookie, { username: 'AlphaQATestMember01' })
report.phase6.blockedGraph = await req('GET', '/api/v1/users/AlphaQATestMember01/graph-status', m2.cookie)
report.phase6.unblock = await req('DELETE', '/api/v1/me/blocks/AlphaQATestMember01', m2.cookie)

// --- Profile photo upload + attach probe ---
report.phase6.photoUpload = await uploadProfilePhoto(m2.cookie)
if (report.phase6.photoUpload.json?.quarantineKey) {
  report.phase6.photoAttach = await req('POST', '/api/v1/me/profile-photos', m2.cookie, {
    quarantineKey: report.phase6.photoUpload.json.quarantineKey,
    sha256: report.phase6.photoUpload.json.sha256,
    mimeType: report.phase6.photoUpload.json.mimeType,
    sizeBytes: report.phase6.photoUpload.json.sizeBytes,
    originalFilename: 'alpha-qa-test.png',
  })
}

const out = path.join(__dirname, '..', '.qa-audit-assets', 'audit-phase6.json')
fs.writeFileSync(out, JSON.stringify(report, null, 2))
console.log('Wrote', out)
console.log(JSON.stringify(report, null, 2))
