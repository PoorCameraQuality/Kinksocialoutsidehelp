#!/usr/bin/env node
/**
 * Transactional mail smoke — account welcome (C2K_ACCOUNT_WELCOME_EMAIL),
 * org welcome (C2K_ORG_JOIN_EMAIL), and RSVP confirm (C2K_EVENT_RSVP_EMAIL).
 * Requires: docker/mailpit, API on :3001, mail transport enabled.
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const MAILPIT = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025'
const ORG_SLUG = process.env.SMOKE_ORG_SLUG ?? process.env.PILOT_ORG_SLUG ?? 'demo-east-collective'
const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

const stamp = Date.now()
const username = `txmail${stamp}`.slice(0, 20)
const email = `txmail-${stamp}@mailpit.local`
const password = process.env.SMOKE_TX_PASSWORD ?? 'TxMail!pass99'

/** @type {{ id: string; ok: boolean; detail: string }[]} */
const results = []

function log(id, ok, detail) {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`)
}

async function pollMailpitForEmail(targetEmail, { subjectRe, timeoutMs = 30_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const listRes = await fetch(`${MAILPIT}/api/v1/messages`)
    if (!listRes.ok) throw new Error(`mailpit list ${listRes.status}`)
    const list = await listRes.json()
    const messages = list?.messages ?? list?.Messages ?? []
    for (const msg of messages) {
      const id = msg.ID ?? msg.id
      if (!id) continue
      const detailRes = await fetch(`${MAILPIT}/api/v1/message/${id}`)
      if (!detailRes.ok) continue
      const detail = await detailRes.json()
      const to = (detail.To ?? detail.to ?? [])
        .map((t) => (typeof t === 'string' ? t : t?.Address ?? t?.address ?? ''))
        .join(' ')
        .toLowerCase()
      if (!to.includes(targetEmail.toLowerCase())) continue
      const subject = detail.Subject ?? detail.subject ?? ''
      if (subjectRe && !subjectRe.test(subject)) continue
      return { subject, detail }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

async function registerUser() {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      ageAffirmed: true,
      termsAccepted: true,
    }),
  })
  if (!res.ok) throw new Error(`register ${res.status} ${await res.text()}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) throw new Error('no session cookie')
  return cookie.split(';')[0]
}

async function main() {
  console.log(`Transactional mail smoke — org ${ORG_SLUG}\n`)

  try {
    const mp = await fetch(`${MAILPIT}/api/v1/messages`)
    log('mailpit/reachable', mp.ok, mp.ok ? 'ok' : `status ${mp.status}`)
    if (!mp.ok) process.exit(1)
  } catch (e) {
    log('mailpit/reachable', false, e.message)
    process.exit(1)
  }

  let session
  try {
    session = await registerUser()
    log('register', true, username)
  } catch (e) {
    log('register', false, e.message)
    process.exit(1)
  }

  let accountWelcomeMail
  try {
    accountWelcomeMail = await pollMailpitForEmail(email, {
      subjectRe: new RegExp(`Welcome to Kink Social, ${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
    })
  } catch (e) {
    log('mailpit/account-welcome', false, e.message)
    process.exit(1)
  }
  log(
    'mailpit/account-welcome',
    !!accountWelcomeMail,
    accountWelcomeMail ? accountWelcomeMail.subject : 'not found in Mailpit',
  )
  if (!accountWelcomeMail) process.exit(1)

  const statusResAuthed = await fetch(`${BASE}/api/v1/me/email/status`, {
    headers: { Accept: 'application/json', Cookie: session },
  })
  if (statusResAuthed.ok) {
    const status = await statusResAuthed.json()
    log(
      'email/status',
      true,
      `transport=${status.transport} accountWelcome=${status.accountWelcomeEmailEnabled} orgJoin=${status.orgJoinEmailEnabled} rsvp=${status.rsvpConfirmEnabled}`,
    )
    if (status.transport === 'disabled') {
      console.error('\nC2K_MAIL_TRANSPORT must be smtp (Mailpit on 127.0.0.1:1025)')
      process.exit(1)
    }
    if (!status.accountWelcomeEmailEnabled || !status.orgJoinEmailEnabled || !status.rsvpConfirmEnabled) {
      console.error(
        '\nSet C2K_ACCOUNT_WELCOME_EMAIL=true, C2K_ORG_JOIN_EMAIL=true, and C2K_EVENT_RSVP_EMAIL=true on the API',
      )
      process.exit(1)
    }
  } else {
    log('email/status', false, `${statusResAuthed.status} (continuing with env defaults)`)
  }

  const joinRes = await fetch(`${BASE}/api/v1/organizations/${encodeURIComponent(ORG_SLUG)}/join`, {
    method: 'POST',
    headers: { Accept: 'application/json', Cookie: session },
  })
  const joinBody = await joinRes.json().catch(() => ({}))
  const joinOk = joinRes.ok && joinBody.ok === true
  log('org/join', joinOk, `${joinRes.status} alreadyMember=${joinBody.alreadyMember ?? false}`)
  if (!joinOk) process.exit(1)

  let welcomeMail
  try {
    welcomeMail = await pollMailpitForEmail(email, { subjectRe: / on Kink Social$/i })
  } catch (e) {
    log('mailpit/org-welcome', false, e.message)
    process.exit(1)
  }
  log('mailpit/org-welcome', !!welcomeMail, welcomeMail ? welcomeMail.subject : 'not found in Mailpit')
  if (!welcomeMail) process.exit(1)

  const eventsRes = await fetch(`${BASE}/api/v1/organizations/${encodeURIComponent(ORG_SLUG)}/events`, {
    headers: { Accept: 'application/json' },
  })
  if (!eventsRes.ok) {
    log('org/events', false, `${eventsRes.status}`)
    process.exit(1)
  }
  const eventsBody = await eventsRes.json()
  const eventId = eventsBody.items?.[0]?.id
  if (!eventId) {
    log('org/events', false, 'no seeded org events')
    process.exit(1)
  }
  log('org/events', true, eventId)

  const rsvpRes = await fetch(`${BASE}/api/v1/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: session },
    body: JSON.stringify({ status: 'going' }),
  })
  const rsvpOk = rsvpRes.ok
  log('event/rsvp', rsvpOk, `${rsvpRes.status} ${rsvpOk ? 'going' : await rsvpRes.text()}`)
  if (!rsvpOk) process.exit(1)

  let rsvpMail
  try {
    rsvpMail = await pollMailpitForEmail(email, { subjectRe: /rsvp/i })
  } catch (e) {
    log('mailpit/rsvp', false, e.message)
    process.exit(1)
  }
  log('mailpit/rsvp', !!rsvpMail, rsvpMail ? rsvpMail.subject : 'not found in Mailpit')
  if (!rsvpMail) process.exit(1)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
