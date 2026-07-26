/** US Census place class suffixes. Stored in DB but hidden in member-facing UI. */
const CENSUS_PLACE_SUFFIX =
  /\s+(city|town|village|CDP|borough|municipality|uco|UTC)$/i

/**
 * Strip census legal-class suffixes from a place name for display.
 * Examples: Fall River city -> Fall River, Holbrook CDP -> Holbrook.
 */
export function formatPlaceDisplayName(raw: string): string {
  let name = raw.trim()
  if (!name) return name
  let prev = ''
  while (name !== prev) {
    prev = name
    name = name.replace(CENSUS_PLACE_SUFFIX, '').trim()
  }
  return name
}

/** "City, State" label for profiles, groups, and location pickers. */
export function formatPlaceLocationLabel(placeName: string, stateName: string): string {
  const city = formatPlaceDisplayName(placeName)
  const state = stateName.trim()
  if (!city) return state
  if (!state) return city
  return `${city}, ${state}`
}
