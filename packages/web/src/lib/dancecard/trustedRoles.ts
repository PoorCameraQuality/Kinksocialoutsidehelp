import type { QuestionnaireQuestionRow } from '@/lib/dancecard/questionnaireTypes'

export type TrustedRoleRow = {
  id: string
  slug: string
  title: string
  description?: string | null
}

export type TrustedRoleQuestion = {
  id: string
  label: string
  fieldType: string
}

export function applySlugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return base || 'role'
}

export function publicTrustedRoleApplyPath(eventSlug: string, applySlug: string): string {
  return `/conventions/${encodeURIComponent(eventSlug)}/apply/${encodeURIComponent(applySlug)}`
}

export function mapTrustedRoleQuestion(r: Record<string, unknown>): QuestionnaireQuestionRow {
  return {
    id: r.id as string,
    type: r.type as string,
    label: r.label as string,
    required: Boolean(r.required),
    sortOrder: Number(r.sort_order ?? 0),
    optionsJson: r.options_json ?? [],
    visibilityRulesJson: (r.visibility_rules_json as Record<string, unknown>) ?? {},
  }
}
