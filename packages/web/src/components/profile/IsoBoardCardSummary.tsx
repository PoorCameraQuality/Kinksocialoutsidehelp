import { normalizeIsoBoardItem } from '@/lib/iso-board-view'

/** Compact digest for convention mini boards and other shared surfaces. */
export default function IsoBoardCardSummary({
  body,
  structured,
}: {
  body: string
  structured?: unknown
}) {
  const item = normalizeIsoBoardItem(
    {
      userId: 'preview',
      username: 'preview',
      displayName: null,
      avatarUrl: null,
      body,
      structured,
      acceptDmsViaIso: false,
    },
    null,
  )

  if (!item) return <p className="mt-2 text-sm text-dc-muted">No details yet.</p>

  const signalLine = [item.roles.join(' · '), item.capacity].filter(Boolean).join(' · ')
  const pitches = item.pitches.slice(0, 2)

  if (!signalLine && !pitches.length && !item.fallbackTags.length && !item.legacyExcerpt) {
    return <p className="mt-2 text-sm text-dc-muted">No details yet.</p>
  }

  return (
    <div className="mt-2 space-y-2">
      {signalLine ? <p className="text-[14px] font-medium text-dc-text">{signalLine}</p> : null}
      <p className="text-[13px] text-dc-muted">{item.approachLabel}</p>

      {pitches.length ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">Scene ideas</p>
          <ul className="mt-0.5 space-y-0.5">
            {pitches.map((p) => (
              <li key={p.id ?? p.title} className="text-[15px] font-medium text-dc-text line-clamp-1">
                {p.title}
              </li>
            ))}
            {item.pitches.length > 2 ? (
              <li className="text-[13px] text-dc-muted">+{item.pitches.length - 2} more</li>
            ) : null}
          </ul>
        </div>
      ) : item.fallbackTags.length ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">Open to</p>
          <p className="mt-0.5 text-[14px] text-dc-text-muted">{item.fallbackTags.join(' · ')}</p>
        </div>
      ) : item.legacyExcerpt ? (
        <p className="whitespace-pre-wrap text-sm text-dc-text-muted line-clamp-3">{item.legacyExcerpt}</p>
      ) : null}

      {pitches.length && item.tags.length ? (
        <p className="text-[13px] text-dc-muted">{item.tags.join(' · ')}</p>
      ) : null}
    </div>
  )
}
