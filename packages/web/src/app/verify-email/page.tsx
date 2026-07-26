import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { PageShell } from '@/components/ui/primitives'
import Button from '@/components/ui/Button'

export default function VerifyEmailPage() {
  const { isAuthenticated, isFallback } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [emailMasked, setEmailMasked] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || isFallback) return
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/v1/auth/email/status', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const j = (await r.json()) as { verified?: boolean; emailMasked?: string | null }
        if (cancelled) return
        setEmailMasked(j.emailMasked ?? null)
        if (j.verified) {
          setVerified(true)
          setStatus('ok')
          setMessage('Your email is already verified.')
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isFallback])

  useEffect(() => {
    if (!token || verified) return
    let cancelled = false
    setStatus('loading')
    void (async () => {
      try {
        const r = await fetch('/api/v1/auth/email/verify', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        if (cancelled) return
        if (!r.ok) {
          setStatus('error')
          setMessage(j.error ?? 'Could not verify that link.')
          return
        }
        setVerified(true)
        setStatus('ok')
        setMessage('Email verified. Thanks!')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setMessage('Network error while verifying.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, verified])

  if (!isAuthenticated || isFallback) {
    return <Navigate to={buildLoginHref(`/verify-email${token ? `?token=${encodeURIComponent(token)}` : ''}`)} replace />
  }

  async function sendCode() {
    setBusy(true)
    setMessage(null)
    try {
      const r = await fetch('/api/v1/auth/email/send-verification', { method: 'POST', credentials: 'include' })
      const j = (await r.json().catch(() => ({}))) as { error?: string; emailMasked?: string }
      if (!r.ok) {
        setStatus('error')
        setMessage(j.error ?? 'Could not send code')
        return
      }
      if (j.emailMasked) setEmailMasked(j.emailMasked)
      setStatus('idle')
      setMessage('Code sent. Check your inbox (Mailpit in local dev).')
    } catch {
      setStatus('error')
      setMessage('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const r = await fetch('/api/v1/auth/email/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setStatus('error')
        setMessage(j.error ?? 'Invalid code')
        return
      }
      setVerified(true)
      setStatus('ok')
      setMessage('Email verified. Thanks!')
    } catch {
      setStatus('error')
      setMessage('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell title="Verify email">
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-dc-text">Verify your email</h1>
          <p className="mt-2 text-sm text-dc-text-muted">
            Confirm {emailMasked ?? 'your account email'} so we can help with account recovery. No SMS — email only.
          </p>
        </div>

        {status === 'loading' ? <p className="text-sm text-dc-muted">Verifying link…</p> : null}
        {message ? (
          <p className={`text-sm ${status === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{message}</p>
        ) : null}

        {verified ? (
          <Link to="/home" className="inline-flex text-sm font-semibold text-dc-accent hover:underline">
            Continue to home
          </Link>
        ) : (
          <div className="space-y-4">
            <Button type="button" disabled={busy} onClick={() => void sendCode()}>
              {busy ? 'Sending…' : 'Email me a code'}
            </Button>
            <form onSubmit={(e) => void submitCode(e)} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-dc-text-muted">Enter code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  className="w-full max-w-xs rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-sm text-dc-text"
                />
              </label>
              <Button type="submit" variant="secondary" disabled={busy || code.trim().length < 4}>
                Verify code
              </Button>
            </form>
            <p className="text-xs text-dc-muted">
              Prefer to wait? You can keep using the app and verify later from{' '}
              <Link to="/settings/account" className="text-dc-accent hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </PageShell>
  )
}
