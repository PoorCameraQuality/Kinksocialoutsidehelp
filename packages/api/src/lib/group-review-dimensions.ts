import { GROUP_MIN_REVIEWS_FOR_DIMENSIONS } from '@c2k/shared'

export const GROUP_REVIEW_DIMENSIONS = [
  'culture',
  'newMemberFriendliness',
  'moderationQuality',
  'safetyResponsiveness',
  'eventUsefulness',
  'communicationClarity',
] as const

export type GroupReviewDimension = (typeof GROUP_REVIEW_DIMENSIONS)[number]

export type GroupReviewRow = {
  cultureRating: number | null
  newMemberFriendlinessRating: number | null
  moderationQualityRating: number | null
  safetyResponsivenessRating: number | null
  eventUsefulnessRating: number | null
  communicationClarityRating: number | null
}

export type GroupDimensionSummary = {
  key: GroupReviewDimension
  label: string
  average: number | null
  responseCount: number
}

const LABELS: Record<GroupReviewDimension, string> = {
  culture: 'Culture',
  newMemberFriendliness: 'New-member friendliness',
  moderationQuality: 'Moderation quality',
  safetyResponsiveness: 'Safety responsiveness',
  eventUsefulness: 'Event usefulness',
  communicationClarity: 'Communication clarity',
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function summarizeGroupReviewDimensions(
  rows: GroupReviewRow[],
  minReviews = GROUP_MIN_REVIEWS_FOR_DIMENSIONS
): { hasEnoughFeedback: boolean; dimensions: GroupDimensionSummary[] } {
  const fieldMap: Record<GroupReviewDimension, keyof GroupReviewRow> = {
    culture: 'cultureRating',
    newMemberFriendliness: 'newMemberFriendlinessRating',
    moderationQuality: 'moderationQualityRating',
    safetyResponsiveness: 'safetyResponsivenessRating',
    eventUsefulness: 'eventUsefulnessRating',
    communicationClarity: 'communicationClarityRating',
  }

  const dimensions = GROUP_REVIEW_DIMENSIONS.map((key) => {
    const field = fieldMap[key]
    const values = rows.map((r) => r[field]).filter((v): v is number => v != null && v >= 1 && v <= 5)
    const responseCount = values.length
    return {
      key,
      label: LABELS[key],
      average: responseCount >= minReviews ? avg(values) : null,
      responseCount,
    }
  })

  const ratedReviews = rows.filter((r) =>
    GROUP_REVIEW_DIMENSIONS.some((k) => {
      const v = r[fieldMap[k]]
      return v != null && v >= 1 && v <= 5
    })
  ).length

  return {
    hasEnoughFeedback: ratedReviews >= minReviews,
    dimensions,
  }
}
