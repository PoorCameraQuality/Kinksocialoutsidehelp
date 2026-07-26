/**
 * Product policy: who may read the published program (schedule slots).
 *
 * - `publicProgramListing === true` (default when unset): GET /conventions/:key/slots is world-readable.
 *   Use when org wants marketing / open schedule like a fan con grid.
 * - `publicProgramListing === false`: slots require the same access as documents (grant / staff / org mod):
 *   attendee-gated program for vetting-heavy or paid-inner-circle cons.
 *
 * Per-slot `isPublished` and `visibility` are enforced separately - draft slots never appear on public paths.
 *
 * Org moderators always see full program via Manage regardless of this flag.
 */

import type { ConventionPublicSettings } from '../db/schema.js'

export function isPublicProgramListing(settings: ConventionPublicSettings | null | undefined): boolean {
  if (!settings || typeof settings !== 'object') return true
  const v = (settings as { publicProgramListing?: boolean }).publicProgramListing
  if (v === false) return false
  return true
}

/** Viewer tier for public program slot filtering (GET /slots, ICS, ECKE sync). */
export type PublicProgramViewer = 'anonymous' | 'attendee' | 'staff'

export type PublicProgramSlot = {
  isPublished: boolean
  visibility?: string | null
}

function normalizeSlotVisibility(visibility: string | null | undefined): string {
  return (visibility ?? 'ATTENDEE').toUpperCase()
}

/** Whether a slot may appear on attendee/public schedule surfaces. Drafts are always excluded. */
export function slotVisibleOnPublicProgram(
  slot: PublicProgramSlot,
  viewer: PublicProgramViewer,
): boolean {
  if (!slot.isPublished) return false
  const v = normalizeSlotVisibility(slot.visibility)
  if (viewer === 'staff') {
    return v !== 'HIDDEN' && v !== 'SECRET'
  }
  if (v === 'STAFF' || v === 'STAFF_ONLY' || v === 'HIDDEN' || v === 'SECRET') return false
  return true
}

export function filterSlotsForPublicProgram<T extends PublicProgramSlot>(
  slots: T[],
  viewer: PublicProgramViewer,
): T[] {
  return slots.filter((s) => slotVisibleOnPublicProgram(s, viewer))
}

export function publicProgramViewerFromAccess(includeStaffOnProgram: boolean, viewerId: string | null): PublicProgramViewer {
  if (includeStaffOnProgram) return 'staff'
  if (viewerId) return 'attendee'
  return 'anonymous'
}
