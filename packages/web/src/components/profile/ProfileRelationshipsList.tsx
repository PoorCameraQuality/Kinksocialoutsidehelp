import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'

export type PublicRelationshipItem = {
  id: string
  kind: 'relationship' | 'ds'
  label: string
  partnerUsername: string | null
  customText: string | null
}

export function formatPublicRelationshipLine(item: PublicRelationshipItem): string {
  const parts = [item.label]
  if (item.partnerUsername) parts.push(`@${item.partnerUsername}`)
  if (item.customText) parts.push(`, ${item.customText}`)
  return parts.join(' ')
}

export default function ProfileRelationshipsList({
  relationships,
  title,
}: {
  relationships: PublicRelationshipItem[]
  title: string
}) {
  if (relationships.length === 0) return null

  const rel = relationships.filter((r) => r.kind === 'relationship')
  const ds = relationships.filter((r) => r.kind === 'ds')

  return (
    <Card padding="lg" className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dc-muted">{title}</h2>
      {rel.length > 0 ?
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Relationships</p>
          <ul className="space-y-1.5">
            {rel.map((item) => (
              <li key={item.id} className="text-sm text-dc-text-muted">
                {formatPublicRelationshipLine(item)}
                {item.partnerUsername ?
                  <>
                    {' '}
                    <Link
                      to={`/profile/${encodeURIComponent(item.partnerUsername)}`}
                      className="text-dc-accent hover:underline"
                    >
                      view profile
                    </Link>
                  </>
                : null}
              </li>
            ))}
          </ul>
        </div>
      : null}
      {ds.length > 0 ?
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">D/s</p>
          <ul className="space-y-1.5">
            {ds.map((item) => (
              <li key={item.id} className="text-sm text-dc-text-muted">
                {formatPublicRelationshipLine(item)}
                {item.partnerUsername ?
                  <>
                    {' '}
                    <Link
                      to={`/profile/${encodeURIComponent(item.partnerUsername)}`}
                      className="text-dc-accent hover:underline"
                    >
                      view profile
                    </Link>
                  </>
                : null}
              </li>
            ))}
          </ul>
        </div>
      : null}
    </Card>
  )
}
