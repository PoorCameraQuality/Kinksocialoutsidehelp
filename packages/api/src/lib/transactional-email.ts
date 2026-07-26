import { APP_NAME } from '@c2k/shared'
import { mailTransportMode, platformMailBcc, sendEmail } from './mailer.js'

export type EventRsvpEmailInput = {
  to: string
  eventTitle: string
  eventId: string
  status: 'going' | 'maybe' | 'waitlist'
  startsAt?: string | Date | null
}

function publicWebBase(): string {
  const base = (process.env.C2K_PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')
  return base
}

export function buildEventRsvpConfirmationEmail(input: EventRsvpEmailInput): {
  subject: string
  text: string
  html: string
} {
  const eventUrl = `${publicWebBase()}/events/${encodeURIComponent(input.eventId)}`
  const statusLabel =
    input.status === 'waitlist' ? 'waitlisted'
    : input.status === 'maybe' ? 'marked as maybe'
    : 'confirmed as going'
  const when =
    input.startsAt ?
      new Date(input.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null
  const subject = `RSVP ${statusLabel}: ${input.eventTitle}`
  const lines = [
    `Your RSVP for "${input.eventTitle}" is ${statusLabel}.`,
    when ? `When: ${when}` : null,
    `View event: ${eventUrl}`,
    '',
    `, ${APP_NAME}`,
  ].filter(Boolean) as string[]
  const text = lines.join('\n')
  const html = `<p>Your RSVP for <strong>${escapeHtml(input.eventTitle)}</strong> is <strong>${escapeHtml(statusLabel)}</strong>.</p>${
    when ? `<p>When: ${escapeHtml(when)}</p>` : ''
  }<p><a href="${escapeHtml(eventUrl)}">View event</a></p><p style="color:#888;font-size:12px">${APP_NAME}</p>`
  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendEventRsvpConfirmationEmail(
  input: EventRsvpEmailInput
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.C2K_EVENT_RSVP_EMAIL !== 'true') {
    return { ok: false, error: 'rsvp_email_disabled' }
  }
  const { subject, text, html } = buildEventRsvpConfirmationEmail(input)
  return sendEmail({ to: input.to, subject, text, html })
}

export function buildEmailTestPayload(): { subject: string; text: string; html: string } {
  return buildEventRsvpConfirmationEmail({
    to: 'test@example.com',
    eventTitle: 'Kink Social Email Test Event',
    eventId: '00000000-0000-4000-8000-000000000001',
    status: 'going',
    startsAt: new Date().toISOString(),
  })
}

export function buildScopeEmailConfirmEmail(input: {
  scopeName: string
  confirmUrl: string
}): { subject: string; text: string; html: string } {
  const subject = `Confirm your email subscription · ${input.scopeName}`
  const text = [
    `Confirm your subscription to ${input.scopeName} on ${APP_NAME}.`,
    `Open this link to confirm: ${input.confirmUrl}`,
    '',
    'If you did not request this, you can ignore this email.',
    '',
    `, ${APP_NAME}`,
  ].join('\n')
  const html = `<p>Confirm your subscription to <strong>${escapeHtml(input.scopeName)}</strong>.</p><p><a href="${escapeHtml(input.confirmUrl)}">Confirm subscription</a></p><p style="color:#888;font-size:12px">If you did not request this, ignore this email.</p>`
  return { subject, text, html }
}

export type OrgWelcomeEmailInput = {
  to: string
  orgName: string
  orgSlug: string
}

export type AccountWelcomeEmailInput = {
  to: string
  username: string
}

export function buildAccountWelcomeEmail(input: AccountWelcomeEmailInput): {
  subject: string
  text: string
  html: string
} {
  const homeUrl = `${publicWebBase()}/home`
  const guidelinesUrl = `${publicWebBase()}/guidelines`
  const privacyUrl = `${publicWebBase()}/privacy`
  const subject = `Welcome to ${APP_NAME}, ${input.username}`
  const text = [
    `Welcome to ${APP_NAME}, ${input.username}!`,
    '',
    'Your account is ready. Explore events, connect with friends, and discover conventions in the community.',
    '',
    `Open your home feed: ${homeUrl}`,
    `Community guidelines: ${guidelinesUrl}`,
    `Privacy policy: ${privacyUrl}`,
    '',
    `${APP_NAME} is 18+ only. Be respectful, consent-centered, and privacy-minded.`,
    '',
    `— ${APP_NAME}`,
  ].join('\n')
  const html = [
    `<p>Welcome to ${APP_NAME}, <strong>${escapeHtml(input.username)}</strong>!</p>`,
    '<p>Your account is ready. Explore events, connect with friends, and discover conventions in the community.</p>',
    `<p><a href="${escapeHtml(homeUrl)}">Open your home feed</a></p>`,
    `<p><a href="${escapeHtml(guidelinesUrl)}">Community guidelines</a> · <a href="${escapeHtml(privacyUrl)}">Privacy policy</a></p>`,
    `<p style="color:#888;font-size:12px">${APP_NAME} is 18+ only. Be respectful, consent-centered, and privacy-minded.</p>`,
  ].join('')
  return { subject, text, html }
}

export async function sendAccountWelcomeEmail(
  input: AccountWelcomeEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.C2K_ACCOUNT_WELCOME_EMAIL !== 'true') {
    return { ok: false, error: 'account_welcome_email_disabled' }
  }
  if (mailTransportMode() === 'disabled') {
    return { ok: false, error: 'mail_disabled' }
  }
  const { subject, text, html } = buildAccountWelcomeEmail(input)
  return sendEmail({ to: input.to, subject, text, html })
}

export function buildOrgWelcomeEmail(input: OrgWelcomeEmailInput): {
  subject: string
  text: string
  html: string
} {
  const orgUrl = `${publicWebBase()}/orgs/${encodeURIComponent(input.orgSlug)}`
  const subject = `Welcome to ${input.orgName} on ${APP_NAME}`
  const text = [
    `You joined ${input.orgName} on ${APP_NAME}.`,
    `Visit the organization: ${orgUrl}`,
    '',
    `, ${APP_NAME}`,
  ].join('\n')
  const html = `<p>You joined <strong>${escapeHtml(input.orgName)}</strong> on ${APP_NAME}.</p><p><a href="${escapeHtml(orgUrl)}">View organization</a></p><p style="color:#888;font-size:12px">${APP_NAME}</p>`
  return { subject, text, html }
}

export async function sendOrgWelcomeEmail(
  input: OrgWelcomeEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.C2K_ORG_JOIN_EMAIL !== 'true') {
    return { ok: false, error: 'org_join_email_disabled' }
  }
  if (mailTransportMode() === 'disabled') {
    return { ok: false, error: 'mail_disabled' }
  }
  const { subject, text, html } = buildOrgWelcomeEmail(input)
  return sendEmail({ to: input.to, subject, text, html })
}

export function emailStatusPayload() {
  return {
    transport: mailTransportMode(),
    rsvpConfirmEnabled: process.env.C2K_EVENT_RSVP_EMAIL === 'true',
    orgJoinEmailEnabled: process.env.C2K_ORG_JOIN_EMAIL === 'true',
    accountWelcomeEmailEnabled: process.env.C2K_ACCOUNT_WELCOME_EMAIL === 'true',
    publicWebUrl: publicWebBase(),
    platformBccConfigured: platformMailBcc().length > 0,
  }
}

export type ConventionParticipationOfferEmailInput = {
  conventionName: string
  conventionSlug: string
  offer: {
    id: string
    letterText: string | null
    letterHtml: string | null
    accessCode: string | null
    boothLabel: string | null
    feeCents: number | null
    feeInstructions: string | null
    expiresAt: string | null
  }
}

export function buildConventionParticipationOfferEmail(
  input: ConventionParticipationOfferEmailInput,
): { subject: string; text: string; html: string } {
  const offersUrl = `${publicWebBase()}/conventions/${encodeURIComponent(input.conventionSlug)}/my-offers`
  const body = input.offer.letterText ?? input.offer.letterHtml ?? 'You have received a participation offer.'
  const subject = `Participation offer · ${input.conventionName}`
  const extras: string[] = []
  if (input.offer.accessCode) extras.push(`Access code: ${input.offer.accessCode}`)
  if (input.offer.boothLabel) extras.push(`Booth: ${input.offer.boothLabel}`)
  if (input.offer.feeCents != null) extras.push(`Fee: $${(input.offer.feeCents / 100).toFixed(2)}`)
  if (input.offer.feeInstructions) extras.push(input.offer.feeInstructions)
  if (input.offer.expiresAt) {
    extras.push(`Respond by: ${new Date(input.offer.expiresAt).toLocaleDateString()}`)
  }
  const text = [
    body,
    '',
    ...extras,
    '',
    `Review and respond: ${offersUrl}`,
    '',
    `, ${APP_NAME}`,
  ].join('\n')
  const html = `<div>${escapeHtml(body).replace(/\n/g, '<br/>')}</div>${
    extras.length ? `<ul>${extras.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''
  }<p><a href="${escapeHtml(offersUrl)}">Review and respond to your offer</a></p><p style="color:#888;font-size:12px">${APP_NAME}</p>`
  return { subject, text, html }
}
