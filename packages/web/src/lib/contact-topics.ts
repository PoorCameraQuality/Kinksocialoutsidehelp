export const CONTACT_TOPICS = [
  { value: 'general', label: 'General question' },
  { value: 'privacy', label: 'Privacy or data request' },
  { value: 'legal', label: 'Legal or policy question' },
  { value: 'law_enforcement', label: 'Law enforcement or legal process' },
  { value: 'accessibility', label: 'Accessibility barrier' },
  { value: 'appeal', label: 'Appeal escalation' },
  { value: 'dmca', label: 'Copyright / DMCA question' },
  { value: 'partnership', label: 'Organizer, vendor, or partnership' },
] as const

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['value']

export function isContactTopic(value: string | null | undefined): value is ContactTopic {
  return CONTACT_TOPICS.some((t) => t.value === value)
}

export function contactTopicLabel(value: string): string {
  return CONTACT_TOPICS.find((t) => t.value === value)?.label ?? value
}
