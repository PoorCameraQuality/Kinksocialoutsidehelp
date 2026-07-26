type Props = {
  eyebrow?: string
  title: string
  description?: string
  className?: string
}

export default function SectionHeader({ eyebrow, title, description, className = '' }: Props) {
  return (
    <header className={`space-y-1 ${className}`.trim()}>
      {eyebrow ? (
        <p className="text-dc-micro uppercase tracking-wide text-dc-muted">{eyebrow}</p>
      ) : null}
      <h2 className="text-lg font-semibold font-display text-dc-text">{title}</h2>
      {description ? <p className="text-sm text-dc-muted max-w-prose">{description}</p> : null}
    </header>
  )
}
