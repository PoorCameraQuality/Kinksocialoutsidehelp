/** Visible alpha-demo labeling attached to seeded API responses. */
export type AlphaContentLabel = {
  text: string
  isSynthetic: boolean
  isPublicSource: boolean
  note: string
}

export const ALPHA_TEST_BADGE_TEXT = 'ALPHA TEST'

export function alphaLabelNote(isSynthetic: boolean, isPublicSource: boolean): string {
  if (isSynthetic) return 'Synthetic demo activity. Not a real user action.'
  if (isPublicSource) {
    return 'Imported from public listing data for alpha display. Confirm details with the official organizer.'
  }
  return 'Demo content for alpha testing.'
}

export function buildAlphaContentLabel(input: {
  text?: string
  isSynthetic?: boolean
  isPublicSource?: boolean
}): AlphaContentLabel {
  const isSynthetic = input.isSynthetic ?? false
  const isPublicSource = input.isPublicSource ?? false
  return {
    text: input.text ?? ALPHA_TEST_BADGE_TEXT,
    isSynthetic,
    isPublicSource,
    note: alphaLabelNote(isSynthetic, isPublicSource),
  }
}
