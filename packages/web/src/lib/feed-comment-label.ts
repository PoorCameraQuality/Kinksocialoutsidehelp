import { FEED_ACTION_LABELS } from '@c2k/shared'

/** Action-row label for post comment affordance. */
export function formatFeedCommentActionLabel(count: number): string {
  if (count <= 0) return FEED_ACTION_LABELS.discuss
  if (count === 1) return '1 comment'
  return `${count} comments`
}

/** Nested preview footer when more than one comment exists. */
export function formatFeedCommentPreviewLinkLabel(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return 'View comment'
  return `View all ${count} comments`
}
