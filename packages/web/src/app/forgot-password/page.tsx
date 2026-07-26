import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const r = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!r.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not process request')
        return
      }
      setMessage(
        typeof data.message === 'string'
          ? data.message
          : 'If an account matches that information, you will receive password recovery instructions shortly.',
      )
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold text-dc-text">Reset password</h1>
      <p className="mt-2 text-sm text-dc-text-muted">
        Enter your email or username. We will send recovery instructions if an account exists.
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="reset-identifier" className="sr-only">
            Email or username
          </label>
          <input
            id="reset-identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or username"
            className="min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-4 py-3 text-dc-text"
            required
          />
        </div>
        {message ?
          <p className="rounded-xl border border-dc-border bg-dc-surface-muted px-4 py-3 text-sm text-dc-text">
            {message}
          </p>
        : null}
        {error ?
          <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        : null}
        <button
          type="submit"
          disabled={submitting || !identifier.trim()}
          className="min-h-11 w-full rounded-xl bg-dc-accent px-4 py-3 font-semibold text-dc-accent-foreground disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-sm text-dc-muted">
        <Link to="/login" className="text-dc-accent hover:underline">
          Back to login
        </Link>
      </p>
    </main>
  )
}
