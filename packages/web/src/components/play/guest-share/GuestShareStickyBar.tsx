export default function GuestShareStickyBar({
  label,
  disabled,
  busy,
  onClick,
}: {
  label: string
  disabled?: boolean
  busy?: boolean
  onClick: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-dc-border bg-[var(--dc-elevated)]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-xl px-4 py-3 sm:px-6">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onClick}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-dc-accent px-4 text-[15px] font-semibold text-dc-accent-foreground disabled:opacity-40"
        >
          {busy ? 'Sending…' : label}
        </button>
      </div>
    </div>
  )
}
