import type { FastifyInstance } from 'fastify'
import { isProductionRuntime } from './production-guard.js'

/**
 * App-layer security headers (defense in depth alongside Caddy).
 * Conservative defaults — no CSP that would break `/share/*` HTML or JSON APIs.
 */
export async function registerSecurityHeaders(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('X-DNS-Prefetch-Control', 'off')
    reply.header('Cross-Origin-Resource-Policy', 'same-site')
    reply.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    )
    if (isProductionRuntime()) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    return payload
  })
}
