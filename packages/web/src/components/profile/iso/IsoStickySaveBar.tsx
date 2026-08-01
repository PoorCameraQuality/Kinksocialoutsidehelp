export default function IsoStickySaveBar({
  status,
  primaryLabel,
  busy,
  onPrimary,
  onPreview,
  previewOpen,
}: {
  status: string
  primaryLabel: string
  busy?: boolean
  onPrimary: () => void
  onPreview?: () => void
  previewOpen?: boolean
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-dc-border bg-dc-elevated/95 px-4 pt-3 shadow-[var(--dc-shadow-soft)] backdrop-blur-sm safe-area-pb c2k-fixed-above-bottom-nav lg:z-40">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        {onPreview ? (
          <button
            type="button"
            onClick={onPreview}
            className="min-h-11 shrink-0 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
          >
            {previewOpen ? 'Hide preview' : 'Preview'}
          </button>
        ) : (
          <p className="min-w-0 text-[13px] text-dc-muted truncate" role="status">
            {status}
          </p>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {onPreview ? (
            <p className="hidden min-w-0 text-[13px] text-dc-muted truncate sm:block" role="status">
              {status}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onPrimary}
            className="min-h-11 shrink-0 rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
          >
            {busy ? 'Saving…' : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
