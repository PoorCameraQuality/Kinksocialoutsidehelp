import type { ConventionCommandPermissions } from '@c2k/shared'
import type { OrganizerTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { isSetupTaskAllowed, isTabAllowed } from '@/lib/dancecard/commandBridgeNavPermissions'
import { SETUP_TASKS, type SetupTaskId } from '@/lib/dancecard/setupTasks'

export type CommandContext = {
  eventSlug: string
  permissions?: ConventionCommandPermissions
  switchTab: (tab: OrganizerTab) => void
  openConflicts?: () => void
  openSetupTask?: (taskId: string) => void
  openDraftProgram?: () => void
  copyAttendeeUrl?: () => void
  previewRole?: (role: 'attendee' | 'staff' | 'safety' | 'public') => void
}

export type CommandItem = {
  id: string
  group: string
  label: string
  keywords?: string
  shortcut?: string
  run: (ctx: CommandContext) => void
}

const COMMAND_TAB: Record<string, OrganizerTab | undefined> = {
  'go-dashboard': 'dashboard',
  'go-program': 'program',
  'go-people': 'people',
  'go-settings': 'settings',
  'go-import': 'import',
  'go-integrations': 'integrations',
  'go-exports': 'exports',
  'go-messaging': 'messaging',
  'open-draft-program': 'program',
  'open-conflicts': 'program',
}

function isCommandAllowed(id: string, ctx: CommandContext): boolean {
  const permissions = ctx.permissions
  if (!permissions) return true

  if (id.startsWith('setup-')) {
    const taskId = id.slice('setup-'.length) as SetupTaskId
    return isSetupTaskAllowed(taskId, permissions)
  }

  if (id === 'preview-staff' || id === 'preview-safety') {
    return permissions.staffOps || permissions.isFullAdmin
  }

  const tab = COMMAND_TAB[id]
  if (tab) return isTabAllowed(tab, permissions)

  return true
}

export function buildOrganizerCommands(ctx: CommandContext): CommandItem[] {
  const slug = ctx.eventSlug.toLowerCase()
  const setupCommands: CommandItem[] = SETUP_TASKS.filter((t) => t.group === 'essential').map((task) => ({
    id: `setup-${task.id}`,
    group: 'Setup',
    label: task.label,
    keywords: `setup task ${task.description}`,
    run: () => ctx.openSetupTask?.(task.id),
  }))

  const all: CommandItem[] = [
    { id: 'go-dashboard', group: 'Navigate', label: 'Go to Home', run: () => ctx.switchTab('dashboard') },
    { id: 'go-program', group: 'Navigate', label: 'Go to Program', shortcut: 'G P', run: () => ctx.switchTab('program') },
    { id: 'go-people', group: 'Navigate', label: 'Go to People', run: () => ctx.switchTab('people') },
    { id: 'go-settings', group: 'Navigate', label: 'Go to Event settings', run: () => ctx.switchTab('settings') },
    { id: 'go-import', group: 'Navigate', label: 'Go to Import', run: () => ctx.switchTab('import') },
    { id: 'go-integrations', group: 'Navigate', label: 'Go to Integrations', run: () => ctx.switchTab('integrations') },
    { id: 'go-exports', group: 'Navigate', label: 'Go to Exports', run: () => ctx.switchTab('exports') },
    { id: 'go-messaging', group: 'Navigate', label: 'Go to Messaging', run: () => ctx.switchTab('messaging') },
    ...setupCommands,
    {
      id: 'open-draft-program',
      group: 'Program',
      label: 'Show unpublished classes',
      keywords: 'draft publish program',
      run: () => ctx.openDraftProgram?.(),
    },
    {
      id: 'open-conflicts',
      group: 'Program',
      label: 'Open conflict dock',
      keywords: 'overlap scan conflicts',
      run: () => ctx.openConflicts?.(),
    },
    {
      id: 'copy-attendee',
      group: 'Share',
      label: 'Copy attendee link',
      run: () => {
        const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/conventions/${slug}`
        void navigator.clipboard.writeText(url)
        ctx.copyAttendeeUrl?.()
      },
    },
    {
      id: 'preview-attendee',
      group: 'Preview',
      label: 'Preview as attendee',
      run: () => ctx.previewRole?.('attendee'),
    },
    {
      id: 'preview-staff',
      group: 'Preview',
      label: 'Preview as staff',
      run: () => ctx.previewRole?.('staff'),
    },
    {
      id: 'preview-safety',
      group: 'Preview',
      label: 'Preview as safety',
      run: () => ctx.previewRole?.('safety'),
    },
    {
      id: 'shortcuts',
      group: 'Help',
      label: 'Keyboard shortcuts',
      shortcut: '?',
      run: () => {
        window.dispatchEvent(new CustomEvent('dc-organizer-show-shortcuts'))
      },
    },
  ]

  return ctx.permissions ? all.filter((cmd) => isCommandAllowed(cmd.id, ctx)) : all
}
