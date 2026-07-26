'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { LocationsSettingsSection } from '@/components/dancecard/organizer/LocationsSettingsSection'
import { RegistrationSettingsSection } from '@/components/dancecard/organizer/RegistrationSettingsSection'
import { EventSettingsBasicsForm } from '@/components/dancecard/organizer/settings/EventSettingsBasicsForm'
import { EventSettingsBrandingForm } from '@/components/dancecard/organizer/settings/EventSettingsBrandingForm'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import { hasEventWindow } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import type { ReadinessCheck } from '@/lib/dancecard/readinessTypes'
import { Panel } from '@/components/dancecard/ui/Panel'
import { Button } from '@/components/dancecard/ui/Button'
import { cn } from '@/lib/cn'

const STEPS = [
  { id: 'welcome', title: 'Welcome', blurb: 'A short guided setup for this event.' },
  { id: 'basics', title: 'Dates & title', blurb: 'When the event runs and what to call it.' },
  { id: 'branding', title: 'Public page', blurb: 'What attendees see on the dancecard.' },
  { id: 'rooms', title: 'Rooms', blurb: 'Named spaces for schedule and maps.' },
  { id: 'registration', title: 'Registration', blurb: 'Ticket types and signup form (optional).' },
  { id: 'done', title: 'Done', blurb: 'You are ready to build the schedule.' },
] as const

type StepId = (typeof STEPS)[number]['id']

export function EventSetupWizard({
  eventSlug,
  event,
  setEvent,
  canEdit,
  canOwnerSettings,
  onSave,
  saving,
  onComplete,
  onOpenPanel,
}: {
  eventSlug: string
  event: EventSettingsEventDto
  setEvent: React.Dispatch<React.SetStateAction<EventSettingsEventDto | null>>
  canEdit: boolean
  canOwnerSettings: boolean
  onSave: (patch: Partial<EventSettingsEventDto>) => Promise<void>
  saving: boolean
  onComplete: () => void
  onOpenPanel: (panel: 'basics') => void
}) {
  const dashboardHref = useOrganizerTabHref('dashboard')
  const programHref = useOrganizerTabHref('program')
  const [stepIndex, setStepIndex] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const [checks, setChecks] = useState<ReadinessCheck[] | null>(null)

  const step = STEPS[stepIndex]!
  const stepId = step.id as StepId

  const loadChecks = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<{ checks: ReadinessCheck[] }>(eventSlug, '/readiness')
      setChecks(res.checks)
    } catch {
      setChecks(null)
    }
  }, [eventSlug])

  useEffect(() => {
    if (stepId === 'done') void loadChecks()
  }, [stepId, loadChecks])

  function validateCurrent(): string | null {
    if (stepId === 'basics') {
      if (!event.eventTitle.trim()) return 'Add an event title.'
      if (!event.timezone.trim()) return 'Add a timezone.'
      if (!hasEventWindow(event)) return 'Set both start and end dates.'
    }
    return null
  }

  async function goNext() {
    const err = validateCurrent()
    if (err) {
      setStepError(err)
      return
    }
    setStepError(null)
    if (stepId === 'basics') {
      await onSave({
        eventTitle: event.eventTitle,
        timezone: event.timezone,
        windowStartsAt: event.windowStartsAt,
        windowEndsAt: event.windowEndsAt,
        status: event.status,
      })
    }
    if (stepId === 'branding') {
      await onSave({
        productTitle: event.productTitle,
        subtitle: event.subtitle,
        sharedByLabel: event.sharedByLabel,
        logoUrl: event.logoUrl,
      })
    }
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1)
    }
  }

  function goBack() {
    setStepError(null)
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  const warnings = (checks ?? []).filter((c) => c.severity === 'warning').slice(0, 3)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
              i === stepIndex
                ? 'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                : i < stepIndex
                  ? 'border-dc-success/30 bg-dc-success-muted/40 text-dc-success'
                  : 'border-dc-border text-dc-muted',
            )}
          >
            <span className="font-semibold">{i + 1}</span>
            <span className="hidden sm:inline">{s.title}</span>
          </div>
        ))}
      </div>

      <Panel>
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 font-serif text-xl text-dc-text">{step.title}</h2>
        <p className="mt-1 text-sm text-dc-muted">{step.blurb}</p>

        {stepError ? <p className="mt-3 text-sm text-dc-danger">{stepError}</p> : null}

        <div className="mt-5">
          {stepId === 'welcome' ? (
            <div className="space-y-3 text-sm leading-relaxed text-dc-muted">
              <p>
                This guide walks through the minimum setup before you add classes, staff, and registrants. You can leave
                any step and finish later from the tabs above.
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>Set dates so the program grid knows your event window</li>
                <li>Name rooms so sessions and maps stay consistent</li>
                <li>Optionally open registration when you are ready</li>
              </ul>
            </div>
          ) : null}

          {stepId === 'basics' ? (
            <EventSettingsBasicsForm
              embedded
              event={event}
              setEvent={setEvent}
              canEdit={canEdit}
              canOwnerSettings={canOwnerSettings}
              saveOnBlur={(patch) => void onSave(patch)}
            />
          ) : null}

          {stepId === 'branding' ? (
            <EventSettingsBrandingForm
              embedded
              event={event}
              setEvent={setEvent}
              canEdit={canEdit}
              saveOnBlur={(patch) => void onSave(patch)}
            />
          ) : null}

          {stepId === 'rooms' ? (
            <LocationsSettingsSection eventSlug={eventSlug} canEdit={canEdit} embedded />
          ) : null}

          {stepId === 'registration' ? (
            <div className="space-y-3">
              <p className="text-sm text-dc-muted">
                Skip this step if you are not taking sign-ups through the dancecard yet.
              </p>
              <div className="max-h-[min(420px,50vh)] overflow-y-auto rounded-xl border border-dc-border bg-dc-surface-muted/50 p-1">
                <RegistrationSettingsSection eventSlug={eventSlug} canEdit={canEdit} />
              </div>
            </div>
          ) : null}

          {stepId === 'done' ? (
            <div className="space-y-4">
              <p className="text-sm text-dc-muted">
                Core setup is in place. Head to Overview for a pre-flight checklist, or jump straight into the program
                grid.
              </p>
              {warnings.length > 0 ? (
                <ul className="space-y-2">
                  {warnings.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-lg border border-dc-warning/25 bg-dc-warning-muted/50 px-3 py-2 text-sm text-dc-warning"
                    >
                      {c.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-dc-success">No urgent warnings from the latest checks.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={dashboardHref}
                  className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  Open overview
                </Link>
                <Link
                  href={programHref}
                  className="rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-text hover:border-dc-accent-border"
                >
                  Open program
                </Link>
                <Link
                  href={`/conventions/${eventSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-muted hover:text-dc-text"
                >
                  Preview public page ↗
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-dc-border pt-4">
          <div className="flex gap-2">
            {stepIndex > 0 && stepId !== 'done' ? (
              <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
                Back
              </Button>
            ) : null}
            {stepId === 'registration' || stepId === 'rooms' ? (
              <button
                type="button"
                className="text-sm text-dc-muted hover:text-dc-text"
                onClick={() => {
                  setStepError(null)
                  setStepIndex((i) => i + 1)
                }}
              >
                Skip for now
              </button>
            ) : null}
          </div>
          {stepId === 'done' ? (
            <Button type="button" onClick={onComplete}>
              Finish setup
            </Button>
          ) : (
            <Button type="button" onClick={() => void goNext()} disabled={saving}>
              {stepId === 'welcome' ? 'Start' : 'Continue'}
            </Button>
          )}
        </div>
      </Panel>

      {stepId !== 'done' ? (
        <p className="text-center text-xs text-dc-muted">
          Prefer the full form?{' '}
          <button type="button" className="text-dc-accent hover:underline" onClick={() => onOpenPanel('basics')}>
            Open all settings tabs
          </button>
        </p>
      ) : null}
    </div>
  )
}
