import { Link, useSearchParams } from 'react-router-dom'
import CasesLegacyReportsPanel from '@/components/moderation/CasesLegacyReportsPanel'
import CasesOpenPanel from '@/components/moderation/CasesOpenPanel'
import CasesPendingActionsPanel from '@/components/moderation/CasesPendingActionsPanel'

const TABS = [
  { id: 'open', label: 'Open cases' },
  { id: 'legacy-reports', label: 'Legacy reports' },
  { id: 'pending-actions', label: 'Pending actions' },
] as const

type CasesTab = (typeof TABS)[number]['id']

function parseTab(raw: string | null): CasesTab {
  if (raw === 'legacy-reports' || raw === 'pending-actions' || raw === 'open') return raw
  return 'open'
}

export default function ModerationCasesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))

  const setTab = (next: CasesTab) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'open') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    // Queue/status filters apply to the open tab only; drop them when leaving.
    if (next !== 'open') {
      params.delete('queue')
      params.delete('status')
      params.delete('severity')
    }
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link to="/moderation/dashboard" className="text-dc-accent hover:underline">
          ← T&amp;S dashboard
        </Link>
      </p>

      <div>
        <h1 className="text-lg font-semibold text-dc-text">Cases</h1>
        <p className="mt-1 text-sm text-dc-muted">
          Triage hub for open T&amp;S cases, legacy report status, and pending enforcement approvals.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Cases triage"
        className="flex flex-wrap gap-2 border-b border-dc-border pb-3"
      >
        {TABS.map((t) => {
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={
                selected ?
                  'min-h-10 rounded-xl bg-dc-accent/15 px-4 text-sm font-medium text-dc-accent'
                : 'min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text'
              }
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {tab === 'open' ? <CasesOpenPanel /> : null}
        {tab === 'legacy-reports' ? <CasesLegacyReportsPanel /> : null}
        {tab === 'pending-actions' ? <CasesPendingActionsPanel /> : null}
      </div>
    </div>
  )
}
