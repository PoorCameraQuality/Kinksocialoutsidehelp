export type ReadinessCheck = {
  id: string
  severity: 'ok' | 'warning' | 'info'
  title: string
  detail?: string
  action?: {
    label: string
    tab:
      | 'dashboard'
      | 'program'
      | 'staff'
      | 'import'
      | 'settings'
      | 'people'
      | 'registrants'
      | 'venues'
      | 'assignments'
      | 'dm'
      | 'media'
      | 'exports'
      | 'messaging'
      | 'badges'
    /** When tab is `people`, opens this sub-tab in the People hub. */
    peopleTab?: 'signups' | 'roster' | 'staff' | 'applications' | 'swaps' | 'badges' | 'coverage' | 'incidents' | 'compliance'
    settingsPanel?: string
  }
}
