import { cn } from '@/lib/cn'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type Props = {
  label: string
  imageUrl?: string | null
  /** Logo marks use contain on a light plate; photos/banners use cover. */
  variant?: 'logo' | 'photo'
  className?: string
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export default function ProfileEntityAvatar({
  label,
  imageUrl,
  variant = 'logo',
  className,
}: Props) {
  const resolved = mediaDisplayUrl(imageUrl)

  if (resolved) {
    return (
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg',
          variant === 'logo' ? 'bg-white/95 p-1 ring-1 ring-inset ring-white/20' : 'bg-dc-surface-muted ring-1 ring-inset ring-white/[0.06]',
          className,
        )}
      >
        <img
          src={resolved}
          alt=""
          className={cn('h-full w-full', variant === 'logo' ? 'object-contain' : 'object-cover')}
          loading="lazy"
          decoding="async"
        />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dc-accent/15 text-sm font-bold text-dc-accent',
        className,
      )}
      aria-hidden
    >
      {initials(label)}
    </span>
  )
}
