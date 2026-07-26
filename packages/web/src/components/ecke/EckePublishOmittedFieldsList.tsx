type OmittedField = {
  label: string
  reason: string
}

type Props = {
  fields: OmittedField[]
  className?: string
}

export default function EckePublishOmittedFieldsList({ fields, className = '' }: Props) {
  if (fields.length === 0) {
    return <p className={`text-sm text-dc-text-muted ${className}`}>No additional private fields omitted.</p>
  }

  return (
    <ul className={`space-y-1.5 text-sm text-dc-text-muted ${className}`}>
      {fields.map((f) => (
        <li key={f.label} className="flex gap-2">
          <span className="text-dc-text shrink-0">–</span>
          <span>
            <span className="font-medium text-dc-text">{f.label}</span>
            {f.reason ? <span className="text-dc-text-muted"> — {f.reason}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}
