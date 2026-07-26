'use client'

import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

export default function EmailUnsubscribePage() {
  const [searchParams] = useSearchParams()
  const scope = searchParams.get('scope') ?? ''
  const scopeId = searchParams.get('id') ?? ''
  const presetEmail = searchParams.get('email') ?? ''
  const [email, setEmail] = useState(presetEmail)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const validScope = scope === 'organization' || scope === 'group'

  async function unsubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!validScope || !scopeId) {
      setMsg('Invalid unsubscribe link.')
      return
    }
    setLoading(true)
    setMsg(null)
    const base =
      scope === 'organization' ?
        `/api/v1/organizations/${encodeURIComponent(scopeId)}/email-unsubscribe`
      : `/api/v1/groups/${encodeURIComponent(scopeId)}/email-unsubscribe`
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setMsg(j.error ?? 'Could not unsubscribe')
        return
      }
      setMsg('You have been unsubscribed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold text-dc-text mb-2">Unsubscribe</h1>
      <p className="text-sm text-dc-muted mb-6">
        Remove your email from this community list.
      </p>
      <form onSubmit={unsubscribe} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
        >
          {loading ? 'Working…' : 'Unsubscribe'}
        </button>
      </form>
      {msg ? <p className="mt-4 text-sm text-dc-text-muted">{msg}</p> : null}
      <p className="mt-8 text-sm">
        <Link to="/home" className="text-dc-accent hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  )
}
