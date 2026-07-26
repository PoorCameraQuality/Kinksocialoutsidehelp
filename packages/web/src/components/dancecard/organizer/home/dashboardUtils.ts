import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import type { ReadinessCheck } from '@/lib/dancecard/readinessTypes'
import type { ResolvedSetupTask } from '@/lib/dancecard/resolveSetupTasks'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'

export type ConventionLifecyclePhase = 'draft' | 'registration_open' | 'published' | 'live' | 'completed'

export function conventionLifecyclePhase(event: EventSettingsEventDto | null): ConventionLifecyclePhase {
  const now = Date.now()
  const start = event?.windowStartsAt ? new Date(event.windowStartsAt).getTime() : NaN
  const end = event?.windowEndsAt ? new Date(event.windowEndsAt).getTime() : NaN
  if (!Number.isNaN(end) && now > end) return 'completed'
  if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end) return 'live'
  if (event?.status === 'published') return 'published'
  return 'draft'
}

export function lifecycleLabel(phase: ConventionLifecyclePhase): string {
  switch (phase) {
    case 'live':
      return 'Event live'
    case 'completed':
      return 'Completed'
    case 'published':
      return 'Published'
    case 'registration_open':
      return 'Registration open'
    default:
      return 'Draft'
  }
}

export function isEventWindowActive(event: EventSettingsEventDto | null): boolean {
  const phase = conventionLifecyclePhase(event)
  return phase === 'live'
}

export function isEventBeforeStart(event: EventSettingsEventDto | null): boolean {
  if (!event?.windowStartsAt) return true
  return Date.now() < new Date(event.windowStartsAt).getTime()
}

export function formatEventDateRange(event: EventSettingsEventDto | null): string | null {
  if (!event?.windowStartsAt || !event?.windowEndsAt) return null
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const start = new Date(event.windowStartsAt).toLocaleDateString(undefined, opts)
  const end = new Date(event.windowEndsAt).toLocaleDateString(undefined, opts)
  return start === end ? start : `${start} – ${end}`
}

export function nextUpcomingSlot(slots: ProgramSlotRow[]): ProgramSlotRow | null {
  const now = Date.now()
  const upcoming = slots
    .filter((s) => s.startsAt && new Date(s.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())
  return upcoming[0] ?? null
}

export function readinessOverallStatus(
  pct: number,
  urgentCount: number,
  essentialIncomplete: number,
): 'on_track' | 'needs_attention' | 'blocked' {
  if (urgentCount > 0 || essentialIncomplete > 2) return urgentCount > 2 ? 'blocked' : 'needs_attention'
  if (pct >= 100) return 'on_track'
  if (pct >= 60) return 'needs_attention'
  return 'needs_attention'
}

export function checkOk(checks: ReadinessCheck[], id: string): boolean {
  return checks.some((c) => c.id === id && c.severity === 'ok')
}

export function registrationLikelyOpen(checks: ReadinessCheck[]): boolean {
  return checkOk(checks, 'reg-categories-ok') && checkOk(checks, 'reg-form-published')
}

export type AttentionItem = {
  id: string
  title: string
  detail?: string
  severity: 'urgent' | 'warning' | 'info'
  actionLabel: string
  onAction: () => void
}

type AttentionTopic = 'program-publish' | 'agreements' | 'attendee-surfaces'

function checkAttentionTopic(checkId: string): AttentionTopic | null {
  if (checkId === 'slots-unpublished' || checkId === 'program-empty') return 'program-publish'
  if (checkId === 'event-unpublished') return 'attendee-surfaces'
  return null
}

function taskAttentionTopic(taskId: string): AttentionTopic | null {
  if (taskId === 'program-published') return 'program-publish'
  if (taskId === 'agreements') return 'agreements'
  return null
}

function hasAttentionTopic(topics: Set<AttentionTopic>, topic: AttentionTopic): boolean {
  return topics.has(topic)
}

function programPublishDetail(unpublishedCount: number, fallback?: string): string | undefined {
  if (unpublishedCount > 0) {
    return `${unpublishedCount} session${unpublishedCount === 1 ? '' : 's'} still hidden from attendees.`
  }
  return fallback
}

export function buildAttentionItems(input: {
  fixNow: ReadinessCheck[]
  setupTasks: ResolvedSetupTask[]
  unpublishedCount: number
  eventPublished: boolean
  /** When true, skip attendee-surface nudges - the Attendee surfaces panel covers them. */
  hasAttendeeSurfacesPanel?: boolean
  onNavigate: (item: ReadinessCheck['action']) => void
  onNavigateTab: (
    tab: string,
    opts?: {
      peopleTab?: string
      settingsPanel?: string
      publishFilter?: string
    },
  ) => void
}): AttentionItem[] {
  const items: AttentionItem[] = []
  const topics = new Set<AttentionTopic>()

  for (const c of input.fixNow.slice(0, 4)) {
    if (!c.action) continue
    const topic = checkAttentionTopic(c.id)
    if (topic && hasAttentionTopic(topics, topic)) continue
    if (topic) topics.add(topic)
    items.push({
      id: `check-${c.id}`,
      title: c.title,
      detail:
        topic === 'program-publish'
          ? programPublishDetail(input.unpublishedCount, c.detail) ?? c.detail
          : c.detail,
      severity: 'urgent',
      actionLabel: c.action.label,
      onAction: () => input.onNavigate(c.action),
    })
  }

  const essentialIncomplete = input.setupTasks.filter((t) => t.group === 'essential' && t.status === 'incomplete')
  for (const task of essentialIncomplete.slice(0, 4)) {
    const topic = taskAttentionTopic(task.id)
    if (topic && hasAttentionTopic(topics, topic)) continue
    if (topic) topics.add(topic)
    items.push({
      id: `task-${task.id}`,
      title: task.label,
      detail:
        task.id === 'program-published'
          ? programPublishDetail(input.unpublishedCount, task.description)
          : task.description,
      severity: 'warning',
      actionLabel: task.id === 'program-published' ? 'Go to program' : 'Open',
      onAction: () =>
        input.onNavigateTab(task.href.tab, {
          peopleTab: task.href.peopleTab,
          settingsPanel: task.href.settingsPanel,
          publishFilter: task.href.publishFilter,
        }),
    })
  }

  if (input.unpublishedCount > 0 && !hasAttentionTopic(topics, 'program-publish')) {
    topics.add('program-publish')
    items.push({
      id: 'unpublished-slots',
      title: 'Publish classes on the program',
      detail: programPublishDetail(input.unpublishedCount),
      severity: 'warning',
      actionLabel: 'Go to program',
      onAction: () => input.onNavigateTab('program', { publishFilter: 'draft' }),
    })
  }

  if (
    !input.eventPublished &&
    !input.hasAttendeeSurfacesPanel &&
    !hasAttentionTopic(topics, 'attendee-surfaces')
  ) {
    items.push({
      id: 'attendee-surfaces',
      title: 'Publish attendee surfaces',
      detail: 'Attendees cannot see the final program until you publish the Dancecard and public page.',
      severity: 'info',
      actionLabel: 'Open integrations',
      onAction: () => input.onNavigateTab('integrations'),
    })
  }

  return items.slice(0, 6)
}
