/**
 * Trust tier indicator – Bronze | Silver | Gold.
 * Maps to swing-club-platform user_trust_metrics when API exists.
 * Kink Social dark theme with teal/amber accents.
 */
export type TrustTier = 'bronze' | 'silver' | 'gold'

const TIER_STYLES: Record<TrustTier, { bg: string; text: string; label: string }> = {
  bronze: { bg: 'bg-amber-900/30', text: 'text-amber-400', label: 'Bronze' },
  silver: { bg: 'bg-slate-400/20', text: 'text-slate-300', label: 'Silver' },
  gold: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Gold' },
}

export default function TrustTierIndicator({
  tier = 'bronze',
  size = 'md',
  showLabel = true,
  className = '',
}: {
  tier?: TrustTier
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}) {
  const style = TIER_STYLES[tier]
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${style.bg} ${style.text} ${sizeClasses[size]} ${className}`}
      title={`Trust tier: ${style.label}`}
    >
      <span aria-hidden>◆</span>
      {showLabel && <span>{style.label}</span>}
    </span>
  )
}
