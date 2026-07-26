/**
 * Canonical UI primitives — import from here in new code.
 * Mobile defaults use min-h-touch (44px) where interactive.
 */
export { default as Button } from './Button'
export { default as Card } from './Card'
export { default as ConfirmDialog } from './ConfirmDialog'
export { default as Dialog } from './Dialog'
export { default as EmptyState } from './EmptyState'
export { default as FormField } from './FormField'
export { default as SectionHeader } from './SectionHeader'
export { default as TabShell } from './TabShell'
export { default as TabButton } from './TabButton'
export { default as TextInput } from './TextInput'
export { ContentPanel, DancecardPanel } from './ContentPanel'

export { default as PageHeader } from '../shell/PageHeader'
export { default as MobileActionBar } from '../shell/MobileActionBar'
export type { MobileActionBarAction } from '../shell/MobileActionBar'
export { default as AppShell } from '../shell/AppShell'

export {
  FilterSheet,
  DirectoryTemplate,
  DirectoryFilterButton,
  DetailTemplate,
  FeedTemplate,
  WizardTemplate,
  SettingsTemplate,
  SettingsSection,
  DashboardTemplate,
  DashboardCard,
} from '../templates'
