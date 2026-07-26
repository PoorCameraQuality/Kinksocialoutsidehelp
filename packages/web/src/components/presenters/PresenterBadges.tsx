import Badge from '@/components/ui/Badge'
import { presenterBadgeLabel } from '@/lib/presenter-badges-display'
import type { PresenterBadgeKey } from '@/lib/presenter-badges-types'

type Props = {
  badges: PresenterBadgeKey[]
  compact?: boolean
  className?: string
}

export default function PresenterBadges({ badges, compact, className = '' }: Props) {
  if (badges.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {badges.map((key) => (
        <Badge key={key} variant="neutral" className={compact ? 'text-[10px]' : undefined}>
          {presenterBadgeLabel(key)}
        </Badge>
      ))}
    </div>
  )
}
