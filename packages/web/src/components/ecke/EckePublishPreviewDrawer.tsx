import EckePublishOmittedFieldsList from '@/components/ecke/EckePublishOmittedFieldsList'

export type EckePreviewPlainField = {
  label: string
  value: string | null
}

export type EckePreviewData = {
  sourceKind: string
  sourceId: string
  eligible: boolean
  reason?: string
  supportState: string
  status: 'never' | 'draft' | 'published' | 'error' | 'stale' | 'unpublished'
  currentTransport: string
  eckeSurfacesAffected: readonly string[]
  lastPublishedAt: string | null
  lastError: string | null
  eckePublicUrl?: string | null
  eckePublicUrlKnown?: boolean
  staleNotice?: string | null
  wouldPublish: EckePreviewPlainField[]
  wouldPublishDeferred?: Array<{ label: string; reason: string }>
  wouldNotPublish: Array<{ label: string; reason: string }>
  payload: unknown
  actions: {
    preview: boolean
    publish: boolean
    sync: boolean
    unpublish: boolean
  }
  readOnlyPass?: boolean
  locationVisibility?: string
  locationHiddenWarning?: string | null
}

type Props = {
  open: boolean
  title: string
  preview: EckePreviewData | null
  onClose: () => void
}

export default function EckePublishPreviewDrawer({ open, title, preview, onClose }: Props) {
  if (!open || !preview) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ecke-preview-drawer-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close preview" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-dc-border bg-dc-surface shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-xl sm:border">
        <header className="flex items-start justify-between gap-3 border-b border-dc-border px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-dc-text-muted">ECKE preview</p>
            <h2 id="ecke-preview-drawer-title" className="text-lg font-semibold text-dc-text">
              {title}
            </h2>
            {preview.readOnlyPass ?
              <p className="mt-1 text-xs text-amber-200/90">Preview only — no data is sent until you publish.</p>
            : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-dc-border px-2 py-1 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {!preview.eligible && preview.reason ?
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
              {preview.reason}
            </div>
          : null}

          <section>
            <h3 className="text-sm font-semibold text-dc-text">This would appear on East Coast Kink Events as:</h3>
            <dl className="mt-2 space-y-2">
              {preview.wouldPublish.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-dc-text-muted">{row.label}</dt>
                  <dd className="text-sm text-dc-text break-words">{row.value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-dc-text">This would not be sent:</h3>
            <EckePublishOmittedFieldsList fields={preview.wouldNotPublish} className="mt-2" />
          </section>

          {preview.wouldPublishDeferred?.length ?
            <section>
              <h3 className="text-sm font-semibold text-dc-text">
                Public-safe but ECKE may not display this yet:
              </h3>
              <EckePublishOmittedFieldsList fields={preview.wouldPublishDeferred} className="mt-2" />
            </section>
          : null}

          {preview.locationHiddenWarning ?
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
              {preview.locationHiddenWarning}
              {preview.locationVisibility ?
                <span className="mt-1 block text-xs opacity-90">Location visibility: {preview.locationVisibility}</span>
              : null}
            </p>
          : null}

          {preview.eckeSurfacesAffected.length ?
            <section>
              <h3 className="text-sm font-semibold text-dc-text">ECKE surfaces affected</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-dc-text-muted">
                {preview.eckeSurfacesAffected.map((surface) => (
                  <li key={surface}>{surface}</li>
                ))}
              </ul>
            </section>
          : null}

          {import.meta.env.DEV ?
            <details className="rounded-lg border border-dc-border bg-dc-elevated-muted/50">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-dc-text-muted hover:text-dc-text">
                Developer details
              </summary>
              <pre className="max-h-64 overflow-auto border-t border-dc-border px-3 py-2 text-xs text-dc-text-muted">
                {JSON.stringify(preview.payload, null, 2)}
              </pre>
            </details>
          : null}
        </div>
      </div>
    </div>
  )
}
