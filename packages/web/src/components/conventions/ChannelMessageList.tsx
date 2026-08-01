'use client'

import { Fragment, useEffect, useMemo, useRef } from 'react'
import ReportAction from '@/components/moderation/ReportAction'
import { conventionChatMessageTarget } from '@/lib/moderation/report-targets'
import { cn } from '@/lib/cn'

export type ChannelMessage = {
  id: string
  body: string
  username: string | null
  parentMessageId?: string | null
  reactions?: Record<string, number>
  /** ISO timestamp from the API when available. */
  createdAt?: string | null
}

const REACTION_KINDS = ['like', 'fire', 'heart', 'mind_blown'] as const

function formatMessageClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatMessageFull(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDaySeparator(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

type Props = {
  messages: ChannelMessage[]
  onReact?: (messageId: string, kind: (typeof REACTION_KINDS)[number]) => void
  onReply?: (messageId: string, body: string) => Promise<{ ok: boolean; error?: string }>
  /** When true, show per-message report for API-backed convention hub chat. */
  showReport?: boolean
  /** Override scroll container classes (e.g. full-height room threads). */
  listClassName?: string
}

export default function ChannelMessageList({
  messages,
  onReact,
  onReply,
  showReport,
  listClassName,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.id])

  const withDays = useMemo(() => {
    let lastDay = ''
    return messages.map((m) => {
      const key = m.createdAt ? dayKey(m.createdAt) : ''
      const showDay = Boolean(key && key !== lastDay)
      if (key) lastDay = key
      return { message: m, showDay, dayLabel: m.createdAt ? formatDaySeparator(m.createdAt) : '' }
    })
  }, [messages])

  if (messages.length === 0) {
    return <p className="text-sm text-dc-muted">No messages in this channel yet.</p>
  }

  return (
    <div className={cn('space-y-3 overflow-y-auto pr-1', listClassName ?? 'max-h-[min(55vh,520px)]')}>
      {withDays.map(({ message: m, showDay, dayLabel }) => {
        const reportTarget = showReport && m.id ? conventionChatMessageTarget(m.id) : null
        const clock = m.createdAt ? formatMessageClock(m.createdAt) : ''
        const fullWhen = m.createdAt ? formatMessageFull(m.createdAt) : ''

        return (
          <Fragment key={m.id}>
            {showDay && dayLabel ?
              <div className="sticky top-0 z-[1] flex items-center gap-2 py-1" role="separator">
                <span className="h-px flex-1 bg-dc-border" />
                <span className="shrink-0 rounded-full border border-dc-border bg-dc-elevated px-2.5 py-0.5 text-[11px] font-semibold text-dc-muted">
                  {dayLabel}
                </span>
                <span className="h-px flex-1 bg-dc-border" />
              </div>
            : null}
            <article
              className={cn(
                'group rounded-xl border border-dc-border bg-dc-surface-muted/50 px-3 py-2.5',
                m.parentMessageId && 'ml-5 border-l-2 border-l-dc-accent/50',
              )}
            >
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="truncate text-sm font-semibold text-dc-text">{m.username ?? 'Member'}</p>
                  {clock ?
                    <time
                      dateTime={m.createdAt ?? undefined}
                      title={fullWhen}
                      className="shrink-0 text-[11px] tabular-nums text-dc-muted"
                    >
                      {clock}
                    </time>
                  : null}
                </div>
                {reportTarget ?
                  <ReportAction
                    variant="button"
                    targetType={reportTarget.targetType}
                    targetId={reportTarget.targetId}
                    targetLabel="chat message"
                    surface="convention_hub"
                    className="text-[10px] font-medium text-dc-muted opacity-0 transition-opacity hover:text-dc-accent group-hover:opacity-100 min-h-0 px-0"
                  />
                : null}
              </header>

              <p className="mt-1.5 text-[15px] leading-relaxed text-dc-text whitespace-pre-wrap">{m.body}</p>

              {(m.reactions && Object.keys(m.reactions).length > 0) || onReact || onReply ?
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {m.reactions && Object.keys(m.reactions).length > 0 ?
                    <p className="text-xs text-dc-muted">
                      {Object.entries(m.reactions)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(' · ')}
                    </p>
                  : null}
                  <div className="flex flex-wrap gap-1 opacity-80 group-hover:opacity-100">
                    {onReact ?
                      REACTION_KINDS.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          title={kind}
                          className="rounded-md border border-dc-border px-1.5 py-0.5 text-[10px] uppercase text-dc-muted hover:border-dc-accent-border/40 hover:text-dc-text"
                          onClick={() => onReact(m.id, kind)}
                        >
                          {kind.replace('_', ' ')}
                        </button>
                      ))
                    : null}
                    {onReply ?
                      <button
                        type="button"
                        className="rounded-md border border-dc-border px-1.5 py-0.5 text-[10px] text-dc-muted hover:text-dc-text"
                        onClick={() => {
                          const body = window.prompt('Reply')
                          if (!body?.trim()) return
                          void onReply(m.id, body.trim())
                        }}
                      >
                        Reply
                      </button>
                    : null}
                  </div>
                </div>
              : null}
            </article>
          </Fragment>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
