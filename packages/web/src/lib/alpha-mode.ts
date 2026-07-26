export type AlphaModeState = {
  inviteRequired: boolean
  registrationOpen: boolean
}

export async function fetchAlphaMode(): Promise<AlphaModeState> {
  try {
    const r = await fetch('/api/auth/registration-policy', { credentials: 'same-origin' })
    if (!r.ok) return { inviteRequired: false, registrationOpen: true }
    const data = (await r.json()) as { inviteRequired?: boolean; registrationOpen?: boolean }
    return {
      inviteRequired: data.inviteRequired === true,
      registrationOpen: data.registrationOpen !== false,
    }
  } catch {
    return { inviteRequired: false, registrationOpen: true }
  }
}

export function isAlphaInviteMode(mode: AlphaModeState): boolean {
  return mode.inviteRequired || !mode.registrationOpen
}

export const ALPHA_UPLOAD_DISABLED_COPY =
  'This upload type is disabled during beta while we test safety and upload moderation. Profile photos are currently supported.'
