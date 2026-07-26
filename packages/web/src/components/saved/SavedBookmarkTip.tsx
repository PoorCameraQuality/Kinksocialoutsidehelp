export default function SavedBookmarkTip() {
  return (
    <div className="mt-8 flex gap-3 rounded-2xl border border-dc-border/80 bg-dc-surface-muted/50 p-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dc-accent-muted text-dc-accent"
        aria-hidden
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </span>
      <p className="text-xs leading-relaxed text-dc-text-muted">
        <span className="font-medium text-dc-text">Tip:</span> Look for the bookmark icon on events, articles,
        media, vendors, and posts to save them to this page.
      </p>
    </div>
  )
}
