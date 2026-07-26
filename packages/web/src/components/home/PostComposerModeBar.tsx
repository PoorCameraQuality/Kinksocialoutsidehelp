/** Home feed composer is status-only; long-form education posts use `/education/write`. */
export type PostComposerMode = 'status'

/** Static label - journal/article modes moved to education authoring. */
export default function PostComposerModeBar() {
  return (
    <div
      className="flex rounded-full border border-dc-border bg-dc-elevated-solid/90 px-3 py-1.5"
      aria-label="Post type: status"
    >
      <span className="text-[11px] sm:text-xs font-medium text-dc-muted uppercase tracking-wide">Status</span>
    </div>
  )
}
