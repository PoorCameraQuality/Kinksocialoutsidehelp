import { useCallback, useState } from 'react'

type Props = {
  orgSlug: string
}

type MintResult = {
  token: string
  claimUrl: string
  expiresAt: string
}

export default function OrgClaimTransferPanel({ orgSlug }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInvite, setLastInvite] = useState<MintResult | null>(null)
  const [copied, setCopied] = useState(false)

  const mint = useCallback(async () => {
    setBusy(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/claim-tokens`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInHours: 168 }),
      })
      const data = (await res.json()) as {
        error?: string
        invite?: { token: string; claimUrl: string; expiresAt: string }
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not create claim link')
        return
      }
      if (data.invite) {
        setLastInvite({
          token: data.invite.token,
          claimUrl: data.invite.claimUrl,
          expiresAt: data.invite.expiresAt,
        })
      }
    } catch {
      setError('Could not create claim link')
    } finally {
      setBusy(false)
    }
  }, [orgSlug])

  const copyUrl = useCallback(async () => {
    if (!lastInvite?.claimUrl) return
    try {
      await navigator.clipboard.writeText(lastInvite.claimUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }, [lastInvite?.claimUrl])

  return (
    <div className="rounded-xl border border-dc-border/80 bg-dc-surface/30 px-4 py-4">
      <h3 className="text-sm font-semibold text-dc-text">Transfer ownership</h3>
      <p className="mt-2 text-xs leading-relaxed text-dc-text-muted">
        Generate a one-time claim link for the rightful organizer. They become owner and you are removed from this
        organization.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void mint()}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40 disabled:opacity-60"
      >
        {busy ? 'Creating…' : 'Generate claim link'}
      </button>
      {error ?
        <p className="mt-3 text-xs text-red-300" role="alert">
          {error}
        </p>
      : null}
      {lastInvite ?
        <div className="mt-4 space-y-2 rounded-lg border border-dc-border/60 bg-dc-elevated-solid/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted">One-time claim URL</p>
          <p className="break-all font-mono text-xs text-dc-text">{lastInvite.claimUrl}</p>
          <p className="text-[10px] text-dc-muted">Expires {new Date(lastInvite.expiresAt).toLocaleString()}</p>
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs text-dc-text-muted hover:text-dc-text"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      : null}
    </div>
  )
}
