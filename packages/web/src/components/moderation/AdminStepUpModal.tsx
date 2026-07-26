import { useState, type FormEvent } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  submitStepUp: (password: string) => Promise<void>
}

export default function AdminStepUpModal({ open, onClose, onSuccess, submitStepUp }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await submitStepUp(password)
      setPassword('')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Step-up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-dc-border bg-dc-elevated-solid p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-dc-text">Confirm your password</h2>
        <p className="mt-2 text-sm text-dc-muted">
          Sensitive admin actions require a recent password confirmation (valid for 30 minutes).
        </p>
        <form className="mt-4 space-y-3" onSubmit={(e) => void handleSubmit(e)}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
            placeholder="Your password"
          />
          {error ?
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          : null}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-dc-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !password}
              className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground disabled:opacity-60"
            >
              {busy ? 'Confirming…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
