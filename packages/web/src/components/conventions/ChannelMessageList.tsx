'use client'



import { useEffect, useRef } from 'react'

import ReportAction from '@/components/moderation/ReportAction'

import { conventionChatMessageTarget } from '@/lib/moderation/report-targets'



export type ChannelMessage = {

  id: string

  body: string

  username: string | null

  parentMessageId?: string | null

  reactions?: Record<string, number>

}



const REACTION_KINDS = ['like', 'fire', 'heart', 'mind_blown'] as const



type Props = {

  messages: ChannelMessage[]

  onReact?: (messageId: string, kind: (typeof REACTION_KINDS)[number]) => void

  onReply?: (messageId: string, body: string) => Promise<{ ok: boolean; error?: string }>

  /** When true, show per-message report for API-backed convention hub chat. */

  showReport?: boolean

}



export default function ChannelMessageList({ messages, onReact, onReply, showReport }: Props) {

  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {

    endRef.current?.scrollIntoView({ behavior: 'smooth' })

  }, [messages.length, messages[messages.length - 1]?.id])



  if (messages.length === 0) {

    return <p className="text-sm text-dc-muted">No messages in this channel yet.</p>

  }



  return (

    <div className="max-h-[min(55vh,520px)] space-y-2 overflow-y-auto pr-1">

      {messages.map((m) => {

        const reportTarget = showReport && m.id ? conventionChatMessageTarget(m.id) : null

        return (

          <div

            key={m.id}

            className={`group rounded-xl border border-dc-border bg-dc-elevated/95 p-3 ${m.parentMessageId ? 'ml-6 border-l-2 border-dc-accent-border/30' : ''}`}

          >

            <div className="flex flex-wrap items-start justify-between gap-2">

              <p className="text-xs text-dc-muted">{m.username ?? 'Member'}</p>

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

            </div>

            <p className="mt-1 text-sm text-dc-text whitespace-pre-wrap">{m.body}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2">

              {m.reactions && Object.keys(m.reactions).length > 0 ?

                <p className="text-xs text-dc-muted">

                  {Object.entries(m.reactions)

                    .map(([k, v]) => `${k}:${v}`)

                    .join(' · ')}

                </p>

              : null}

              <div className="flex flex-wrap gap-1 opacity-70 group-hover:opacity-100">

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

          </div>

        )

      })}

      <div ref={endRef} />

    </div>

  )

}

