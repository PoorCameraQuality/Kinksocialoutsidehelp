import { ModSection } from '@/components/organizer/moderation/moderation-ui'
import EmptyState from '@/components/ui/EmptyState'
import { formatAuditVerb } from '@/lib/organizer/org-moderation-utils'

export type AuditRow = {
  id: string
  verb: string
  targetType: string | null
  targetId: string | null
  payload: unknown
  createdAt: string
  actorUserId: string
}

type Props = {
  items: AuditRow[]
  loading: boolean
  forbidden: boolean
}

function payloadNote(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (typeof p.note === 'string' && p.note.trim()) return p.note
  if (typeof p.status === 'string') return `Status: ${p.status}`
  if (typeof p.reason === 'string') return p.reason
  return null
}

export default function AuditTimeline({ items, loading, forbidden }: Props) {
  return (
    <ModSection>
      <h3 className="text-lg font-semibold text-dc-text">Moderation audit</h3>
      <p className="mt-1 text-sm text-dc-text-muted">
        Chronological log of moderation and admin actions in this organization.
      </p>

      <div className="mt-5">
        {forbidden ?
          <p className="text-sm text-dc-text-muted">
            Audit history is available to organization owners and admins.
          </p>
        : loading ?
          <div className="h-32 animate-pulse rounded-xl bg-dc-elevated-muted" />
        : items.length === 0 ?
          <EmptyState
            inline
            title="No audit history yet"
            message="Moderation actions, role changes, bans, and report decisions will appear here when activity starts."
          />
        : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {items.map((a) => {
              const note = payloadNote(a.payload)
              return (
                <li key={a.id} className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5 text-sm">
                  <p className="font-medium text-dc-text">{formatAuditVerb(a.verb)}</p>
                  <p className="mt-1 text-xs text-dc-text-muted">
                    {a.targetType ? `${a.targetType.replace(/_/g, ' ')}` : '-'}
                    {a.targetId ? ` · ${a.targetId.slice(0, 8)}…` : ''}
                  </p>
                  {note ?
                    <p className="mt-1 text-xs text-dc-muted">{note}</p>
                  : null}
                  <p className="mt-1 text-[11px] text-dc-muted">{new Date(a.createdAt).toLocaleString()}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </ModSection>
  )
}
