'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganizerWorkspacePath } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { VenuesSetupPanel } from '@/components/dancecard/organizer/venue/VenuesSetupPanel'
import { RegistrationSettingsSection } from '@/components/dancecard/organizer/RegistrationSettingsSection'
import { TracksTagsSettingsSection } from '@/components/dancecard/organizer/TracksTagsSettingsSection'
import { PoliciesAgreementsPanel } from '@/components/dancecard/organizer/settings/PoliciesAgreementsPanel'
import { AttendeeGuideSettingsSection } from '@/components/dancecard/organizer/settings/AttendeeGuideSettingsSection'
import { AttendeeProfileSettingsSection } from '@/components/dancecard/organizer/settings/AttendeeProfileSettingsSection'
import { EventSetupWizard } from '@/components/dancecard/organizer/settings/EventSetupWizard'
import { EventSettingsAdvancedForm } from '@/components/dancecard/organizer/settings/EventSettingsAdvancedForm'
import { EventSettingsBasicsForm } from '@/components/dancecard/organizer/settings/EventSettingsBasicsForm'
import { EventSettingsBrandingForm } from '@/components/dancecard/organizer/settings/EventSettingsBrandingForm'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import { hasEventWindow } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import {
  EVENT_SETTINGS_ESSENTIAL,
  EVENT_SETTINGS_MORE,
  EVENT_SETTINGS_PANEL_PARAM,
  EVENT_SETTINGS_PANELS,
  normalizeSettingsPanelId,
  type EventSettingsPanelId,
} from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import { useEventSettingsWizard } from '@/components/dancecard/organizer/settings/useEventSettingsWizard'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { ParticipationSettingsPanel } from '@/components/dancecard/organizer/settings/ParticipationSettingsPanel'
import { CommandTeamPanel } from '@/components/dancecard/organizer/settings/CommandTeamPanel'
import { GalleryPanel } from '@/components/dancecard/organizer/settings/GalleryPanel'
import { ChannelsPanel } from '@/components/dancecard/organizer/settings/ChannelsPanel'
import { Panel } from '@/components/dancecard/ui/Panel'
import { cn } from '@/lib/cn'

type ActiveSettingsView = EventSettingsPanelId | 'guide'

function resolveActivePanel(v: string | null): ActiveSettingsView {
  if (v === 'guide') return 'guide'
  const norm = normalizeSettingsPanelId(v)
  return norm ?? 'basics'
}

export function EventSettingsPanel({
  eventSlug,
  permissions,
}: {
  eventSlug: string
  permissions: ConventionCommandPermissions
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspacePath = useOrganizerWorkspacePath(eventSlug)
  const { wizardDone, wizardReady, markWizardDone, resetWizard } = useEventSettingsWizard(eventSlug)

  const [event, setEvent] = useState<EventSettingsEventDto | null>(null)
  const [badgeLayoutDraft, setBadgeLayoutDraft] = useState('{}')
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const canEdit = permissions.isFullAdmin
  const canOwnerSettings = permissions.isFullAdmin

  const panelFromUrl = searchParams.get(EVENT_SETTINGS_PANEL_PARAM)
  const activePanel: ActiveSettingsView = useMemo(() => resolveActivePanel(panelFromUrl), [panelFromUrl])

  const setPanel = useCallback(
    (id: ActiveSettingsView) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'settings')
      params.set(EVENT_SETTINGS_PANEL_PARAM, id)
      const href = `${workspacePath}?${params.toString()}`
      router.replace(href, { scroll: false })
    },
    [router, searchParams, workspacePath],
  )

  const load = useCallback(async () => {
    setLoadErr(null)
    try {
      const res = await organizerDancecardFetch<{ event: EventSettingsEventDto }>(eventSlug, '/event')
      setEvent(res.event)
      setBadgeLayoutDraft(JSON.stringify(res.event.badgeLayoutJson ?? {}, null, 2))
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load settings')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (patch: Partial<EventSettingsEventDto>) => {
      if (!event || !canEdit) return
      setSaving(true)
      setMsg(null)
      try {
        const body: Record<string, unknown> = {}
        if (patch.productTitle !== undefined) body.productTitle = patch.productTitle
        if (patch.eventTitle !== undefined) body.eventTitle = patch.eventTitle
        if (patch.subtitle !== undefined) body.subtitle = patch.subtitle
        if (patch.timezone !== undefined) body.timezone = patch.timezone
        if (patch.windowStartsAt !== undefined) body.windowStartsAt = patch.windowStartsAt
        if (patch.windowEndsAt !== undefined) body.windowEndsAt = patch.windowEndsAt
        if (patch.sharedByLabel !== undefined) body.sharedByLabel = patch.sharedByLabel
        if (patch.sharedByDetail !== undefined) body.sharedByDetail = patch.sharedByDetail
        if (patch.logoUrl !== undefined) body.logoUrl = patch.logoUrl
        if (patch.shareImageUrl !== undefined) body.shareImageUrl = patch.shareImageUrl
        if (patch.status !== undefined && canOwnerSettings) body.status = patch.status
        if (patch.staffAccessCode !== undefined && canOwnerSettings) body.staffAccessCode = patch.staffAccessCode
        if (patch.registrationAccessCode !== undefined && canOwnerSettings)
          body.registrationAccessCode = patch.registrationAccessCode
        if (patch.badgeLayoutJson !== undefined) body.badgeLayoutJson = patch.badgeLayoutJson
        if (patch.themeConfig !== undefined) body.themeConfig = patch.themeConfig
        if (patch.eventProfile !== undefined) body.eventProfile = patch.eventProfile
        if (patch.attendeeGuideJson !== undefined) body.attendeeGuideJson = patch.attendeeGuideJson
        if (patch.agreementsConfig !== undefined) body.agreementsConfig = patch.agreementsConfig
        if (patch.attendeeProfileConfig !== undefined) body.attendeeProfileConfig = patch.attendeeProfileConfig

        const res = await organizerDancecardFetch<{ event: EventSettingsEventDto }>(eventSlug, '/event', {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        setEvent(res.event)
        setBadgeLayoutDraft(JSON.stringify(res.event.badgeLayoutJson ?? {}, null, 2))
        setMsg('Saved.')
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [canEdit, canOwnerSettings, event, eventSlug],
  )

  if (loadErr) {
    return (
      <Panel className="border-dc-danger/30">
        <p className="text-sm text-dc-danger">{loadErr}</p>
        <button type="button" className="mt-3 text-sm text-dc-accent hover:underline" onClick={() => void load()}>
          Try again
        </button>
      </Panel>
    )
  }

  if (!event || !wizardReady) {
    return <p className="text-sm text-dc-muted">Loading settings…</p>
  }

  const needsDates = !hasEventWindow(event)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h2 className="font-serif text-2xl text-dc-text sm:text-3xl">Event settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-muted">
          Configure this event once, then use Program and People for day-to-day work. Use the setup guide for a first
          pass, or jump to a section below.
        </p>
      </header>

      {needsDates ? (
        <Panel className="border-dc-warning/30 bg-dc-warning-muted/40">
          <p className="text-sm font-medium text-dc-warning">Set your event dates first</p>
          <p className="mt-1 text-sm text-dc-muted">
            Program, rooms, and imports need a start and end time. Open Basics or run the setup guide.
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-dc-accent hover:underline"
            onClick={() => setPanel('basics')}
          >
            Go to basics →
          </button>
        </Panel>
      ) : null}

      {!canEdit ? (
        <Panel className="border-dc-warning/25 bg-dc-warning-muted/30">
          <p className="text-sm text-dc-warning">Read-only access for this event.</p>
        </Panel>
      ) : null}

      {msg ? (
        <p className={cn('text-sm', msg.includes('fail') || msg.includes('invalid') ? 'text-dc-danger' : 'text-dc-success')}>
          {msg}
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Essentials</p>
          <button
            type="button"
            className="text-xs font-semibold text-dc-accent hover:underline"
            onClick={() => setPanel('guide')}
          >
            Quick setup (10 min)
          </button>
        </div>
        <nav
          className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Essential settings"
        >
          {EVENT_SETTINGS_ESSENTIAL.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.description}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
                activePanel === p.id
                  ? 'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                  : 'border-dc-border text-dc-muted hover:border-dc-accent-border/50 hover:text-dc-text',
              )}
              onClick={() => setPanel(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">More</p>
        <nav
          className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="More settings"
        >
          {EVENT_SETTINGS_MORE.filter((p) => p.id !== 'team' || permissions?.canManageTeam).map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.description}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
                activePanel === p.id
                  ? 'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                  : 'border-dc-border text-dc-muted hover:border-dc-accent-border/50 hover:text-dc-text',
              )}
              onClick={() => setPanel(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <details className="rounded-xl border border-dc-border bg-dc-elevated-muted/40 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-dc-text">Advanced</summary>
          <button
            type="button"
            className={cn(
              'mt-2 rounded-full border px-3 py-1.5 text-sm',
              activePanel === 'advanced'
                ? 'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                : 'border-dc-border text-dc-muted',
            )}
            onClick={() => setPanel('advanced')}
          >
            Open advanced settings
          </button>
        </details>
      </div>

      <p className="text-xs text-dc-muted">
        {activePanel === 'guide'
          ? 'Step-by-step first-time setup.'
          : EVENT_SETTINGS_PANELS.find((p) => p.id === activePanel)?.description}
      </p>

      {activePanel === 'guide' ? (
        <EventSetupWizard
          eventSlug={eventSlug}
          event={event}
          setEvent={setEvent}
          canEdit={canEdit}
          canOwnerSettings={canOwnerSettings}
          saving={saving}
          onSave={save}
          onComplete={() => {
            markWizardDone()
            setPanel('basics')
          }}
          onOpenPanel={() => {
            markWizardDone()
            setPanel('basics')
          }}
        />
      ) : null}

      {activePanel === 'basics' ? (
        <EventSettingsBasicsForm
          event={event}
          setEvent={setEvent}
          canEdit={canEdit}
          canOwnerSettings={canOwnerSettings}
          saveOnBlur={(patch) => void save(patch)}
        />
      ) : null}

      {activePanel === 'branding' ? (
        <EventSettingsBrandingForm
          event={event}
          setEvent={setEvent}
          canEdit={canEdit}
          saveOnBlur={(patch) => void save(patch)}
        />
      ) : null}

      {activePanel === 'gallery' ? (
        <Panel>
          <GalleryPanel eventSlug={eventSlug} canEdit={canEdit} />
        </Panel>
      ) : null}

      {activePanel === 'channels' ? (
        <Panel>
          <ChannelsPanel eventSlug={eventSlug} canEdit={canEdit} />
        </Panel>
      ) : null}

      {activePanel === 'registration' ? (
        <Panel className="!p-0 overflow-hidden">
          <RegistrationSettingsSection eventSlug={eventSlug} canEdit={canEdit} />
        </Panel>
      ) : null}

      {activePanel === 'venue' ? (
        <div className="space-y-4">
          <p className="text-sm text-dc-muted">
            Room and map management is on the Venues tab. This panel is kept for deep links. Same controls below.
          </p>
          <VenuesSetupPanel eventSlug={eventSlug} canEdit={canEdit} />
        </div>
      ) : null}

      {activePanel === 'program' ? (
        <Panel className="!p-0 overflow-hidden">
          <TracksTagsSettingsSection eventSlug={eventSlug} canEdit={canEdit} />
        </Panel>
      ) : null}

      {activePanel === 'policies-agreements' ? (
        <div className="space-y-4">
          <PoliciesAgreementsPanel
            eventSlug={eventSlug}
            config={event.agreementsConfig}
            onConfigChange={(next) => setEvent((e) => (e ? { ...e, agreementsConfig: next } : e))}
            readOnly={!canEdit}
          />
          {canEdit ? (
            <button
              type="button"
              disabled={saving}
              className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
              onClick={() => void save({ agreementsConfig: event.agreementsConfig })}
            >
              Save agreements settings
            </button>
          ) : null}
        </div>
      ) : null}

      {activePanel === 'attendee-guide' ? (
        <div className="space-y-4">
          <AttendeeGuideSettingsSection
            guide={event.attendeeGuideJson}
            onChange={(next) => setEvent((e) => (e ? { ...e, attendeeGuideJson: next } : e))}
            disabled={!canEdit}
          />
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
                onClick={() => void save({ attendeeGuideJson: event.attendeeGuideJson })}
              >
                Save attendee guide
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {activePanel === 'attendee-profile' ? (
        <div className="space-y-4">
          <Panel>
            <AttendeeProfileSettingsSection
              config={event.attendeeProfileConfig}
              onChange={(next) => setEvent((e) => (e ? { ...e, attendeeProfileConfig: next } : e))}
              disabled={!canEdit}
            />
          </Panel>
          {canEdit ? (
            <button
              type="button"
              disabled={saving}
              className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
              onClick={() => void save({ attendeeProfileConfig: event.attendeeProfileConfig })}
            >
              Save attendee profile settings
            </button>
          ) : null}
        </div>
      ) : null}

      {activePanel === 'participation' ? (
        <ParticipationSettingsPanel eventSlug={eventSlug} readOnly={!canEdit} />
      ) : null}

      {activePanel === 'team' ? (
        <Panel>
          <CommandTeamPanel eventSlug={eventSlug} permissions={permissions} />
        </Panel>
      ) : null}

      {activePanel === 'advanced' ? (
        <EventSettingsAdvancedForm
          event={event}
          setEvent={setEvent}
          canEdit={canEdit}
          canOwnerSettings={canOwnerSettings}
          badgeLayoutDraft={badgeLayoutDraft}
          setBadgeLayoutDraft={setBadgeLayoutDraft}
          onSave={save}
          onMessage={setMsg}
          saving={saving}
        />
      ) : null}

      {activePanel !== 'guide' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dc-border pt-4 text-sm">
          <button type="button" className="text-dc-muted hover:text-dc-text" onClick={() => void load()}>
            Reload settings
          </button>
          {!wizardDone ? (
            <button type="button" className="text-dc-accent hover:underline" onClick={() => setPanel('guide')}>
              Resume setup guide
            </button>
          ) : (
            <button
              type="button"
              className="text-dc-muted hover:text-dc-text"
              onClick={() => {
                resetWizard()
                setPanel('guide')
              }}
            >
              Run setup guide again
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
