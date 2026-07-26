import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PasswordField from '@/components/ui/PasswordField'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!token) {
      setError('This reset link is invalid or expired.')
      return
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, password }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Invalid or expired reset link')
        return
      }
      setMessage('Password updated. You can log in with your username or email and new password.')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold text-dc-text">Choose a new password</h1>
      {!token ?
        <p className="mt-4 text-sm text-red-200">This reset link is invalid or expired.</p>
      : null}
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-dc-text">
            New password
          </label>
          <PasswordField
            id="new-password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            placeholder="New password (12+ characters)"
            inputClassName="border border-dc-border bg-dc-surface-muted px-4 py-3 text-dc-text"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-dc-text">
            Confirm password
          </label>
          <PasswordField
            id="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm new password"
            inputClassName="border border-dc-border bg-dc-surface-muted px-4 py-3 text-dc-text"
          />
        </div>
        {message ?
          <p className="rounded-xl border border-dc-border bg-dc-surface-muted px-4 py-3 text-sm text-dc-text">
            {message}{' '}
            <Link to="/login" className="text-dc-accent hover:underline">
              Log in
            </Link>
          </p>
        : null}
        {error ?
          <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        : null}
        <button
          type="submit"
          disabled={submitting || !token}
          className="min-h-11 w-full rounded-xl bg-dc-accent px-4 py-3 font-semibold text-dc-accent-foreground disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </main>
  )
}
