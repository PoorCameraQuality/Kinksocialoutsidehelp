'use client'

import { useCallback, useEffect, useState } from 'react'

type Props = {
  scopeType: 'organization' | 'group'
  scopeKey: string
  canManage: boolean
}

export default function ScopeEmailBroadcastPanel({ scopeType, scopeKey, canManage }: Props) {
  const [count, setCount] = useState(0)
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const base =
    scopeType === 'organization' ?
      `/api/v1/organizations/${encodeURIComponent(scopeKey)}`
    : `/api/v1/groups/${encodeURIComponent(scopeKey)}`

  const load = useCallback(async () => {
    if (!canManage) return
    const r = await fetch(`${base}/email-subscribers`, { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as { count?: number }
    setCount(d.count ?? 0)
  }, [base, canManage])

  useEffect(() => {
    void load()
  }, [load])

  if (!canManage) return null

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setMsg(null)
    try {
      const r = await fetch(`${base}/email-broadcast`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), text: text.trim() }),
      })
      const body = (await r.json()) as {
        sent?: number
        failed?: number
        transportDisabled?: boolean
        error?: string
      }
      if (!r.ok) {
        setMsg(body.error ?? 'Send failed')
        return
      }
      if (body.transportDisabled) {
        setMsg('Mail transport is disabled on the server (configure SMTP).')
        return
      }
      setMsg(`Sent ${body.sent ?? 0} email(s)${body.failed ? `, ${body.failed} failed` : ''}.`)
      setSubject('')
      setText('')
      void load()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-dc-border bg-black/20 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-dc-text">Email list ({count} subscribers)</h3>
      <p className="text-xs text-dc-muted">
        Platform owner receives a BCC copy when mail transport is configured.
      </p>
      <form onSubmit={sendBroadcast} className="space-y-2">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          required
          className="w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message (plain text)"
          required
          rows={5}
          className="w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text"
        />
        <button
          type="submit"
          disabled={sending || count === 0}
          className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send to list'}
        </button>
      </form>
      {msg ? <p className="text-xs text-dc-text-muted">{msg}</p> : null}
    </div>
  )
}
