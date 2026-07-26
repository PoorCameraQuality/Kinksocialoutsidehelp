import type { ConventionPublicSettings } from '../db/schema.js'

export type IsoVisibility = 'PUBLIC' | 'MEMBERS' | 'PRIVATE'

export function isConventionIsoBoardEnabled(settings: ConventionPublicSettings | null | undefined): boolean {
  if (settings?.isoBoardEnabled === false) return false
  return true
}

/** Whether a viewer may read an ISO on profile or convention board (not owner). */
export function canViewerReadIsoVisibility(
  visibility: IsoVisibility,
  opts: { viewerId: string | null; isOwner: boolean },
): boolean {
  if (opts.isOwner) return true
  if (visibility === 'PRIVATE') return false
  if (visibility === 'PUBLIC') return true
  return opts.viewerId != null
}

/** Convention board: never list PRIVATE ISOs to others. */
export function isoEligibleForConventionBoard(
  visibility: IsoVisibility,
  opts: { viewerId: string | null; isOwner: boolean },
): boolean {
  if (visibility === 'PRIVATE') return opts.isOwner
  return canViewerReadIsoVisibility(visibility, opts)
}

/** Recipient-side ISO inbox: thread opened from someone's ISO surface. */
export function isIsoInboxThreadForViewer(
  dmEntryPoint: string | null | undefined,
  isoSubjectUserId: string | null | undefined,
  viewerUserId: string,
): boolean {
  return dmEntryPoint === 'iso' && isoSubjectUserId === viewerUserId
}

export type ConversationsFolder = 'main' | 'requests' | 'iso'

/**
 * Whether a row belongs in `GET /conversations?folder=…` for the current viewer.
 * `isPendingIncomingDmRequest` matches existing handler: PENDING and other user initiated.
 */
export function conversationIncludedInFolder(
  folder: ConversationsFolder,
  ctx: { isPendingIncomingDmRequest: boolean; isIsoInboxForViewer: boolean },
): boolean {
  if (folder === 'main') return !ctx.isPendingIncomingDmRequest && !ctx.isIsoInboxForViewer
  if (folder === 'requests') return ctx.isPendingIncomingDmRequest && !ctx.isIsoInboxForViewer
  return ctx.isIsoInboxForViewer
}
