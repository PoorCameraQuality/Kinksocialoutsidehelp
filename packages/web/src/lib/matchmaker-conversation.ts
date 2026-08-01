import { consumeIsoComposerContext, isoComposerPrefill, type IsoComposerContext } from '@/lib/iso-conversation'

const COMPOSER_KEY = 'dc-iso-composer-context'

/** Start a DM after a Matchmaker mutual match (frontend-first; no dedicated entryPoint yet). */
export async function startMatchmakerConversation(opts: {
  participantUsername: string
  eventTitle?: string
}): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/v1/conversations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantUsername: opts.participantUsername }),
    })
    const j = (await r.json().catch(() => ({}))) as {
      conversation?: { id: string }
      error?: string
    }
    if (!r.ok) {
      return { ok: false, error: typeof j.error === 'string' ? j.error : 'Could not start conversation' }
    }
    const conversationId = j.conversation?.id
    if (!conversationId) return { ok: false, error: 'Could not start conversation' }

    const camp = opts.eventTitle?.trim() || 'this camp'
    const ctx: IsoComposerContext = {
      conversationId,
      prefill: `We matched through ${camp} Matchmaker.`,
    }
    try {
      sessionStorage.setItem(COMPOSER_KEY, JSON.stringify(ctx))
    } catch {
      /* ignore */
    }
    return { ok: true, conversationId }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export { consumeIsoComposerContext, isoComposerPrefill }
