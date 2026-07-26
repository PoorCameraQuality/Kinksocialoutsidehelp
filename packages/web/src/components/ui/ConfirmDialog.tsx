import Dialog from '@/components/ui/Dialog'

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** In-app replacement for `window.confirm`. */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-10 rounded-xl px-4 text-sm font-medium text-dc-accent-foreground disabled:opacity-50 ${
              destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-dc-accent hover:bg-dc-accent-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {description ? null : <p className="text-sm text-dc-muted">This action cannot be undone.</p>}
    </Dialog>
  )
}
