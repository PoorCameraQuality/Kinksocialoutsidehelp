import type { IsoBoardPitch, IsoBoardViewItem } from '@/lib/iso-board-view'

export default function IsoPitchMessageSheet({
  item,
  open,
  busy,
  onClose,
  onPick,
}: {
  item: IsoBoardViewItem | null
  open: boolean
  busy?: boolean
  onClose: () => void
  onPick: (pitch?: IsoBoardPitch) => void
}) {
  if (!open || !item) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a scene to message about"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-dc-border bg-dc-elevated p-4 shadow-[var(--dc-shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[16px] font-semibold text-dc-text">What would you like to message about?</p>
        <ul className="mt-3 space-y-1">
          {item.pitches.map((pitch) => (
            <li key={pitch.id ?? pitch.title}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(pitch)}
                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[15px] font-medium text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
              >
                {pitch.title}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick()}
              className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[15px] font-medium text-dc-text-muted hover:bg-dc-elevated-muted disabled:opacity-50"
            >
              Another part of {item.displayName}&apos;s ISO
            </button>
          </li>
        </ul>
        <button
          type="button"
          className="mt-3 min-h-11 w-full text-sm font-medium text-dc-muted"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
