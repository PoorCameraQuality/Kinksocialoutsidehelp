'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { PolicyLedgerSection } from '@/components/dancecard/organizer/PolicyLedgerSection'
import { AgreementsSettingsSection } from '@/components/dancecard/organizer/settings/AgreementsSettingsSection'
import type { AgreementsConfig } from '@/lib/dancecard/agreementsConfig'
import { Panel } from '@/components/dancecard/ui/Panel'
import { cn } from '@/lib/cn'

type Stats = {
  acceptanceRowCount: number
  activeRegistrantCount: number
}

type SubTab = 'overview' | 'documents' | 'requirements'

const SUB_TABS: { id: SubTab; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Quick status at a glance' },
  { id: 'documents', label: 'Policy documents', hint: 'Write and publish what attendees read' },
  { id: 'requirements', label: 'Signing rules', hint: 'What must be signed and how' },
]

export function PoliciesAgreementsPanel({
  eventSlug,
  config,
  onConfigChange,
  readOnly,
}: {
  eventSlug: string
  config: AgreementsConfig
  onConfigChange: (next: AgreementsConfig) => void
  readOnly: boolean
}) {
  const [sub, setSub] = useState<SubTab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<Stats>(eventSlug, '/policy-acceptances/stats')
      setStats(res)
      setStatsErr(null)
    } catch (e) {
      setStatsErr(e instanceof Error ? e.message : 'Could not load signing stats')
    }
  }, [eventSlug])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  return (
    <div className="space-y-5">
      <Panel className="border-dc-border bg-dc-surface-muted/50 p-4">
        <h2 className="font-serif text-lg text-dc-text">Policies & agreements</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-dc-muted">
          Publish the policies attendees read and sign (code of conduct, waiver, photo rules). Choose whether signing
          happens on the dancecard or through RabbitSign.
        </p>
      </Panel>

      <nav
        className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Policies sections"
      >
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              sub === t.id
                ? 'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                : 'border-dc-border text-dc-muted hover:border-dc-accent-border/50 hover:text-dc-text',
            )}
            onClick={() => setSub(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {sub === 'overview' ? (
        <Panel className="space-y-4 p-4">
          <p className="text-sm text-dc-muted">
            How many people have signed versus how many are actively registered. Export the full list from Policy
            documents.
          </p>
          {statsErr ? <p className="text-sm text-dc-danger">{statsErr}</p> : null}
          {stats ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-dc-border bg-dc-elevated px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-dc-muted">Signatures on file</dt>
                <dd className="mt-1 text-3xl font-semibold text-dc-text">{stats.acceptanceRowCount}</dd>
              </div>
              <div className="rounded-xl border border-dc-border bg-dc-elevated px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-dc-muted">Active registrants</dt>
                <dd className="mt-1 text-3xl font-semibold text-dc-text">{stats.activeRegistrantCount}</dd>
              </div>
            </dl>
          ) : !statsErr ? (
            <p className="text-sm text-dc-muted">Loading…</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-dc-border px-3 py-1.5 text-sm text-dc-text hover:bg-dc-elevated-muted"
              onClick={() => setSub('documents')}
            >
              Edit policy documents
            </button>
            <button
              type="button"
              className="rounded-lg border border-dc-border px-3 py-1.5 text-sm text-dc-text hover:bg-dc-elevated-muted"
              onClick={() => setSub('requirements')}
            >
              Signing rules
            </button>
          </div>
        </Panel>
      ) : null}

      {sub === 'documents' ? (
        <PolicyLedgerSection eventSlug={eventSlug} readOnly={readOnly} embedded />
      ) : null}

      {sub === 'requirements' ? (
        <div className="space-y-4">
          <AgreementsSettingsSection config={config} onConfigChange={onConfigChange} disabled={readOnly} />
          <p className="text-xs text-dc-muted">
            RabbitSign connection and API keys live under{' '}
            <Link className="text-dc-accent hover:underline" href="?tab=integrations">
              Integrations
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  )
}
