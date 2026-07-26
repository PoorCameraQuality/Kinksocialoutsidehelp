import { sanitizeEckePublicText } from '@c2k/shared'

/** Field names that must never appear in ECKE outbound payloads. */
export const ECKE_NEVER_PUBLISH_FIELDS = [
  'privateNotes',
  'internalNotes',
  'memberOnlyBody',
  'connectionOnlyBody',
  'draftBody',
  'hiddenAuthorData',
  'moderationNotes',
  'applicationMaterials',
  'references',
  'safetyReports',
  'attendeeNames',
  'rsvpList',
  'privateAddress',
  'privateContact',
  'staffOnlyNotes',
  'organizerOnlyMaterials',
  'applicationAnswers',
  'groupMemberList',
  'privateGroupDescription',
  'exactLocationWhenHidden',
  'messages',
  'email',
  'phone',
  'legalName',
  'governmentId',
  'backgroundCheckData',
] as const

export type EckeOmittedField = {
  label: string
  reason: string
}

export function sanitizePublicEckeText(value: string | null | undefined): string | null {
  return sanitizeEckePublicText(value)?.trim() || null
}

export function resolvePublicLocationForEcke(input: {
  location?: string | null
  publicLocationSummary?: string | null
  locationVisibility: 'public' | 'rsvp' | 'approved' | string
}): { publicLocation: string | null; omittedExactLocation: boolean } {
  const summary = input.publicLocationSummary?.trim() || null
  if (input.locationVisibility === 'public') {
    return {
      publicLocation: summary || input.location?.trim() || null,
      omittedExactLocation: false,
    }
  }
  return {
    publicLocation: summary,
    omittedExactLocation: Boolean(input.location?.trim()),
  }
}

export function getGroupOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Member list', reason: 'Group membership is never published to ECKE.' },
    { label: 'Hidden membership settings', reason: 'Membership privacy settings are not affected by ECKE.' },
    { label: 'Private group description', reason: 'Member-only or internal descriptions stay on kink.social.' },
    { label: 'RSVP list', reason: 'Event RSVP data is never published.' },
    { label: 'Private address', reason: 'Exact private addresses are omitted.' },
    { label: 'Staff notes', reason: 'Operational staff notes stay internal.' },
    { label: 'Moderation notes', reason: 'Moderation data is never published.' },
    { label: 'Application answers', reason: 'Join or vetting answers stay private.' },
    { label: 'Private messages', reason: 'Messages and DMs are never published.' },
  ]
}

export function getEventOmittedFields(locationVisibility: string): EckeOmittedField[] {
  const base: EckeOmittedField[] = [
    { label: 'Attendee names', reason: 'RSVP rosters are never published to ECKE.' },
    { label: 'RSVP list', reason: 'RSVP data stays on kink.social.' },
    { label: 'Staff notes', reason: 'Operational notes stay internal.' },
    { label: 'Internal notes', reason: 'Organizer-only notes stay on kink.social.' },
    { label: 'Moderation notes', reason: 'Moderation data is never published.' },
    { label: 'Messages', reason: 'Private messages are never published.' },
    { label: 'Screening question answers', reason: 'Application answers stay private.' },
    { label: 'Approved-attendee-only location', reason: 'Exact address for approved attendees only is never published.' },
  ]
  if (locationVisibility !== 'public') {
    base.unshift({
      label: 'Exact private location',
      reason: 'Full address is hidden when location visibility is not public.',
    })
  }
  return base
}

/** Public-safe event data ECKE does not display yet — shown in preview as deferred, not omitted. */
export function getEventDeferredFields(): EckeOmittedField[] {
  return [
    {
      label: 'Public schedule blocks',
      reason: 'Public-safe but ECKE event page does not display schedule blocks yet.',
    },
    {
      label: 'Public map pins',
      reason: 'Public-safe but ECKE event page does not display map pins yet.',
    },
    {
      label: 'Accessibility information',
      reason: 'Public-safe but ECKE event page does not display accessibility info yet.',
    },
    {
      label: 'Parking / transit information',
      reason: 'Public-safe but ECKE event page does not display parking or transit info yet.',
    },
    {
      label: 'Public policies / code of conduct',
      reason: 'Public-safe but ECKE event page does not display policies yet.',
    },
    {
      label: 'Public ticket / registration links',
      reason: 'Public-safe but ECKE event page may not display ticket links yet.',
    },
  ]
}

export function getEducationOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Draft body', reason: 'Draft content is never published to ECKE.' },
    { label: 'Member-only body', reason: 'Member-only sections stay on kink.social.' },
    { label: 'Connection-only body', reason: 'Connection-only content is not public SEO.' },
    { label: 'Private notes', reason: 'Author private notes stay on kink.social.' },
    { label: 'Internal notes', reason: 'Internal editorial notes are never published.' },
    { label: 'Moderation notes', reason: 'Moderation data is never published.' },
    { label: 'Application materials', reason: 'Application or vetting materials stay private.' },
    { label: 'Hidden author profile data', reason: 'Private profile fields are omitted.' },
    { label: 'Author private email', reason: 'Email addresses are never published to ECKE.' },
    { label: 'Private contact info', reason: 'Private contact fields stay on kink.social.' },
    { label: 'Private files', reason: 'Private attachments and files are never published.' },
    { label: 'Unpublished attachments', reason: 'Draft or unpublished attachments stay on kink.social.' },
    { label: 'Staff comments', reason: 'Staff-only comments are never published.' },
    { label: 'Reports', reason: 'Moderation reports and safety reports stay internal.' },
  ]
}

/** Public-safe education data ECKE does not display yet — shown in preview as deferred, not omitted. */
export function getEducationDeferredFields(): EckeOmittedField[] {
  return [
    {
      label: 'Related public articles',
      reason: 'Public-safe but ECKE education pages may not show related article modules yet.',
    },
    {
      label: 'Learning path placement',
      reason: 'Public-safe but ECKE may not display series or learning path placement yet.',
    },
    {
      label: 'Presenter profile links',
      reason: 'Public-safe but ECKE may not surface presenter cross-links beyond basic attribution yet.',
    },
    {
      label: 'Related public classes or events',
      reason: 'Public-safe but ECKE may not display linked class or event modules yet.',
    },
    {
      label: 'Public org or group context',
      reason: 'Public-safe but ECKE education pages may not show org or group affiliation yet.',
    },
  ]
}

export function getVendorOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Vendor owner legal name', reason: 'Owner identity stays on kink.social unless shown as public shop name.' },
    { label: 'Private owner contact', reason: 'Private contact fields stay on kink.social unless explicitly public.' },
    { label: 'Private email', reason: 'Owner email is never published to ECKE.' },
    { label: 'Private phone', reason: 'Phone numbers are omitted unless explicitly marked public on the shop.' },
    { label: 'Internal notes', reason: 'Shop operator notes are never published.' },
    { label: 'Moderation notes', reason: 'Moderation data is never published.' },
    { label: 'Private inventory data', reason: 'Full inventory and stock levels stay on kink.social.' },
    { label: 'Order and customer data', reason: 'Commerce transactions are never published.' },
    { label: 'Payment info', reason: 'Payment methods and billing data are never published.' },
    { label: 'Payout info', reason: 'Payout and commission settlement data are never published.' },
    { label: 'API keys and tokens', reason: 'Integration secrets are never published.' },
    { label: 'OAuth tokens', reason: 'OAuth credentials are never published.' },
    { label: 'Etsy / Shopify / Woo secrets', reason: 'External store credentials are never published.' },
    { label: 'Private files', reason: 'Non-public uploads are never published.' },
    { label: 'Draft or unlisted products', reason: 'Only public-safe vendor profile fields publish today.' },
    { label: 'Staff-only comments', reason: 'Internal shop discussion is never published.' },
    { label: 'Reports', reason: 'Moderation reports are never published.' },
  ]
}

export function getVendorDeferredFields(): EckeOmittedField[] {
  return [
    {
      label: 'Event appearances',
      reason: 'Public-safe but ECKE vendor pages may not show event booth modules yet.',
    },
    {
      label: 'Sponsor relationships',
      reason: 'Public-safe but ECKE may not display sponsor badges on vendor pages yet.',
    },
    {
      label: 'Public product highlights',
      reason: 'Public-safe but ECKE vendor detail may not embed synced product grids yet.',
    },
    {
      label: 'Public vendor booth locations',
      reason: 'Public-safe but ECKE may not show convention booth maps yet.',
    },
    {
      label: 'Public reviews / feedback summaries',
      reason: 'Public-safe but ECKE may not display vendor review modules yet.',
    },
  ]
}

export function getVenueOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Private address', reason: 'Exact private addresses are omitted for non-public venues.' },
    { label: 'Staff notes', reason: 'Operational notes stay internal.' },
    { label: 'Internal owner notes', reason: 'Internal notes are never published.' },
    { label: 'Hidden access instructions', reason: 'Non-public access details stay on kink.social.' },
    { label: 'Member-only location details', reason: 'Member-only venue data is never published.' },
    { label: 'Owner private contact', reason: 'Private contact stays on kink.social.' },
    { label: 'Moderation notes', reason: 'Moderation data is never published.' },
    { label: 'Reports', reason: 'Moderation reports are never published.' },
    { label: 'Internal safety notes', reason: 'Staff-only safety notes are never published.' },
  ]
}

export function getOrgOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Member roster', reason: 'Organization member lists never publish to ECKE.' },
    { label: 'Private staff lists', reason: 'Internal staff rosters stay on kink.social.' },
    { label: 'Private addresses', reason: 'Exact private addresses are omitted unless explicitly public.' },
    { label: 'Internal org notes', reason: 'Internal notes are never published.' },
    { label: 'Moderation notes', reason: 'Moderation data is never published.' },
    { label: 'Reports', reason: 'Moderation reports are never published.' },
    { label: 'Private contact info', reason: 'Private email/phone never publish.' },
    { label: 'Application answers', reason: 'Membership application data is never published.' },
  ]
}

export function getOrgDeferredFields(): EckeOmittedField[] {
  return [
    { label: 'Public maps', reason: 'Public-safe but ECKE org pages may not show map modules yet.' },
    { label: 'Public pins', reason: 'Public-safe but ECKE may not display map pins yet.' },
    { label: 'Public schedules', reason: 'Public-safe but ECKE org pages may not embed schedules yet.' },
    { label: 'Public recurring meetup info', reason: 'Public-safe but ECKE may not display recurring meetups yet.' },
    { label: 'Public policies', reason: 'Public-safe but ECKE may not show policy modules yet.' },
    { label: 'Public vendor/presenter relationships', reason: 'Public-safe but ECKE may not link related modules yet.' },
  ]
}

export function getConventionOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Attendee list', reason: 'Convention attendee rosters never publish.' },
    { label: 'Applications', reason: 'Registration applications never publish.' },
    { label: 'Private staff notes', reason: 'Staff-only notes stay internal.' },
    { label: 'Private locations', reason: 'Hidden venue addresses stay on kink.social.' },
    { label: 'Volunteer/private shifts', reason: 'Internal shift assignments with private notes never publish.' },
    { label: 'Internal room notes', reason: 'Operational room notes stay internal.' },
    { label: 'Moderation/safety reports', reason: 'Reports never publish.' },
    { label: 'Private contact info', reason: 'Private organizer contact never publishes.' },
  ]
}

export function getConventionDeferredFields(): EckeOmittedField[] {
  return [
    { label: 'Full schedule', reason: 'Public-safe slots may publish via Dancecard; full ECKE schedule modules may lag.' },
    { label: 'Public maps', reason: 'Public-safe but ECKE convention pages may not show maps yet.' },
    { label: 'Public vendors', reason: 'Public-safe but ECKE may not embed vendor modules yet.' },
    { label: 'Public presenters/classes', reason: 'Public-safe but ECKE may not show class grids yet.' },
    { label: 'Public sponsor blocks', reason: 'Public-safe but ECKE may not display sponsors yet.' },
    { label: 'Public policies/code of conduct', reason: 'Public-safe but ECKE may not show policy modules yet.' },
  ]
}

export function getDancecardOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Raw staff access codes', reason: 'Access codes are redacted in preview; only “configured” is shown.' },
    { label: 'Raw registration access codes', reason: 'Registration codes are redacted in preview.' },
    { label: 'Private staff notes', reason: 'Staff-only notes on shifts never publish.' },
    { label: 'Private volunteer notes', reason: 'Volunteer operational notes stay internal.' },
    { label: 'Staff user IDs', reason: 'Internal user identifiers never publish.' },
    { label: 'Private contact info', reason: 'Private contact never publishes.' },
    { label: 'Attendee data', reason: 'Attendee information never publishes.' },
    { label: 'Safety notes', reason: 'Internal safety notes stay internal.' },
  ]
}

export function getDancecardDeferredFields(): EckeOmittedField[] {
  return [
    {
      label: 'Dancecard location rows',
      reason: 'Locations publish inside the dancecard bundle; separate location cards are preview-only.',
    },
    {
      label: 'Dancecard program slots',
      reason: 'Slots publish inside the dancecard bundle; separate slot cards are preview-only.',
    },
    {
      label: 'Dancecard staff shifts',
      reason: 'Staff shifts publish inside the dancecard bundle; separate shift cards are preview-only.',
    },
  ]
}

export function getPresenterOmittedFields(): EckeOmittedField[] {
  return [
    { label: 'Private contact', reason: 'Email, phone, and private messaging never publish.' },
    { label: 'Legal name', reason: 'Legal identity fields stay on kink.social unless explicitly public.' },
    { label: 'References', reason: 'Reference materials stay private.' },
    { label: 'Application answers', reason: 'Application materials never publish.' },
    { label: 'Runner-only materials', reason: 'Internal runner materials stay private.' },
    { label: 'Background story', reason: 'Organizer-only background narrative stays private.' },
    { label: 'Private notes', reason: 'Internal notes never publish.' },
    { label: 'Moderation notes', reason: 'Moderation data never publishes.' },
    { label: 'Reports', reason: 'Safety and moderation reports stay internal.' },
    { label: 'Private files', reason: 'Private attachments never publish.' },
  ]
}

export function getPresenterDeferredFields(): EckeOmittedField[] {
  return [
    { label: 'Public classes', reason: 'Public-safe but ECKE may not list classes yet.' },
    { label: 'Public articles', reason: 'Public-safe but ECKE may not embed education articles yet.' },
    { label: 'Convention appearances', reason: 'Public-safe but ECKE presenter page may not list appearances yet.' },
  ]
}

export function isPublicGroupVisibility(visibility: string): boolean {
  return visibility.toLowerCase() === 'public'
}

export function isGroupListingEntityEligible(input: {
  visibility: string
  disbandedAt?: Date | null
}): { eligible: boolean; reason?: string } {
  if (input.disbandedAt) {
    return { eligible: false, reason: 'Disbanded groups cannot publish to East Coast Kink Events.' }
  }
  if (!isPublicGroupVisibility(input.visibility)) {
    return {
      eligible: false,
      reason: 'Only public groups can be listed on East Coast Kink Events. Private and invite-only groups are not eligible.',
    }
  }
  return { eligible: true }
}
