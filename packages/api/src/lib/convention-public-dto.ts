import type { ConventionPublicSettings, conventions } from '../db/schema.js'

type ConventionRow = typeof conventions.$inferSelect

/** Strip gate codes and organizer-only JSON from settings on world-readable convention GETs. */
export function redactConventionSettingsForPublic(
  settings: ConventionPublicSettings | null | undefined,
): ConventionPublicSettings {
  if (!settings || typeof settings !== 'object') return {}
  const { staffAccessCode: _staff, registrationAccessCode: _reg, dancecardEmbedTokenHint: _embed, venueRooms: _rooms, eventSystems, hotelBlocks, ...rest } =
    settings
  const publicEs = eventSystems ?
      {
        productTitle: eventSystems.productTitle,
        eventTitle: eventSystems.eventTitle,
        sharedByLabel: eventSystems.sharedByLabel,
        sharedByDetail: eventSystems.sharedByDetail,
        logoUrl: eventSystems.logoUrl,
        eventProfile: eventSystems.eventProfile,
        peopleHubTemplate: eventSystems.peopleHubTemplate,
      }
    : undefined
  const publicHotelBlocks = hotelBlocks?.map(({ label, url }) => ({ label, ...(url ? { url } : {}) }))
  return {
    ...rest,
    ...(publicEs ? { eventSystems: publicEs } : {}),
    ...(publicHotelBlocks ? { hotelBlocks: publicHotelBlocks } : {}),
  }
}

export function toPublicConventionDto(
  conv: ConventionRow,
  opts?: { includeFullSettings?: boolean },
): ConventionRow {
  if (opts?.includeFullSettings) return conv
  return {
    ...conv,
    settings: redactConventionSettingsForPublic(conv.settings as ConventionPublicSettings | null | undefined),
  }
}
