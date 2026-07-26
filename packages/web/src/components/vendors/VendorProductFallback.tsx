import { cn } from '@/lib/cn'

function vendorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

type Props = {
  vendorName: string
  category?: string | null
  compact?: boolean
  className?: string
}

/** Polished placeholder when a vendor listing has no product image or logo. */
export default function VendorProductFallback({ vendorName, category, compact, className }: Props) {
  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-violet-950/45 via-dc-surface-muted to-slate-950 c2k-vendor-cover-fallback',
        compact ? 'aspect-[2/1] max-h-32' : 'aspect-[4/3] max-h-52',
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          'rounded-full border border-white/10 bg-black/25 font-semibold text-white/90',
          compact ? 'px-3 py-2 text-lg' : 'px-4 py-3 text-2xl',
        )}
      >
        {vendorInitials(vendorName)}
      </span>
      {category && !compact ?
        <span className="mt-2 max-w-[85%] truncate text-center text-[10px] font-medium uppercase tracking-wide text-dc-text-muted/90">
          {category}
        </span>
      : null}
    </div>
  )
}
