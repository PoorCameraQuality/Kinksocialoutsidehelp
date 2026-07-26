import crypto from 'crypto'

export type DancecardHandoffPayload = {
  dancecardSlug: string
  c2kConventionSlug: string
  email?: string
  exp: number
}

function secret() {
  const s = process.env.DANCECARD_C2K_HANDOFF_SECRET
  if (!s || s.length < 16) return null
  return s
}

export function mintDancecardHandoffCode(input: {
  dancecardSlug: string
  c2kConventionSlug: string
  email?: string
}): string | null {
  const key = secret()
  if (!key) return null
  const payload: DancecardHandoffPayload = {
    dancecardSlug: input.dancecardSlug.toLowerCase(),
    c2kConventionSlug: input.c2kConventionSlug,
    email: input.email?.trim().toLowerCase(),
    exp: Date.now() + 60_000,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}
