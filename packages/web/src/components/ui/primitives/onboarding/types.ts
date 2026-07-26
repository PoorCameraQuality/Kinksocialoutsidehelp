import type { ReactNode } from 'react'

/** Describes a single step for the wizard stepper rail / progress. */
export type WizardStepMeta = {
  id: string
  /** Short label shown in the stepper and mobile progress. */
  label: string
  /** Optional icon shown in the step badge. */
  icon?: ReactNode
  /** Marks the step as skippable in the UI (shows an "Optional" hint). */
  optional?: boolean
}

export type WizardActionTone = 'primary' | 'secondary' | 'ghost' | 'danger'

/** A single footer action (Back / Skip / Continue). */
export type WizardFooterAction = {
  label: string
  onClick?: () => void
  href?: string
  loading?: boolean
  disabled?: boolean
}
