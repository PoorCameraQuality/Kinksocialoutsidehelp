import { normalizeEventSlug } from '@/lib/dancecard/slug'

/** Seeded demo event slug (`npm run dancecard:seed-sandbox`). */
export const PUBLIC_SANDBOX_SLUG = 'sandbox'

/** Attendee + organizer demos share this event. */
export const PUBLIC_ATTENDEE_DEMO_SLUG = PUBLIC_SANDBOX_SLUG

export function isPublicSandboxSlug(eventSlug: string): boolean {
  return normalizeEventSlug(eventSlug) === PUBLIC_SANDBOX_SLUG
}

export function isPublicAttendeeDemoSlug(eventSlug: string): boolean {
  return isPublicSandboxSlug(eventSlug)
}

/**
 * Production: allow public sandbox demos.
 * Disable with `DANCECARD_PUBLIC_SANDBOX_DEMO=0` on Vercel.
 */
export function publicSandboxDemoEnabled(): boolean {
  if (process.env.DANCECARD_PUBLIC_SANDBOX_DEMO === '0') return false
  return true
}

/** @deprecated Use {@link publicSandboxDemoEnabled}. */
export const publicSandboxOrganizerDemoEnabled = publicSandboxDemoEnabled

/** No event password on the public sandbox; explore without an access code. */
export function allowPublicAttendeeDemoAccess(eventSlug: string): boolean {
  return publicSandboxDemoEnabled() && isPublicAttendeeDemoSlug(eventSlug)
}

export function allowPublicSandboxOrganizerAccess(eventSlug: string): boolean {
  return publicSandboxDemoEnabled() && isPublicSandboxSlug(eventSlug)
}
