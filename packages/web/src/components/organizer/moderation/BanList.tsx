import { useState } from 'react'
import { ModSection } from '@/components/organizer/moderation/moderation-ui'
import EmptyState from '@/components/ui/EmptyState'
import { useConfirm } from '@/hooks/useConfirm'

export type BanRow = {
  id: string
  userId: string
  username: string
  reason: string | null
  createdAt: string
}

type Props = {
  bans: BanRow[]
  loading: boolean
  canManage: boolean
  onSubmitBan: (userId: string, reason: string, escalate: boolean) => Promise<string | null>
  onLiftBan: (userId: string) => Promise<void>
}

export default function BanList({ bans, loading, canManage, onSubmitBan, onLiftBan }: Props) {
  const { confirm, confirmDialog } = useConfirm()
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [escalate, setEscalate] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  async function submit() {
    setMsg(null)
    const err = await onSubmitBan(banUserId.trim(), banReason.trim(), escalate)
    setMsg(err ?? 'Ban applied.')
    if (!err) {
      setBanUserId('')
      setBanReason('')
      setEscalate(false)
      setShowForm(false)
    }
  }

  async function lift(userId: string, username: string) {
    if (!(await confirm(`Lift ban for @${username}?`, 'They will be able to participate in this organization again.')))
      return
    setBusyUserId(userId)
    try {
      await onLiftBan(userId)
      setMsg('Ban lifted.')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <ModSection>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dc-text">Banned members</h3>
          <p className="mt-1 text-sm text-dc-text-muted">
            Members banned from this organization cannot participate in the public hub.
          </p>
        </div>
        {canManage ?
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            {showForm ? 'Cancel' : 'Add ban'}
          </button>
        : null}
      </div>

      {canManage && showForm ?
        <div className="mt-4 space-y-3 rounded-xl border border-dc-border bg-dc-surface/30 p-4">
          <label className="block text-sm font-medium text-dc-text" htmlFor="ban-user-id">
            Member user ID
          </label>
          <input
            id="ban-user-id"
            value={banUserId}
            onChange={(e) => setBanUserId(e.target.value)}
            placeholder="UUID from member roster"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 font-mono text-sm text-dc-text"
          />
          <label className="block text-sm font-medium text-dc-text" htmlFor="ban-reason">
            Reason (optional)
          </label>
          <textarea
            id="ban-reason"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
          />
          <label className="flex items-center gap-2 text-sm text-dc-text-muted">
            <input type="checkbox" checked={escalate} onChange={(e) => setEscalate(e.target.checked)} />
            Also ask Kink Social platform to review (serious safety cases)
          </label>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!banUserId.trim()}
            className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
          >
            Apply org ban
          </button>
        </div>
      : null}

      {msg ?
        <p className="mt-3 text-sm text-dc-text-muted" role="status">
          {msg}
        </p>
      : null}

      <div className="mt-5">
        {loading ?
          <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
        : bans.length === 0 ?
          <EmptyState
            inline
            title="No banned members"
            message="Members who are banned from this organization will appear here."
            nextSteps={['Use bans carefully and keep a clear audit trail for safety decisions.']}
            actionLabel={canManage ? 'Add ban' : undefined}
            onAction={canManage ? () => setShowForm(true) : undefined}
          />
        : (
          <ul className="space-y-2">
            {bans.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-red-500/20 bg-red-950/10 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-dc-text">@{b.username}</p>
                  <p className="mt-1 text-sm text-dc-text-muted">{b.reason ?? 'No reason recorded'}</p>
                  <p className="mt-1 text-xs text-dc-muted">
                    Org ban · {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
                {canManage ?
                  <button
                    type="button"
                    disabled={busyUserId === b.userId}
                    onClick={() => void lift(b.userId, b.username)}
                    className="mt-3 inline-flex min-h-9 shrink-0 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text sm:mt-0"
                  >
                    Lift ban
                  </button>
                : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-xs text-dc-muted">
        Org bans are active until lifted. There is no automatic expiration in the current system.
      </p>
      {confirmDialog}
    </ModSection>
  )
}
