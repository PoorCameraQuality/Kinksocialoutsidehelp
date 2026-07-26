type Props = {
  open: boolean
  onToggle: () => void
  username: string
  onUsernameChange: (v: string) => void
  busy: boolean
  onSubmit: () => void
  notice: { kind: 'success' | 'error'; text: string } | null
  onDismissNotice: () => void
}

export default function ConnectionsSendRequestPanel({
  open,
  onToggle,
  username,
  onUsernameChange,
  busy,
  onSubmit,
  notice,
  onDismissNotice,
}: Props) {
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:border-dc-accent-border hover:text-dc-text"
        aria-expanded={open}
      >
        Send request by username
        <span className="text-dc-muted" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ?
        <div className="mt-3 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4">
          <label htmlFor="conn-send-user" className="sr-only">
            Username
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="conn-send-user"
              type="text"
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              disabled={busy}
              className="min-h-11 flex-1 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text disabled:opacity-50"
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || !username.trim()}
              className="min-h-11 shrink-0 rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
          <p className="mt-2 text-xs text-dc-muted">Use this if you know their Kink Social username.</p>
          {notice ?
            <div
              className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                notice.kind === 'success' ?
                  'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
                : 'border-red-500/30 bg-red-950/25 text-red-200'
              }`}
              role={notice.kind === 'success' ? 'status' : 'alert'}
            >
              <div className="flex items-start justify-between gap-2">
                <p>{notice.text}</p>
                {notice.kind === 'error' ?
                  <button type="button" onClick={onDismissNotice} className="text-xs underline">
                    Dismiss
                  </button>
                : null}
              </div>
            </div>
          : null}
        </div>
      : null}
    </div>
  )
}
