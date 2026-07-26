import type { ReadinessCheck } from '@/lib/dancecard/readinessTypes'
import { hasEventWindow, type EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import {
  IMPORT_SKIP_STORAGE_KEY,
  SETUP_TASKS,
  type SetupTaskDef,
  type SetupTaskId,
} from '@/lib/dancecard/setupTasks'

export type SetupTaskStatus = 'complete' | 'incomplete' | 'cannot_start'

export type ResolvedSetupTask = SetupTaskDef & {
  status: SetupTaskStatus
}

export type SetupTaskResolveInput = {
  event: EventSettingsEventDto | null
  checks: ReadinessCheck[]
  slotCount: number
  unpublishedCount: number
  wizardDone: boolean
  importSkipped: boolean
  /** When true, agreement task is not inferred from missing agreements-gap (summary-only load). */
  summaryOnly?: boolean
}

function checkOk(checks: ReadinessCheck[], id: string): boolean {
  return checks.some((c) => c.id === id && c.severity === 'ok')
}

function checkMissing(checks: ReadinessCheck[], id: string): boolean {
  return !checks.some((c) => c.id === id)
}

function completedIds(input: SetupTaskResolveInput): Set<SetupTaskId> {
  const done = new Set<SetupTaskId>()
  const { event, checks, slotCount, unpublishedCount, wizardDone, importSkipped, summaryOnly } = input

  if (wizardDone) done.add('quick-setup')

  if (event && hasEventWindow(event) && event.timezone) {
    done.add('basics')
  }

  if (event && event.eventTitle?.trim() && event.productTitle?.trim()) {
    done.add('branding')
  }

  if (checkOk(checks, 'locations-ok') || (slotCount > 0 && checkMissing(checks, 'locations-none'))) {
    done.add('rooms')
  } else if (event && checkMissing(checks, 'locations-none') && checkMissing(checks, 'rooms-not-linked')) {
    done.add('rooms')
  }

  if (slotCount > 0 && unpublishedCount === 0) {
    done.add('program-published')
  }

  if (importSkipped || checkOk(checks, 'import-recent-program') || slotCount > 0) {
    done.add('import')
  }

  if (!summaryOnly && checkOk(checks, 'agreements-gap')) {
    done.add('agreements')
  }

  if (checkOk(checks, 'staff-count') || checkOk(checks, 'staff-loaded-window')) {
    done.add('staff')
  }

  if (
    checkOk(checks, 'reg-categories-ok') &&
    checkOk(checks, 'reg-form-published')
  ) {
    done.add('registration')
  }

  return done
}

export function resolveSetupTasks(input: SetupTaskResolveInput): ResolvedSetupTask[] {
  const done = completedIds(input)

  return SETUP_TASKS.map((task) => {
    if (done.has(task.id)) {
      return { ...task, status: 'complete' as const }
    }
    if (task.dependsOn?.some((dep) => !done.has(dep))) {
      return { ...task, status: 'cannot_start' as const }
    }
    return { ...task, status: 'incomplete' as const }
  })
}

export function setupReadinessPercent(tasks: ResolvedSetupTask[]): number {
  const essential = tasks.filter((t) => t.group === 'essential')
  if (!essential.length) return 0
  const complete = essential.filter((t) => t.status === 'complete').length
  return Math.round((complete / essential.length) * 100)
}

export function topSetupBlocker(tasks: ResolvedSetupTask[]): ResolvedSetupTask | null {
  return tasks.find((t) => t.group === 'essential' && t.status === 'incomplete') ?? null
}

export function readImportSkipped(eventSlug: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(IMPORT_SKIP_STORAGE_KEY(eventSlug)) === '1'
  } catch {
    return false
  }
}
