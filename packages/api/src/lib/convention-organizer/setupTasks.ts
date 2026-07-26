import type { ReadinessCheck } from './readinessSummary.js'

export type SetupTask = {
  id: string
  label: string
  tab: string
  dependsOn?: string[]
}

export const SETUP_TASKS: SetupTask[] = [
  { id: 'basics', label: 'Set event dates', tab: 'settings' },
  { id: 'locations', label: 'Add venue rooms', tab: 'settings', dependsOn: ['basics'] },
  { id: 'program', label: 'Build program', tab: 'program', dependsOn: ['basics'] },
  { id: 'venues', label: 'Assign rooms', tab: 'venues', dependsOn: ['program', 'locations'] },
  { id: 'publish', label: 'Publish convention', tab: 'settings', dependsOn: ['program'] },
]

export function resolveSetupTasks(completed: Set<string>): SetupTask[] {
  return SETUP_TASKS.filter((task) => {
    if (completed.has(task.id)) return false
    if (!task.dependsOn?.length) return true
    return task.dependsOn.every((d) => completed.has(d))
  })
}

export function setupTasksToReadiness(tasks: SetupTask[]): ReadinessCheck[] {
  return tasks.map((t) => ({ id: t.id, status: 'todo' as const, title: t.label }))
}
