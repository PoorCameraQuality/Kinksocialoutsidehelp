type ProfileLike = Record<string, unknown> & { backgroundStory?: string | null }
type OfferingLike = Record<string, unknown> & { runnerMaterials?: unknown }

/** Organizer-only narrative (logistics, internal notes) — not public. */
export function canSeePresenterOrganizerFields(isOwner: boolean, canSeeRunnerMaterials: boolean): boolean {
  return isOwner || canSeeRunnerMaterials
}

export function presenterProfileForViewer(
  profile: ProfileLike,
  canSeeOrganizerFields: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...profile }
  if (!canSeeOrganizerFields) {
    delete out.backgroundStory
  }
  return out
}

export function serializePresenterProfileForApiResponse(
  profile: ProfileLike,
  access: { isOwner: boolean; canSeeRunnerMaterials: boolean }
): Record<string, unknown> {
  return presenterProfileForViewer(
    profile,
    canSeePresenterOrganizerFields(access.isOwner, access.canSeeRunnerMaterials)
  )
}

export function offeringForViewer(
  row: OfferingLike,
  includeRunnerMaterials: boolean
): Record<string, unknown> {
  const o: Record<string, unknown> = { ...row }
  if (!includeRunnerMaterials) {
    delete o.runnerMaterials
  }
  return o
}
