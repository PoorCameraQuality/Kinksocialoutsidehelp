'use client'

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function EmailConfirmPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setMsg('Missing confirmation token.')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(
          `/api/v1/email-list/confirm?token=${encodeURIComponent(token)}`,
          { credentials: 'include' },
        )
        const body = (await r.json().catch(() => ({}))) as { error?: string; scopeName?: string }
        if (!r.ok) {
          if (!cancelled) setMsg(body.error ?? 'Could not confirm subscription')
          return
        }
        if (!cancelled) {
          setMsg(
            body.scopeName ?
              `You are subscribed to ${body.scopeName}.`
            : 'Your subscription is confirmed.',
          )
        }
      } catch {
        if (!cancelled) setMsg('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold text-dc-text mb-2">Confirm email</h1>
      {loading ?
        <p className="text-sm text-dc-muted">Confirming…</p>
      : <p className="text-sm text-dc-text-muted">{msg}</p>}
      <p className="mt-8 text-sm">
        <Link to="/home" className="text-dc-accent hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  )
}
