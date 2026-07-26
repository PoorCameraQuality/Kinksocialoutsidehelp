export const QUESTION_TYPES = [
  'text',
  'long_text',
  'email',
  'phone',
  'single_choice',
  'multi_choice',
  'dropdown',
  'date',
  'pronouns',
  'consent_matrix',
] as const

export type QuestionnaireQuestionInput = {
  id?: string
  type: string
  label: string
  required?: boolean
  sortOrder?: number
  optionsJson?: unknown
  visibilityRulesJson?: Record<string, unknown>
}

export type QuestionnaireQuestionRow = {
  id: string
  type: string
  label: string
  required: boolean
  sortOrder: number
  optionsJson: unknown
  visibilityRulesJson: Record<string, unknown>
}
