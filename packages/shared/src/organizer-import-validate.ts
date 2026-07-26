export function isWithinEventWindow(
  startsAt: string,
  endsAt: string,
  windowStartsAt: string,
  windowEndsAt: string,
): boolean {
  const ws = new Date(windowStartsAt).getTime()
  const we = new Date(windowEndsAt).getTime()
  const s = new Date(startsAt).getTime()
  const e = new Date(endsAt).getTime()
  if (!Number.isFinite(ws) || !Number.isFinite(we) || !Number.isFinite(s) || !Number.isFinite(e)) return true
  return s >= ws && e <= we
}

export function appendWindowValidationErrors(
  startsAt: string | undefined,
  endsAt: string | undefined,
  windowStartsAt: string | undefined,
  windowEndsAt: string | undefined,
  errors: string[],
): string[] {
  if (!startsAt || !endsAt || !windowStartsAt || !windowEndsAt) return errors
  if (!isWithinEventWindow(startsAt, endsAt, windowStartsAt, windowEndsAt)) {
    return [...errors, 'Outside convention event window']
  }
  return errors
}
