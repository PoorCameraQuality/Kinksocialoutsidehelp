import { cn } from '@/lib/cn'

const GRADIENTS = [
  'from-teal-600/80 via-emerald-900/70 to-slate-950',
  'from-violet-600/75 via-indigo-950/80 to-slate-950',
  'from-amber-600/70 via-orange-950/75 to-slate-950',
  'from-sky-600/75 via-blue-950/80 to-slate-950',
  'from-rose-600/70 via-fuchsia-950/75 to-slate-950',
] as const

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function personInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function personDisplayLabel(username: string, sceneName?: string | null): string {
  const trimmed = sceneName?.trim()
  return trimmed || username
}

function gradientClass(seed: string): string {
  return GRADIENTS[hashSeed(seed) % GRADIENTS.length]!
}

/** Tailwind gradient classes for initials fallback panels (e.g. directory photo strips). */
export function personAvatarGradientClass(seed: string): string {
  return gradientClass(seed)
}

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-14 w-14 text-base',
  lg: 'h-16 w-16 text-lg',
} as const

type Props = {
  username: string
  sceneName?: string | null
  avatarUrl?: string | null
  size?: keyof typeof SIZE_CLASS
  verified?: boolean
  className?: string
  rounded?: 'full' | 'xl'
}

/** Person/presenter avatar with initials gradient fallback. */
export default function PersonAvatar({
  username,
  sceneName,
  avatarUrl,
  size = 'md',
  verified = false,
  className,
  rounded = 'full',
}: Props) {
  const label = personDisplayLabel(username, sceneName)
  const roundClass = rounded === 'xl' ? 'rounded-xl' : 'rounded-full'

  const inner = avatarUrl ?
    <img
      src={avatarUrl}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('h-full w-full object-cover', roundClass)}
    />
  : <span className="font-semibold text-white/95">{personInitials(label)}</span>

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br',
        !avatarUrl && gradientClass(username),
        SIZE_CLASS[size],
        roundClass,
        verified ? 'ring-2 ring-dc-accent' : 'ring-1 ring-dc-border/80',
        className,
      )}
    >
      {inner}
    </span>
  )
}
