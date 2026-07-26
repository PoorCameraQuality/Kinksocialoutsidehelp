import { useState, type FormEvent, type ReactNode } from 'react'
import { useApiPaymentsVault } from '@/hooks/useApiPaymentsVault'

type Props = {
  children: ReactNode
  /** Optional heading above the gate form. */
  title?: string
}

/**
 * Blocks payments UI until the user sets a secondary payments password (first time)
 * or unlocks with it (30‑minute window).
 */
export default function PaymentsVaultGate({ children, title = 'Payments' }: Props) {
  const { status, loading, error, setup, unlock, lock } = useApiPaymentsVault()
  const [loginPassword, setLoginPassword] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [confirmVaultPassword, setConfirmVaultPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return <p className="text-sm text-dc-text-muted">Checking payments access…</p>
  }

  if (error && !status) {
    return (
      <p className="rounded-xl border border-dc-danger/40 bg-dc-danger/10 px-4 py-3 text-sm text-dc-text">
        {error}
      </p>
    )
  }

  if (status?.unlocked) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-dc-text-muted">
            Payments unlocked
            {status.unlockExpiresAt
              ? ` until ${new Date(status.unlockExpiresAt).toLocaleTimeString()}`
              : ''}
          </p>
          <button
            type="button"
            className="text-xs font-medium text-dc-text-muted hover:text-dc-text hover:underline"
            onClick={() => void lock()}
          >
            Lock now
          </button>
        </div>
        {children}
      </div>
    )
  }

  const onSetup = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await setup({ loginPassword, vaultPassword, confirmVaultPassword })
      setLoginPassword('')
      setVaultPassword('')
      setConfirmVaultPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  const onUnlock = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await unlock(vaultPassword)
      setVaultPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setBusy(false)
    }
  }

  if (!status?.configured) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/50 p-6">
        <h2 className="text-xl font-semibold text-dc-text">{title}</h2>
        <p className="text-sm text-dc-text-muted">
          Before you can view or change payment processing, create a{' '}
          <strong className="text-dc-text">separate payments password</strong>. This is not your login
          password — it only unlocks this area (about 30 minutes per unlock).
        </p>
        <form className="space-y-3" onSubmit={(e) => void onSetup(e)}>
          <label className="block text-xs text-dc-text-muted">
            Current login password
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs text-dc-text-muted">
            New payments password
            <input
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
              value={vaultPassword}
              onChange={(e) => setVaultPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label className="block text-xs text-dc-text-muted">
            Confirm payments password
            <input
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
              value={confirmVaultPassword}
              onChange={(e) => setConfirmVaultPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          {formError ? (
            <p className="text-sm text-dc-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-dc-accent px-4 py-2.5 text-sm font-medium text-dc-on-accent disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Create payments password'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/50 p-6">
      <h2 className="text-xl font-semibold text-dc-text">Unlock {title.toLowerCase()}</h2>
      <p className="text-sm text-dc-text-muted">
        Enter your payments password to view Stripe connection status and change processors.
      </p>
      <form className="space-y-3" onSubmit={(e) => void onUnlock(e)}>
        <label className="block text-xs text-dc-text-muted">
          Payments password
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
            value={vaultPassword}
            onChange={(e) => setVaultPassword(e.target.value)}
            required
          />
        </label>
        {formError ? (
          <p className="text-sm text-dc-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !vaultPassword}
          className="w-full rounded-lg bg-dc-accent px-4 py-2.5 text-sm font-medium text-dc-on-accent disabled:opacity-50"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
