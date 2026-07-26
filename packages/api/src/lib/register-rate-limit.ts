import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import { isRateLimitDisabled } from './rate-limit-config.js'

export async function registerApiRateLimit(app: FastifyInstance): Promise<void> {
  if (isRateLimitDisabled()) {
    app.log.info('API rate limits disabled (C2K_RATE_LIMIT_DISABLE=true)')
    return
  }
  await app.register(rateLimit, {
    global: false,
    hook: 'preHandler',
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'retry-after': true,
    },
  })
  app.log.info('API rate limits enabled on selected auth/public routes')
}
