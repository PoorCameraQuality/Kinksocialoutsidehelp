export type EckePublishTargetResult = {
  ok?: boolean
  error?: string
  targetKind?: string
}

/** Legacy listing webhook is optional; ecke_event + Dancecard sync via Supabase. */
export function isOptionalEckeListingWebhookFailure(target: EckePublishTargetResult): boolean {
  return (
    target.ok === false &&
    target.targetKind === 'ecke_listing' &&
    (target.error?.includes('ECKE_PUBLISH_LISTING_WEBHOOK_URL not configured') ?? false)
  )
}

/** Blocking failure message, or null when publish succeeded (including partial legacy listing skip). */
export function getEckePublishFailureMessage(targets: EckePublishTargetResult[] | undefined): string | null {
  if (!targets?.length) return null

  const hardFailures = targets.filter((t) => t.ok === false && !isOptionalEckeListingWebhookFailure(t))
  if (hardFailures[0]?.error) return hardFailures[0].error

  if (targets.every((t) => t.ok === false)) {
    return targets[0]?.error ?? 'East Coast Kink Events publish failed.'
  }

  return null
}

export function eckePublishHadListingWebhookSkip(targets: EckePublishTargetResult[] | undefined): boolean {
  return targets?.some(isOptionalEckeListingWebhookFailure) ?? false
}
