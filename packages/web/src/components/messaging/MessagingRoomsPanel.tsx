import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import ChannelMessageList, { type ChannelMessage } from '@/components/conventions/ChannelMessageList'
import {
  chatRoomApiBase,
  roomSelectionKey,
  useMyChatRooms,
  type SelectedChatRoom,
} from '@/hooks/useMyChatRooms'
import { useVisualViewportBottomInset } from '@/hooks/useVisualViewportBottomInset'
import { useMaxMd } from '@/hooks/useMaxMd'
import { cn } from '@/lib/cn'

type Props = {
  selected: SelectedChatRoom | null
  onSelect: (room: SelectedChatRoom | null) => void
  enabled: boolean
}

export default function MessagingRoomsPanel({ selected, onSelect, enabled }: Props) {
  const rooms = useMyChatRooms({ enabled })
  const messageInputId = useId()
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sendText, setSendText] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const isMobile = useMaxMd()
  const inThread = Boolean(selected)
  const keyboardInset = useVisualViewportBottomInset(isMobile && inThread)

  const apiRoot = selected ? chatRoomApiBase(selected.scope, selected.scopeKey) : ''

  const loadMessages = useCallback(async () => {
    if (!selected) {
      setMessages([])
      return
    }
    setLoadingMsgs(true)
    setThreadError(null)
    try {
      const r = await fetch(`${apiRoot}/${encodeURIComponent(selected.channel.id)}/messages`, {
        credentials: 'include',
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setThreadError(j.error ?? 'Could not load channel')
        setMessages([])
        return
      }
      const d = (await r.json()) as {
        items?: Array<{
          id: string
          body: string
          parentMessageId?: string | null
          createdAt?: string | null
          sender?: { username?: string | null }
        }>
      }
      setMessages(
        (d.items ?? []).map((m) => ({
          id: m.id,
          body: m.body,
          parentMessageId: m.parentMessageId,
          username: m.sender?.username ?? null,
          createdAt:
            typeof m.createdAt === 'string' ? m.createdAt
            : m.createdAt != null ? String(m.createdAt)
            : null,
        })),
      )
      void fetch(`${apiRoot}/${encodeURIComponent(selected.channel.id)}/mark-read`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      setThreadError('Could not load channel')
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }, [selected, apiRoot])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  async function sendMessage() {
    if (!selected || !sendText.trim()) return
    setSendBusy(true)
    setThreadError(null)
    try {
      const r = await fetch(`${apiRoot}/${encodeURIComponent(selected.channel.id)}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: sendText.trim() }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setThreadError(j.error ?? 'Could not send')
        return
      }
      setSendText('')
      await loadMessages()
      rooms.reload()
    } finally {
      setSendBusy(false)
    }
  }

  const totalUnread = rooms.items.reduce(
    (n, s) => n + s.channels.reduce((m, c) => m + (c.unreadCount || 0), 0),
    0,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden lg:flex-row">
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col border-b border-dc-border lg:w-[min(100%,340px)] lg:border-b-0 lg:border-r',
          selected ? 'hidden lg:flex' : 'flex',
        )}
        aria-label="Chat rooms"
      >
        <div className="shrink-0 border-b border-dc-border p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
            Rooms{totalUnread > 0 ? ` · ${totalUnread} unread` : ''}
          </p>
          <p className="mt-1 text-xs text-dc-muted">
            Play space lounges and convention hubs you follow.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          {rooms.status === 'loading' && rooms.items.length === 0 ?
            <p className="px-2 py-4 text-sm text-dc-muted">Loading rooms…</p>
          : null}
          {rooms.status === 'error' ?
            <p className="px-2 py-4 text-sm text-dc-danger" role="alert">
              {rooms.errorMessage}
            </p>
          : null}
          {rooms.status === 'ready' && rooms.items.length === 0 ?
            <div className="rounded-xl border border-dashed border-dc-border px-3 py-6 text-center">
              <p className="text-sm text-dc-muted">
                Join a play space or pin a convention hub to see chat rooms here.
              </p>
              <Link
                to="/play"
                className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground"
              >
                Browse play spaces
              </Link>
            </div>
          : null}
          <ul className="space-y-3">
            {rooms.items.map((scope) => (
              <li key={`${scope.scope}:${scope.key}`}>
                <div className="mb-1 flex items-center justify-between gap-2 px-1">
                  <p className="truncate text-xs font-semibold text-dc-text">{scope.title}</p>
                  <span className="shrink-0 rounded-md bg-dc-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-dc-muted">
                    {scope.scope === 'play-space' ? 'Space' : 'Con'}
                  </span>
                </div>
                {scope.channels.length === 0 ?
                  <Link
                    to={scope.href}
                    className="block rounded-xl border border-dc-border px-3 py-2.5 text-sm text-dc-accent hover:bg-dc-accent-muted"
                  >
                    Open hub chat
                  </Link>
                : (
                  <ul className="space-y-1">
                    {scope.channels.map((ch) => {
                      const sel: SelectedChatRoom = {
                        scope: scope.scope,
                        scopeKey: scope.key,
                        scopeTitle: scope.title,
                        channel: ch,
                      }
                      const active =
                        selected != null && roomSelectionKey(selected) === roomSelectionKey(sel)
                      return (
                        <li key={ch.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(sel)}
                            className={cn(
                              'flex w-full min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                              active ?
                                'bg-dc-accent text-dc-accent-foreground'
                              : 'bg-dc-surface-muted text-dc-text hover:bg-dc-elevated-muted',
                            )}
                          >
                            <span className="min-w-0 truncate">
                              <span className="text-dc-muted">#</span>
                              {ch.slug}
                            </span>
                            {ch.unreadCount > 0 ?
                              <span
                                className={cn(
                                  'inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                                  active ?
                                    'bg-dc-accent-foreground/20 text-dc-accent-foreground'
                                  : 'bg-dc-accent text-dc-accent-foreground',
                                )}
                              >
                                {ch.unreadCount > 9 ? '9+' : ch.unreadCount}
                              </span>
                            : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          !selected ? 'hidden lg:flex' : 'flex',
        )}
        aria-label="Room thread"
      >
        {!selected ?
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <p className="text-sm text-dc-muted">Pick a room to start chatting.</p>
          </div>
        : (
          <>
            <header className="flex shrink-0 items-center gap-2 border-b border-dc-border px-3 py-2.5 sm:px-4">
              <button
                type="button"
                className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-2.5 text-sm text-dc-text lg:hidden"
                onClick={() => onSelect(null)}
              >
                Back
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-dc-text">
                  #{selected.channel.slug}
                  <span className="font-normal text-dc-muted"> · {selected.scopeTitle}</span>
                </p>
              </div>
              <Link
                to={
                  selected.scope === 'play-space' ?
                    `/play/${encodeURIComponent(selected.scopeKey)}`
                  : `/conventions/${encodeURIComponent(selected.scopeKey)}?tab=Chat`
                }
                className="shrink-0 text-xs font-medium text-dc-accent hover:underline"
              >
                Open hub
              </Link>
            </header>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
              {loadingMsgs ?
                <p className="text-sm text-dc-muted">Loading…</p>
              : (
                <ChannelMessageList
                  messages={messages}
                  listClassName="max-h-none min-h-0 flex-1"
                  showReport={selected.scope === 'convention'}
                  onReply={async (messageId, body) => {
                    const r = await fetch(
                      `${apiRoot}/${encodeURIComponent(selected.channel.id)}/messages/${encodeURIComponent(messageId)}/replies`,
                      {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ body }),
                      },
                    )
                    if (!r.ok) {
                      const j = (await r.json().catch(() => ({}))) as { error?: string }
                      return { ok: false, error: j.error ?? 'Reply failed' }
                    }
                    await loadMessages()
                    return { ok: true }
                  }}
                />
              )}
              {threadError ?
                <p className="mt-2 text-xs text-dc-danger" role="alert">
                  {threadError}
                </p>
              : null}
            </div>
            <footer
              className="shrink-0 border-t border-dc-border bg-dc-elevated p-3 sm:p-4"
              style={keyboardInset > 0 ? { paddingBottom: keyboardInset + 12 } : undefined}
            >
              <label htmlFor={messageInputId} className="sr-only">
                Message
              </label>
              <div className="flex gap-2">
                <input
                  id={messageInputId}
                  type="text"
                  value={sendText}
                  onChange={(e) => setSendText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder={
                    selected.channel.kind === 'ANNOUNCEMENTS' ?
                      'Post to announcements…'
                    : 'Message the room…'
                  }
                  className="min-h-11 flex-1 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text"
                  disabled={sendBusy}
                />
                <button
                  type="button"
                  disabled={sendBusy || !sendText.trim()}
                  onClick={() => void sendMessage()}
                  className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
