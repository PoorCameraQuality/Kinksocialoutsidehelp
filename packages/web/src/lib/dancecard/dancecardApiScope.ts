/**
 * API path helpers so Convention Dancecard panels can target conventions or play spaces.
 */
export type DancecardApiKind = 'convention' | 'play-space'

export type DancecardApiScope = {
  kind: DancecardApiKind
  /** URL-encoded slug/key */
  key: string
  /** Unencoded slug for building public share URLs */
  slug: string
  /** Hide volunteer shifts / swap UI (play spaces). */
  showVolunteerTools: boolean
  /** Hide reschedule propose forms when API lacks those routes. */
  showReschedule: boolean
}

export function makeDancecardApiScope(
  kind: DancecardApiKind,
  slug: string,
): DancecardApiScope {
  return {
    kind,
    key: encodeURIComponent(slug),
    slug,
    showVolunteerTools: kind === 'convention',
    showReschedule: kind === 'convention',
  }
}

export function dancecardApiBase(scope: DancecardApiScope): string {
  return scope.kind === 'play-space'
    ? `/api/v1/play-spaces/${scope.key}`
    : `/api/v1/conventions/${scope.key}`
}

export function dancecardSharePublicPath(scope: DancecardApiScope, token: string): string {
  return scope.kind === 'play-space'
    ? `/play/${encodeURIComponent(scope.slug)}/s/${encodeURIComponent(token)}`
    : `/conventions/${encodeURIComponent(scope.slug)}/dancecard/s/${encodeURIComponent(token)}`
}

/** Strip calendar id prefix `dc:` before DELETE. */
export function dancecardEntryIdForApi(calendarItemId: string): string {
  return calendarItemId.startsWith('dc:') ? calendarItemId.slice(3) : calendarItemId
}

export function extractDancecardShareToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let path = trimmed
  try {
    path = new URL(trimmed).pathname
  } catch {
    // Not an absolute URL — also strip query/hash from pasted paths.
    path = trimmed.split(/[?#]/, 1)[0] ?? trimmed
  }

  const fromConv = path.match(/\/dancecard\/s\/([a-f0-9]{16,64})\/?/i)
  if (fromConv?.[1]) return fromConv[1]
  const fromPlay = path.match(/\/play\/[^/]+\/s\/([a-f0-9]{16,64})\/?/i)
  if (fromPlay?.[1]) return fromPlay[1]
  if (/^[a-f0-9]{32,64}$/i.test(trimmed)) return trimmed
  return null
}

export type DancecardCompareInput =
  | { kind: 'token'; token: string }
  | { kind: 'username'; username: string }

/** Accept a full share URL/token, @username, or /profile/username. */
export function parseDancecardCompareInput(raw: string): DancecardCompareInput | null {
  const token = extractDancecardShareToken(raw)
  if (token) return { kind: 'token', token }

  let value = raw.trim()
  if (!value) return null
  try {
    const u = new URL(value)
    const m = u.pathname.match(/\/profile\/([^/]+)\/?/i)
    if (m?.[1]) value = decodeURIComponent(m[1])
  } catch {
    const m = value.match(/\/profile\/([^/?#]+)\/?/i)
    if (m?.[1]) value = decodeURIComponent(m[1])
  }
  if (value.startsWith('@')) value = value.slice(1)
  value = value.trim().toLowerCase()
  if (/^[a-z0-9_]{2,64}$/.test(value)) return { kind: 'username', username: value }
  return null
}
