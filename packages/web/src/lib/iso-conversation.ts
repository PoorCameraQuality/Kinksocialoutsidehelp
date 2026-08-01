const COMPOSER_KEY = 'dc-iso-composer-context'

export type IsoComposerContext = {
  conversationId: string
  regarding?: string
  displayName?: string
  /** When set, used as the full draft instead of ISO regarding format. */
  prefill?: string
}

export async function startIsoConversation(opts: {
  participantUsername: string
  isoSubjectUserId: string
  pitchTitle?: string
  displayName?: string
}): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/v1/conversations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantUsername: opts.participantUsername,
        entryPoint: 'iso',
        isoSubjectUserId: opts.isoSubjectUserId,
      }),
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

    if (opts.pitchTitle?.trim()) {
      const ctx: IsoComposerContext = {
        conversationId,
        regarding: opts.pitchTitle.trim(),
        displayName: opts.displayName,
      }
      try {
        sessionStorage.setItem(COMPOSER_KEY, JSON.stringify(ctx))
      } catch {
        /* ignore */
      }
    }
    return { ok: true, conversationId }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export function consumeIsoComposerContext(conversationId: string): IsoComposerContext | null {
  try {
    const raw = sessionStorage.getItem(COMPOSER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as IsoComposerContext
    if (parsed.conversationId !== conversationId) return null
    sessionStorage.removeItem(COMPOSER_KEY)
    return parsed
  } catch {
    return null
  }
}

export function isoComposerPrefill(ctx: IsoComposerContext): string {
  if (ctx.prefill?.trim()) return ctx.prefill.endsWith('\n') ? ctx.prefill : `${ctx.prefill}\n\n`
  if (!ctx.regarding) return ''
  const who = ctx.displayName ? `${ctx.displayName}'s ISO` : 'their ISO'
  return `Regarding ${who}:\n“${ctx.regarding}”\n\n`
}
