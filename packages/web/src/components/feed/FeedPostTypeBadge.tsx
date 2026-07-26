import { feedPostBadgeMeta, type FeedPostBadge } from '@/components/feed/feedPostBadge'

export default function FeedPostTypeBadge({ badge }: { badge: FeedPostBadge }) {
  const meta = feedPostBadgeMeta(badge.kind)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}
