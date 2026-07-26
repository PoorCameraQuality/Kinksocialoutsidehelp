'use client'

import { useEffect, useState } from 'react'

type Props = {
  scopeType: 'organization' | 'group'
  scopeKey: string
  headline?: string | null
  blurb?: string | null
}

export default function ScopeEmailSignupForm({ scopeType, scopeKey, headline, blurb }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const metaUrl =
    scopeType === 'organization' ?
      `/api/v1/organizations/${encodeURIComponent(scopeKey)}/email-list-meta`
    : `/api/v1/groups/${encodeURIComponent(scopeKey)}/email-list-meta`

  const subscribeUrl =
    scopeType === 'organization' ?
      `/api/v1/organizations/${encodeURIComponent(scopeKey)}/email-subscribe`
    : `/api/v1/groups/${encodeURIComponent(scopeKey)}/email-subscribe`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(metaUrl, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setEnabled(false)
          return
        }
        const d = (await r.json()) as { enabled?: boolean }
        if (!cancelled) setEnabled(Boolean(d.enabled))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [metaUrl])

  if (loading || !enabled) return null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      setMsg('Please confirm you want to receive emails.')
      return
    }
    setSubmitting(true)
    setMsg(null)
    try {
      const r = await fetch(subscribeUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), consent: true }),
      })
      const body = (await r.json().catch(() => ({}))) as {
        error?: string
        created?: boolean
        pending?: boolean
      }
      if (!r.ok) {
        setMsg(body.error ?? 'Could not subscribe')
        return
      }
      if (body.pending) {
        setMsg('Check your inbox and click the confirmation link to finish subscribing.')
      } else if (body.created === false) {
        setMsg('You are already on this list.')
      } else {
        setMsg('Subscribed. Check your inbox for updates.')
      }
      setEmail('')
      setConsent(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-dc-border bg-dc-elevated/80 p-4 space-y-3"
      aria-labelledby="scope-email-signup-heading"
    >
      <h3 id="scope-email-signup-heading" className="text-sm font-semibold text-dc-text">
        {headline?.trim() || 'Email updates'}
      </h3>
      {blurb ?
        <p className="text-xs text-dc-muted leading-relaxed">{blurb}</p>
      : (
        <p className="text-xs text-dc-muted leading-relaxed">
          Get event and community updates by email. Unsubscribe anytime.
        </p>
      )}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text"
        autoComplete="email"
      />
      <label className="flex items-start gap-2 text-xs text-dc-text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>I agree to receive email from this community. I can unsubscribe later.</span>
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
      >
        {submitting ? 'Subscribing…' : 'Subscribe'}
      </button>
      {msg ? <p className="text-xs text-dc-text-muted">{msg}</p> : null}
    </form>
  )
}
