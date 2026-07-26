import FeedTapControl from '@/components/feed/FeedTapControl'
import { FEED_REACTION_IDS, type FeedReactionId } from '@c2k/shared'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'
import { FEED_REACTION_OPTIONS } from '@/lib/feed-reaction-ui'
import { cn } from '@/lib/cn'

type Props = {
  reactionCounts: FeedReactionCounts
  viewerReaction: FeedReactionId | null
  busy?: boolean
  disabled?: boolean
  compact?: boolean
  centered?: boolean
  /** Horizontal inline bar (feed cards): icon-only below sm, single row. */
  inline?: boolean
  onReaction: (kind: FeedReactionId) => void
}

export default function FeedReactionsRow({
  reactionCounts,
  viewerReaction,
  busy,
  disabled,
  compact = false,
  centered = false,
  inline = false,
  onReaction,
}: Props) {
  const inlineBar = inline || (compact && centered)

  return (
    <div
      className={cn(
        inlineBar ? 'feed-action-bar__reactions' : 'flex shrink-0 items-center',
        !inlineBar && (compact ? 'flex-wrap gap-1' : 'flex-wrap gap-1.5'),
        centered && !inlineBar && 'w-full justify-center',
      )}
      role="group"
      aria-label="Reactions"
    >
      {FEED_REACTION_OPTIONS.map(({ id, label, title, hint, Icon }) => {
        const active = viewerReaction === id
        const count = reactionCounts[id] ?? 0
        const isDisabled = disabled || busy
        const tooltip = active ? `Remove ${title}` : `${title} — ${hint}`

        return (
          <FeedTapControl
            key={id}
            disabled={isDisabled}
            ringOnTap
            aria-pressed={active}
            onClick={() => onReaction(id)}
            title={tooltip}
            aria-label={`${label}. ${hint}${count > 0 ? `. ${count} reactions` : ''}`}
            className={cn(
              inlineBar ?
                'feed-action-bar__btn disabled:cursor-wait disabled:opacity-60'
              : 'inline-flex shrink-0 items-center justify-center gap-1 rounded-full font-medium disabled:cursor-wait disabled:opacity-60',
              !inlineBar && (
                compact ?
                  'min-h-11 min-w-[44px] px-3 py-2 text-xs'
                : 'min-h-11 min-w-[44px] px-3 py-2 text-xs'
              ),
              active ?
                'bg-dc-accent-muted text-dc-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--dc-accent)_35%,transparent)]'
              : inlineBar ?
                undefined
              : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text',
              inlineBar && !active && 'hover:bg-dc-elevated-hover hover:text-dc-text',
            )}
          >
            <Icon className={cn(!inlineBar && 'shrink-0', inlineBar ? undefined : compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5')} />
            <span className={cn(inlineBar ? 'feed-action-bar__label' : 'leading-none')}>{label}</span>
            {count > 0 ?
              <span className={cn('tabular-nums opacity-80', inlineBar ? 'text-[10px]' : compact ? 'text-[10px]' : 'text-[11px]')}>{count}</span>
            : null}
          </FeedTapControl>
        )
      })}
    </div>
  )
}

export type { FeedReactionId }
export { FEED_REACTION_IDS }
