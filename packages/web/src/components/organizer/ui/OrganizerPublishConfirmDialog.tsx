import { useEffect, useRef } from 'react'

export type OrganizerPublishConfirmDialogProps = {
  open: boolean
  title: string
  itemLabel: string
  itemKind?: 'convention' | 'event' | 'organization' | 'group'
  includeEcke: boolean
  onIncludeEckeChange: (next: boolean) => void
  /** When false, only Kink Social public listing is offered (no ECKE checkbox). */
  showEckeOption?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function OrganizerPublishConfirmDialog({
  open,
  title,
  itemLabel,
  itemKind = 'convention',
  includeEcke,
  onIncludeEckeChange,
  showEckeOption = true,
  busy = false,
  onConfirm,
  onCancel,
}: OrganizerPublishConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const kindNoun =
    itemKind === 'event' ? 'event'
    : itemKind === 'organization' ? 'organization'
    : itemKind === 'group' ? 'group'
    : 'convention'

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-[min(100%,28rem)] rounded-2xl border border-dc-border bg-dc-elevated/95 p-0 text-dc-text shadow-2xl backdrop:bg-black/70 open:flex open:flex-col"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      onClose={() => {
        if (!busy) onCancel()
      }}
    >
      <form
        method="dialog"
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy) onConfirm()
        }}
      >
        <div className="border-b border-dc-border px-5 py-4">
          <h2 className="text-lg font-semibold text-dc-text">{title}</h2>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-dc-text-muted">
          <p>
            You are about to list <strong className="text-dc-text">{itemLabel}</strong> for the public to see.
            Visitors will be able to open the public {kindNoun} page and browse the schedule (when a program is configured).
          </p>
          {showEckeOption ?
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-teal-500/25 bg-teal-950/20 px-3 py-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeEcke}
                onChange={(e) => onIncludeEckeChange(e.target.checked)}
                disabled={busy}
              />
              <span>
                <span className="block font-medium text-teal-100">Also publish to East Coast Kink Events</span>
                <span className="mt-1 block text-xs leading-relaxed text-teal-200/80">
                  List on our Google-searchable directory at eastcoastkinkevents.com. Includes the public listing and
                  Dancecard attendee experience when enabled.
                </span>
              </span>
            </label>
          : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-dc-border px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
