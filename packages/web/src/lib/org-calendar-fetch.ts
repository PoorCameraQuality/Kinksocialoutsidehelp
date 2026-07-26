export type OrgCalendarLoadState = 'loading' | 'ready' | 'disabled' | 'error'

export function isCalendarDisabledResponse(res: Response, body?: { error?: string } | null): boolean {
  if (res.status !== 404) return false
  const err = typeof body?.error === 'string' ? body.error : ''
  return /calendar disabled/i.test(err)
}

export async function calendarApiFailureKind(res: Response): Promise<'disabled' | 'error'> {
  let body: { error?: string } | null = null
  try {
    body = (await res.clone().json()) as { error?: string }
  } catch {
    /* non-JSON body */
  }
  return isCalendarDisabledResponse(res, body) ? 'disabled' : 'error'
}

/** Merge paired events/conventions fetch results into one load state. */
export function mergeCalendarLoadState(
  eventsState: OrgCalendarLoadState,
  conventionsState: OrgCalendarLoadState,
): OrgCalendarLoadState {
  if (eventsState === 'loading' || conventionsState === 'loading') return 'loading'
  if (eventsState === 'error' || conventionsState === 'error') return 'error'
  if (eventsState === 'disabled' || conventionsState === 'disabled') return 'disabled'
  return 'ready'
}
