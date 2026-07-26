import type { FeedPostCommentPreview } from './feed-post-comments.js'

export const COMMENT_BODY_PREVIEW_MAX = 120

type CommentPickRow = {
  postId: string
  authorId: string
  id: string
  authorUsername: string
  authorAvatarUrl: string | null
  body: string
  createdAt: string
}

export function truncateCommentBodyPreview(body: string, maxLen = COMMENT_BODY_PREVIEW_MAX): string {
  const trimmed = body.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`
}

export function shapeCommentPreview(row: CommentPickRow): FeedPostCommentPreview {
  return {
    id: row.id,
    authorDisplayName: row.authorUsername,
    authorUsername: row.authorUsername,
    authorAvatarUrl: row.authorAvatarUrl,
    bodyPreview: truncateCommentBodyPreview(row.body),
    createdAt: row.createdAt,
  }
}

/** Drop comments whose authors are in the viewer block pair. */
export function filterCommentsForViewer<T extends { authorId: string }>(
  rows: T[],
  hiddenAuthorIds: Set<string>,
): T[] {
  if (hiddenAuthorIds.size === 0) return rows
  return rows.filter((row) => !hiddenAuthorIds.has(row.authorId))
}

export function countVisibleComments<T extends { authorId: string }>(
  rows: T[],
  hiddenAuthorIds: Set<string>,
): number {
  return filterCommentsForViewer(rows, hiddenAuthorIds).length
}

/** Latest allowed comment per post; skips blocked authors and already-filled posts. */
export function pickLatestVisibleCommentPreviews(
  rows: CommentPickRow[],
  hiddenAuthorIds: Set<string>,
): Map<string, FeedPostCommentPreview> {
  const result = new Map<string, FeedPostCommentPreview>()
  for (const row of rows) {
    if (result.has(row.postId)) continue
    if (hiddenAuthorIds.has(row.authorId)) continue
    result.set(row.postId, shapeCommentPreview(row))
  }
  return result
}
