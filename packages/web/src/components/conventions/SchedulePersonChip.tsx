import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'

type Variant = 'presenter' | 'staff'

function VendorIconLink({ vendorSlug, contextLabel }: { vendorSlug: string; contextLabel: string }) {
  return (
    <Link
      to={`/vendors/${encodeURIComponent(vendorSlug.trim())}`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-dc-muted transition-colors motion-safe:duration-150 hover:bg-white/[0.08] hover:text-dc-accent active:bg-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent"
      aria-label={`Vendor shop for ${contextLabel}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    </Link>
  )
}

export default function SchedulePersonChip({
  variant,
  username,
  displayName,
  avatarUrl,
  vendorSlug,
  presenterPublic,
  roleLabel,
  station,
  density = 'default',
}: {
  variant: Variant
  username: string
  displayName: string | null
  avatarUrl: string | null
  vendorSlug?: string | null
  presenterPublic?: boolean
  roleLabel?: string
  station?: string | null
  /** `compact` - smaller avatar/type, lighter chrome (staff rows, dense lists). */
  density?: 'default' | 'compact'
}) {
  const label = displayName?.trim() || username
  const usePresenterLink = variant === 'presenter' || Boolean(presenterPublic)
  const profileHref = usePresenterLink
    ? `/presenters/${encodeURIComponent(username)}`
    : `/profile/${encodeURIComponent(username)}`

  const meta = [roleLabel, station].filter((x) => Boolean(x && String(x).trim())).join(' · ')

  const compact = density === 'compact'
  const avatarWrap = compact ? 'h-6 w-6' : 'h-8 w-8'
  const imgClass = compact ? 'h-6 w-6 rounded-full object-cover' : 'h-8 w-8 rounded-full object-cover'
  const chipBorder = compact ? 'border-white/[0.05] bg-white/[0.03]' : 'border-dc-border bg-white/[0.04]'
  const nameClass = compact
    ? 'truncate text-xs font-medium text-dc-text/90 group-hover:text-dc-accent'
    : 'truncate text-sm font-medium text-dc-text group-hover:text-dc-accent'
  const metaClass = compact ? 'truncate text-[10px] text-dc-muted/90' : 'truncate text-[11px] text-dc-muted'

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-1">
      <Link
        to={profileHref}
        className={`group inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left shadow-sm transition-[background-color,border-color,box-shadow,transform] motion-safe:duration-150 hover:border-dc-accent-border/40 hover:bg-white/[0.05] hover:shadow-md motion-safe:hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent active:translate-y-0 motion-reduce:hover:translate-y-0 ${chipBorder} ${
          compact ? 'py-1' : 'py-1.5'
        }`}
      >
        <span className={`relative shrink-0 ${avatarWrap}`}>
          {avatarUrl ?
            <img src={avatarUrl} alt="" width={compact ? 24 : 32} height={compact ? 24 : 32} loading="lazy" decoding="async" className={imgClass} />
          : <PlaceholderAvatar size="sm" className={`!rounded-full ${compact ? '!h-6 !w-6 [&>svg]:!h-3 [&>svg]:!w-3' : ''}`} />}
        </span>
        <span className="min-w-0 flex flex-col">
          <span className={nameClass}>{label}</span>
          {variant === 'staff' && meta ?
            <span className={metaClass}>{meta}</span>
          : null}
        </span>
      </Link>
      {vendorSlug?.trim() ?
        <VendorIconLink vendorSlug={vendorSlug.trim()} contextLabel={label} />
      : null}
    </div>
  )
}
