/** Row role in dancecard_event_organizers; site admins bypass with full owner powers in APIs. */
export type OrganizerEventRole = 'owner' | 'editor' | 'viewer' | 'safety'

/** Effective role returned to the client (admin = site admin, treated like owner for UI). */
export type OrganizerRoleForClient = OrganizerEventRole | 'admin'

export function organizerRoleCanMutate(role: OrganizerRoleForClient): boolean {
  return role !== 'viewer'
}

export function organizerRoleCanEditAccessSettings(role: OrganizerRoleForClient): boolean {
  return role === 'owner' || role === 'admin'
}

/** Internal registrant notes - not visible to safety-only organizers. */
export function organizerRoleCanSeeRegistrantInternalNotes(role: OrganizerRoleForClient): boolean {
  return role !== 'viewer' && role !== 'safety'
}

/** Vetting / safety-restricted registrant fields. */
export function organizerRoleCanEditVettingSafetyNotes(role: OrganizerRoleForClient): boolean {
  return role === 'owner' || role === 'admin' || role === 'safety'
}
