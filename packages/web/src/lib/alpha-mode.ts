export type AlphaModeState = {
  inviteRequired: boolean
  registrationOpen: boolean
}

const DEFAULT_ALPHA: AlphaModeState = { inviteRequired: false, registrationOpen: true }

let cachedPolicy: AlphaModeState | null = null
let inflight: Promise<AlphaModeState> | null = null

/**
 * Registration policy for login/signup UI.
 * Module-cached so remounts (redirect races, Strict Mode) cannot hammer the API.
 */
export async function fetchAlphaMode(): Promise<AlphaModeState> {
  if (cachedPolicy) return cachedPolicy
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch('/api/auth/registration-policy', { credentials: 'same-origin' })
      if (!r.ok) return DEFAULT_ALPHA
      const data = (await r.json()) as { inviteRequired?: boolean; registrationOpen?: boolean }
      cachedPolicy = {
        inviteRequired: data.inviteRequired === true,
        registrationOpen: data.registrationOpen !== false,
      }
      return cachedPolicy
    } catch {
      return DEFAULT_ALPHA
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function isAlphaInviteMode(mode: AlphaModeState): boolean {
  return mode.inviteRequired || !mode.registrationOpen
}

export const ALPHA_UPLOAD_DISABLED_COPY =
  'This upload type is disabled during beta while we test safety and upload moderation. Profile photos are currently supported.'
