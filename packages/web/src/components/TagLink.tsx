type TagLinkProps = {
  tag: string
  className?: string
}

/** Tag label pill - not linked until a real tag browse API exists. */
export default function TagLink({ tag, className = '' }: TagLinkProps) {
  const normalized = tag.trim().toLowerCase()
  if (!normalized) return null
  return (
    <span
      className={`inline-block rounded-md bg-dc-elevated-muted px-2 py-0.5 text-xs text-dc-muted ${className}`.trim()}
    >
      #{normalized}
    </span>
  )
}
