import { Link } from 'react-router-dom'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { visibilityLabel } from '@/lib/organizer/build-org-checklist'

type FeatureRow = { id: string; label: string; enabled: boolean }

type Props = {
  displayName: string
  slug: string
  visibility: string
  features: FeatureRow[]
  publicHubHref: string
  editContentHref?: string
}

function FeaturePill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        enabled ?
          'border-emerald-500/30 bg-emerald-950/25 text-emerald-200'
        : 'border-dc-border bg-dc-surface/50 text-dc-muted'
      }`}
    >
      {label}
      {enabled ? '' : ' · off'}
    </span>
  )
}

export default function PublicHubPreviewCard({
  displayName,
  slug,
  visibility,
  features,
  publicHubHref,
  editContentHref,
}: Props) {
  return (
    <OrganizerPanel
      title="Public hub preview"
      description="What visitors and members see on the community page. Separate from this console."
    >
      <div className="rounded-xl border border-dc-border bg-dc-surface/50 p-4">
        <p className="font-medium text-dc-text">{displayName}</p>
        <p className="text-dc-micro text-dc-text-muted">/orgs/{slug}</p>
        <p className="mt-2 text-sm text-dc-text-muted">
          Visibility: <span className="text-dc-text">{visibilityLabel(visibility)}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {features.map((f) => (
            <FeaturePill key={f.id} label={f.label} enabled={f.enabled} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={publicHubHref}
          className="inline-flex min-h-10 items-center rounded-lg border border-dc-border px-3 text-sm text-dc-text hover:border-dc-border-strong"
        >
          View public hub
        </Link>
        {editContentHref ?
          <Link
            to={editContentHref}
            className="inline-flex min-h-10 items-center rounded-lg border border-dc-border px-3 text-sm text-dc-accent hover:underline"
          >
            Edit hub content
          </Link>
        : null}
      </div>
    </OrganizerPanel>
  )
}
