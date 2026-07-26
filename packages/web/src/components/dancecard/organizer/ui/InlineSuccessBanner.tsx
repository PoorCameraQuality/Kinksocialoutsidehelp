'use client'

export function InlineSuccessBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        {onDismiss ? (
          <button type="button" className="shrink-0 text-xs text-emerald-700/80 hover:text-dc-text" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  )
}
