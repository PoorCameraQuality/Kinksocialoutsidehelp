'use client'

import { useCallback, useState } from 'react'

type Props = {
  disabled?: boolean
  placeholder?: string
  onSend: (body: string) => Promise<{ ok: true } | { ok: false; error: string; retryAfterSec?: number }>
}

export default function ChannelComposer({ disabled, placeholder = 'Write a message…', onSend }: Props) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownSec, setCooldownSec] = useState(0)

  const submit = useCallback(async () => {
    const text = body.trim()
    if (!text || sending || disabled || cooldownSec > 0) return
    setSending(true)
    setError(null)
    const res = await onSend(text)
    setSending(false)
    if (res.ok) {
      setBody('')
      return
    }
    setError(res.error)
    if (res.retryAfterSec && res.retryAfterSec > 0) {
      setCooldownSec(res.retryAfterSec)
      const t0 = Date.now()
      const iv = window.setInterval(() => {
        const left = Math.max(0, res.retryAfterSec! - Math.floor((Date.now() - t0) / 1000))
        setCooldownSec(left)
        if (left <= 0) window.clearInterval(iv)
      }, 500)
    }
  }, [body, sending, disabled, cooldownSec, onSend])

  return (
    <div className="rounded-xl border border-dc-border bg-dc-elevated/95 p-3 space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={disabled || sending || cooldownSec > 0}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-dc-border bg-black/20 px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent-border/50 focus:outline-none disabled:opacity-50"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void submit()
          }
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-dc-muted">Enter to send · Shift+Enter for newline</p>
        <button
          type="button"
          disabled={disabled || sending || !body.trim() || cooldownSec > 0}
          onClick={() => void submit()}
          className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-text hover:bg-dc-accent-hover disabled:opacity-40"
        >
          {cooldownSec > 0 ? `Wait ${cooldownSec}s` : sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-300" role="alert">{error}</p> : null}
    </div>
  )
}
