export const CONVERSATION_READ_EVENT = 'c2k:conversation-read'

/** Tell the API the viewer read a thread; notify header/badge hooks to refresh. */
export async function markConversationRead(conversationId: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/v1/conversations/${encodeURIComponent(conversationId)}/mark-read`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!r.ok) return false
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CONVERSATION_READ_EVENT, { detail: { conversationId } }))
    }
    return true
  } catch {
    return false
  }
}
