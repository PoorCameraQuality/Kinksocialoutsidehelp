import { z } from 'zod'

export const CONNECTIONS_LIST_VISIBILITY_LEVELS = [
  'hidden',
  'connections_only',
  'members',
  'public',
] as const

export type ConnectionsListVisibility = (typeof CONNECTIONS_LIST_VISIBILITY_LEVELS)[number]

export const connectionsListVisibilitySchema = z.enum(CONNECTIONS_LIST_VISIBILITY_LEVELS)

export type ConnectionsListViewerContext = {
  isOwner: boolean
  isAuthenticated: boolean
  /** Mutual ACCEPTED connection between viewer and profile owner. */
  isConnected: boolean
  isModerator?: boolean
}

/**
 * Whether the viewer may browse the full connections list on a public profile.
 * Owner and platform moderators always can. Everyone else follows the visibility level.
 */
export function canViewerBrowseConnectionsList(
  visibility: ConnectionsListVisibility,
  ctx: ConnectionsListViewerContext,
): boolean {
  if (ctx.isOwner || ctx.isModerator) return true
  switch (visibility) {
    case 'hidden':
      return false
    case 'connections_only':
      return ctx.isConnected
    case 'members':
      return ctx.isAuthenticated
    case 'public':
      return true
    default:
      return false
  }
}

/**
 * Whether to show a mutual-connection count when the full list is not browsable.
 *
 * Never tease the owner or moderator. They already get the full list.
 * Never tease anonymous viewers. If the viewer can browse the list, skip the teaser.
 * For connections_only strangers, show the count without names.
 * For hidden, show the count only when the viewer is already connected.
 */
export function canViewerSeeMutualConnectionsCount(
  visibility: ConnectionsListVisibility,
  ctx: ConnectionsListViewerContext,
): boolean {
  if (ctx.isOwner || ctx.isModerator) return false
  if (!ctx.isAuthenticated) return false
  if (canViewerBrowseConnectionsList(visibility, ctx)) return false
  return visibility !== 'hidden' || ctx.isConnected
}
