import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import type { IsoBoardPitch, IsoBoardViewItem } from '@/lib/iso-board-view'

export default function IsoBoardCard({
  item,
  cardRef,
  messagingBusy,
  onMessage,
  onEditIso,
  onViewFull,
}: {
  item: IsoBoardViewItem
  cardRef?: (el: HTMLElement | null) => void
  messagingBusy?: boolean
  onMessage: (pitch?: IsoBoardPitch) => void
  onEditIso?: () => void
  onViewFull: () => void
}) {
  const signalLine = [item.roles.join(' · '), item.capacity].filter(Boolean).join(' · ')
  const visiblePitches = item.pitches.slice(0, 2)
  const morePitches = Math.max(0, item.pitches.length - 2)

  return (
    <article
      ref={cardRef}
      id={`iso-board-card-${item.userId}`}
      className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-4 sm:px-5 sm:py-5"
    >
      <header className="flex items-start gap-3">
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <PlaceholderAvatar size="sm" className="h-11 w-11 shrink-0 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-[16px] font-semibold text-dc-text">{item.displayName}</h3>
            {item.isSelf ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent">Your card</span>
            ) : null}
          </div>
          <p className="text-[13px] text-dc-muted">@{item.username}</p>
        </div>
      </header>

      {signalLine ? <p className="mt-3 text-[14px] font-medium text-dc-text">{signalLine}</p> : null}
      <p className="mt-1 text-[13px] leading-snug text-dc-muted">{item.approachLabel}</p>

      {visiblePitches.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">Scene ideas</p>
          <ul className="mt-1 space-y-1">
            {visiblePitches.map((pitch) => (
              <li key={pitch.id ?? pitch.title}>
                {item.acceptsIsoMessages && !item.isSelf ? (
                  <button
                    type="button"
                    disabled={messagingBusy}
                    onClick={() => onMessage(pitch)}
                    className="group flex w-full min-h-11 items-center justify-between gap-2 rounded-lg text-left text-[15px] font-medium text-dc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)]"
                    aria-label={`Message ${item.displayName} about ${pitch.title}`}
                  >
                    <span className="line-clamp-2 group-hover:underline">{pitch.title}</span>
                    <span className="shrink-0 text-dc-muted" aria-hidden>
                      ›
                    </span>
                  </button>
                ) : (
                  <p className="text-[15px] font-medium text-dc-text line-clamp-2">{pitch.title}</p>
                )}
              </li>
            ))}
            {morePitches > 0 ? <li className="text-[13px] text-dc-muted">+{morePitches} more</li> : null}
          </ul>
        </div>
      ) : item.fallbackTags.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">Open to</p>
          <p className="mt-1 text-[14px] text-dc-text-muted">{item.fallbackTags.join(' · ')}</p>
        </div>
      ) : item.legacyExcerpt ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">From their ISO</p>
          <p className="mt-1 whitespace-pre-wrap text-[14px] text-dc-text-muted line-clamp-3">{item.legacyExcerpt}</p>
        </div>
      ) : null}

      {visiblePitches.length && item.tags.length ? (
        <p className="mt-2 text-[13px] text-dc-muted">{item.tags.join(' · ')}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {item.isSelf ? (
          <>
            {onEditIso ? (
              <button
                type="button"
                onClick={onEditIso}
                className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
              >
                Edit my ISO
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onViewFull()
              }}
              className="min-h-11 inline-flex items-center justify-center text-sm font-medium text-dc-accent"
            >
              View full ISO ›
            </button>
          </>
        ) : item.acceptsIsoMessages ? (
          <>
            <button
              type="button"
              disabled={messagingBusy}
              onClick={() => onMessage()}
              className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
            >
              {messagingBusy ? 'Opening…' : 'Message about a scene'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onViewFull()
              }}
              className="min-h-11 inline-flex items-center justify-center text-sm font-medium text-dc-muted hover:text-dc-accent"
            >
              View full ISO ›
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onViewFull()
              }}
              className="min-h-11 inline-flex items-center justify-center rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
            >
              View full ISO
            </button>
            <p className="text-center text-[12px] text-dc-muted">Not accepting new ISO messages</p>
          </>
        )}
      </div>
    </article>
  )
}
