import TrustBadgeTooltip from './TrustBadgeTooltip'

type Props = {
  label: string
  description: string
  compact?: boolean
}

export default function TrustBadge({ label, description, compact }: Props) {
  return (
    <TrustBadgeTooltip description={description}>
      <span
        className={
          compact
            ? 'inline-flex items-center rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-[11px] font-medium text-dc-text'
            : 'inline-flex items-center rounded-lg border border-dc-border bg-dc-elevated-solid px-2.5 py-1 text-xs font-medium text-dc-text'
        }
      >
        {label}
      </span>
    </TrustBadgeTooltip>
  )
}
