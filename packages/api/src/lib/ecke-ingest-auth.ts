import { createHmac, randomUUID } from 'node:crypto'

/**
 * Build outbound auth headers for ECKE ingest/listing webhooks.
 *
 * HMAC (when `hmacSecret` is set): SHA-256 over the exact UTF-8 bytes of
 * `${unixSeconds}.${body}` — same raw JSON string that will be POSTed as the body.
 * Verifiers must use that same concatenation; do not re-serialize or strip whitespace.
 */
export function buildEckeOutboundAuthHeaders(
  body: string,
  opts: {
    bearerSecret?: string
    hmacSecret?: string
    idempotencyKey?: string
  },
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-C2K-Request-Id': randomUUID(),
  }

  if (opts.idempotencyKey) {
    headers['X-C2K-Idempotency-Key'] = opts.idempotencyKey
  }

  if (opts.bearerSecret) {
    headers.Authorization = `Bearer ${opts.bearerSecret}`
  }

  if (opts.hmacSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac('sha256', opts.hmacSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    headers['X-Kink-Social-Timestamp'] = timestamp
    headers['X-Kink-Social-Signature'] = signature
  }

  return headers
}

export function readEckePublishHmacSecret(): string | undefined {
  return (
    process.env.ECKE_PUBLISH_HMAC_SECRET?.trim() ||
    process.env.KINK_SOCIAL_INGEST_HMAC_SECRET?.trim() ||
    undefined
  )
}
