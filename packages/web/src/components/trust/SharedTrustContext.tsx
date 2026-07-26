type Props = {
  sharedOrganizations: number
  sharedGroups: number
  sharedEvents: number
  compact?: boolean
}

export default function SharedTrustContext({
  sharedOrganizations,
  sharedGroups,
  sharedEvents,
  compact,
}: Props) {
  const parts: string[] = []
  if (sharedOrganizations > 0) {
    parts.push(`${sharedOrganizations} shared org${sharedOrganizations === 1 ? '' : 's'}`)
  }
  if (sharedGroups > 0) {
    parts.push(`${sharedGroups} shared group${sharedGroups === 1 ? '' : 's'}`)
  }
  if (sharedEvents > 0) {
    parts.push(`both attended ${sharedEvents} event${sharedEvents === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) {
    return (
      <p className={compact ? 'text-[11px] text-dc-muted' : 'text-xs text-dc-muted'}>
        You have no shared organizations, groups, or verified event attendance with this member.
      </p>
    )
  }
  return (
    <p className={compact ? 'text-[11px] text-dc-muted' : 'text-xs text-dc-muted'}>
      {parts.join(' · ')}
    </p>
  )
}
