import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'
import { isBlockedPair } from './blocks.js'
import { createNotification } from './create-notification.js'
import { getUserEmailById } from './user-email.js'
import { sanitizeDmHtml } from './sanitize-dm-body.js'
import { absolutizeMarketingHtmlUrls } from './marketing-email-html.js'
import type { CampaignAudienceMode } from './convention-campaign-audience.js'
import { resolveConventionCampaignRecipients } from './convention-campaign-audience.js'

export type InboxCampaignRecipient = {
  userId: string
  displayName: string | null
  registrantId: string | null
  email: string | null
}

async function findExistingDmPair(userIdA: string, userIdB: string): Promise<string | null> {
  const aRows = await db
    .select({ conversationId: schema.conversationParticipants.conversationId })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, userIdA))
  for (const row of aRows) {
    const parts = await db
      .select({ userId: schema.conversationParticipants.userId })
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, row.conversationId))
    if (parts.length === 2) {
      const ids = new Set(parts.map((p) => p.userId))
      if (ids.has(userIdB)) return row.conversationId
    }
  }
  return null
}

/** Event-scoped: organizers may DM going/interested members even when privacy is connections-only. */
export async function assertCanOrganizerCampaignDm(
  organizerUserId: string,
  recipientUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (organizerUserId === recipientUserId) {
    return { ok: false, error: 'Cannot message yourself as a campaign recipient' }
  }
  if (await isBlockedPair(organizerUserId, recipientUserId)) {
    return { ok: false, error: 'Blocked' }
  }
  return { ok: true }
}

export async function resolveConventionInboxCampaignRecipients(input: {
  conventionId: string
  organizationId: string | null
  anchorEventId: string | null
  audience: CampaignAudienceMode
}): Promise<InboxCampaignRecipient[]> {
  const rows = await resolveConventionCampaignRecipients(input)
  const byUser = new Map<string, InboxCampaignRecipient>()
  for (const r of rows) {
    if (!r.userId) continue
    if (byUser.has(r.userId)) continue
    byUser.set(r.userId, {
      userId: r.userId,
      displayName: r.displayName,
      registrantId: r.registrantId,
      email: r.email,
    })
  }
  return [...byUser.values()]
}

export function buildOrganizerCampaignMessageHtml(input: {
  subject: string
  bodyHtml: string
  eventName: string
}): string {
  const subject = input.subject.trim()
  const body = sanitizeDmHtml(absolutizeMarketingHtmlUrls(input.bodyHtml))
  const eventName = input.eventName.trim() || 'this event'
  return [
    subject ? `<h2>${escapeHtml(subject)}</h2>` : '',
    body,
    `<hr /><p><em>Message from the organizers of ${escapeHtml(eventName)} · via kink.social</em></p>`,
  ]
    .filter(Boolean)
    .join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function ensureOrganizerCampaignConversation(input: {
  organizerUserId: string
  recipientUserId: string
}): Promise<{ conversationId: string; created: boolean }> {
  const existing = await findExistingDmPair(input.organizerUserId, input.recipientUserId)
  if (existing) {
    // Ensure recipient can see it in main inbox (not stuck PENDING).
    await db
      .update(schema.conversationParticipants)
      .set({ acceptanceStatus: 'ACCEPTED', deletedAt: null })
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, existing),
          eq(schema.conversationParticipants.userId, input.recipientUserId),
        ),
      )
    await db
      .update(schema.conversationParticipants)
      .set({ acceptanceStatus: 'ACCEPTED', deletedAt: null })
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, existing),
          eq(schema.conversationParticipants.userId, input.organizerUserId),
        ),
      )
    return { conversationId: existing, created: false }
  }

  const [conv] = await db
    .insert(schema.conversations)
    .values({
      initiatorUserId: input.organizerUserId,
      dmEntryPoint: 'event_campaign',
    })
    .returning()
  if (!conv) throw new Error('Failed to create conversation')

  await db.insert(schema.conversationParticipants).values([
    {
      conversationId: conv.id,
      userId: input.organizerUserId,
      acceptanceStatus: 'ACCEPTED',
    },
    {
      conversationId: conv.id,
      userId: input.recipientUserId,
      acceptanceStatus: 'ACCEPTED',
    },
  ])
  return { conversationId: conv.id, created: true }
}

export async function deliverOrganizerCampaignDm(input: {
  organizerUserId: string
  recipientUserId: string
  htmlBody: string
  bodyPreview: string
}): Promise<{ ok: true; conversationId: string; messageId: string } | { ok: false; error: string }> {
  const gate = await assertCanOrganizerCampaignDm(input.organizerUserId, input.recipientUserId)
  if (!gate.ok) return { ok: false, error: gate.error }

  const { conversationId } = await ensureOrganizerCampaignConversation({
    organizerUserId: input.organizerUserId,
    recipientUserId: input.recipientUserId,
  })

  const [msg] = await db
    .insert(schema.messages)
    .values({
      conversationId,
      senderId: input.organizerUserId,
      body: input.htmlBody,
      bodyFormat: 'html',
    })
    .returning()
  if (!msg) return { ok: false, error: 'Failed to insert message' }

  try {
    const [sender] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, input.organizerUserId))
      .limit(1)
    await createNotification(input.recipientUserId, 'new_message', {
      conversationId,
      senderUsername: sender?.username ?? '',
      bodyPreview: input.bodyPreview.slice(0, 200),
    })
  } catch {
    /* notification best-effort */
  }

  return { ok: true, conversationId, messageId: msg.id }
}

export async function deliveryEmailPlaceholder(userId: string, email: string | null): Promise<string> {
  if (email?.includes('@')) return email
  const looked = await getUserEmailById(userId)
  if (looked?.includes('@')) return looked
  return `dm:${userId}@kink.social.local`
}
