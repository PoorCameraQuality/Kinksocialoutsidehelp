import Stripe from 'stripe'

let client: Stripe | null = null

/** Platform Stripe secret — never hardcode; load from env / gitignored `.env*.local` only. */
export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  return key || null
}

export function getStripeWebhookSecret(): string | null {
  const key = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  return key || null
}

export function getStripePublishableKey(): string | null {
  const key = process.env.STRIPE_PUBLISHABLE_KEY?.trim() || process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim()
  return key || null
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey())
}

/**
 * Singleton Stripe SDK client for the Connect platform account.
 * Returns null when STRIPE_SECRET_KEY is unset (routes should 503).
 */
export function getStripe(): Stripe | null {
  const secret = getStripeSecretKey()
  if (!secret) return null
  if (!client) {
    const opts: Stripe.StripeConfig = {
      typescript: true,
      appInfo: { name: 'Kink Social', url: 'https://kink.social' },
    }
    const pinned = process.env.STRIPE_API_VERSION?.trim()
    if (pinned) opts.apiVersion = pinned as Stripe.LatestApiVersion
    client = new Stripe(secret, opts)
  }
  return client
}

/** Test helper — reset singleton between unit tests. */
export function resetStripeClientForTests(): void {
  client = null
}

export function publicWebBaseUrl(): string {
  return (
    process.env.C2K_PUBLIC_WEB_URL?.replace(/\/$/, '') ||
    process.env.VITE_SITE_URL?.replace(/\/$/, '') ||
    'https://kink.social'
  )
}

/**
 * Stripe rejects localhost / non-public URLs for `business_profile.url`.
 * Prefer a public HTTPS site URL; fall back to production host for local dev.
 */
export function stripeBusinessProfileUrl(
  slug: string,
  kind: 'org' | 'vendor' = 'org',
): string {
  const segment = kind === 'vendor' ? 'vendors' : 'orgs'
  const base = publicWebBaseUrl()
  try {
    const u = new URL(base)
    const host = u.hostname.toLowerCase()
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      u.protocol === 'http:'
    if (isLocal) return `https://kink.social/${segment}/${encodeURIComponent(slug)}`
    return `${base.replace(/\/$/, '')}/${segment}/${encodeURIComponent(slug)}`
  } catch {
    return `https://kink.social/${segment}/${encodeURIComponent(slug)}`
  }
}
