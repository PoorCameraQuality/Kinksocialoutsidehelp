import type { FastifyContextConfig, FastifyRequest } from 'fastify'
import { getRequestIpRaw } from './client-ip.js'

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function isRateLimitDisabled(): boolean {
  return process.env.C2K_RATE_LIMIT_DISABLE === 'true'
}

export type RateLimitPreset =
  | 'login'
  | 'register'
  | 'passwordResetRequest'
  | 'passwordResetConfirm'
  | 'passwordChange'
  | 'pushSubscribe'
  | 'scopeEmailSubscribe'
  | 'reports'
  | 'messages'
  | 'feedPosts'
  | 'feedComments'
  | 'upload'
  | 'search'
  | 'ownerInvestigation'
  | 'moderationActions'
  | 'emailVerificationSend'
  | 'emailVerificationConfirm'
  | 'paymentsVault'

function presetConfig(preset: RateLimitPreset): { max: number; timeWindow: number } {
  switch (preset) {
    case 'login':
      return {
        max: intEnv('C2K_RATE_LIMIT_LOGIN_MAX', 10),
        timeWindow: intEnv('C2K_RATE_LIMIT_LOGIN_WINDOW_MS', 60_000),
      }
    case 'register':
      return {
        max: intEnv('C2K_RATE_LIMIT_REGISTER_MAX', 5),
        timeWindow: intEnv('C2K_RATE_LIMIT_REGISTER_WINDOW_MS', 3_600_000),
      }
    case 'passwordResetRequest':
      return {
        max: intEnv('C2K_RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX', 5),
        timeWindow: intEnv('C2K_RATE_LIMIT_PASSWORD_RESET_REQUEST_WINDOW_MS', 3_600_000),
      }
    case 'passwordResetConfirm':
      return {
        max: intEnv('C2K_RATE_LIMIT_PASSWORD_RESET_CONFIRM_MAX', 10),
        timeWindow: intEnv('C2K_RATE_LIMIT_PASSWORD_RESET_CONFIRM_WINDOW_MS', 3_600_000),
      }
    case 'passwordChange':
      return {
        max: intEnv('C2K_RATE_LIMIT_PASSWORD_CHANGE_MAX', 10),
        timeWindow: intEnv('C2K_RATE_LIMIT_PASSWORD_CHANGE_WINDOW_MS', 3_600_000),
      }
    case 'pushSubscribe':
      return {
        max: intEnv('C2K_RATE_LIMIT_PUSH_SUBSCRIBE_MAX', 30),
        timeWindow: intEnv('C2K_RATE_LIMIT_PUSH_SUBSCRIBE_WINDOW_MS', 3_600_000),
      }
    case 'scopeEmailSubscribe':
      return {
        max: intEnv('C2K_RATE_LIMIT_SCOPE_EMAIL_SUBSCRIBE_MAX', 20),
        timeWindow: intEnv('C2K_RATE_LIMIT_SCOPE_EMAIL_SUBSCRIBE_WINDOW_MS', 3_600_000),
      }
    case 'reports':
      return {
        max: intEnv('C2K_RATE_LIMIT_REPORTS_MAX', 15),
        timeWindow: intEnv('C2K_RATE_LIMIT_REPORTS_WINDOW_MS', 3_600_000),
      }
    case 'messages':
      return {
        max: intEnv('C2K_RATE_LIMIT_MESSAGES_MAX', 60),
        timeWindow: intEnv('C2K_RATE_LIMIT_MESSAGES_WINDOW_MS', 60_000),
      }
    case 'feedPosts':
      return {
        max: intEnv('C2K_RATE_LIMIT_FEED_POSTS_MAX', 20),
        timeWindow: intEnv('C2K_RATE_LIMIT_FEED_POSTS_WINDOW_MS', 3_600_000),
      }
    case 'feedComments':
      return {
        max: intEnv('C2K_RATE_LIMIT_FEED_COMMENTS_MAX', 40),
        timeWindow: intEnv('C2K_RATE_LIMIT_FEED_COMMENTS_WINDOW_MS', 3_600_000),
      }
    case 'upload':
      return {
        max: intEnv('C2K_RATE_LIMIT_UPLOAD_MAX', 30),
        timeWindow: intEnv('C2K_RATE_LIMIT_UPLOAD_WINDOW_MS', 3_600_000),
      }
    case 'search':
      return {
        max: intEnv('C2K_RATE_LIMIT_SEARCH_MAX', 120),
        timeWindow: intEnv('C2K_RATE_LIMIT_SEARCH_WINDOW_MS', 60_000),
      }
    case 'ownerInvestigation':
      return {
        max: intEnv('C2K_RATE_LIMIT_OWNER_INVESTIGATION_MAX', 60),
        timeWindow: intEnv('C2K_RATE_LIMIT_OWNER_INVESTIGATION_WINDOW_MS', 3_600_000),
      }
    case 'moderationActions':
      return {
        max: intEnv('C2K_RATE_LIMIT_MODERATION_ACTIONS_MAX', 60),
        timeWindow: intEnv('C2K_RATE_LIMIT_MODERATION_ACTIONS_WINDOW_MS', 3_600_000),
      }
    case 'emailVerificationSend':
      return {
        max: intEnv('C2K_RATE_LIMIT_EMAIL_VERIFY_SEND_MAX', 8),
        timeWindow: intEnv('C2K_RATE_LIMIT_EMAIL_VERIFY_SEND_WINDOW_MS', 3_600_000),
      }
    case 'emailVerificationConfirm':
      return {
        max: intEnv('C2K_RATE_LIMIT_EMAIL_VERIFY_CONFIRM_MAX', 20),
        timeWindow: intEnv('C2K_RATE_LIMIT_EMAIL_VERIFY_CONFIRM_WINDOW_MS', 3_600_000),
      }
    case 'paymentsVault':
      return {
        max: intEnv('C2K_RATE_LIMIT_PAYMENTS_VAULT_MAX', 10),
        timeWindow: intEnv('C2K_RATE_LIMIT_PAYMENTS_VAULT_WINDOW_MS', 3_600_000),
      }
    default: {
      const _exhaustive: never = preset
      return _exhaustive
    }
  }
}

function clientIpKey(req: FastifyRequest): string {
  return getRequestIpRaw(req)
}

/** Route `config` for @fastify/rate-limit when limits are enabled. */
export function rateLimitRoute(
  preset: RateLimitPreset,
  opts?: { keySuffix?: (req: FastifyRequest) => string },
): { config: FastifyContextConfig } {
  if (isRateLimitDisabled()) return { config: {} }
  const base = presetConfig(preset)
  return {
    config: {
      rateLimit: {
        ...base,
        keyGenerator: (req) => {
          const suffix = opts?.keySuffix?.(req) ?? ''
          return `${preset}:${clientIpKey(req)}${suffix ? `:${suffix}` : ''}`
        },
      },
    },
  }
}

export function passwordResetIdentifierKey(req: FastifyRequest): string {
  const body = req.body as { identifier?: unknown } | null
  const raw = typeof body?.identifier === 'string' ? body.identifier.trim().toLowerCase() : ''
  return raw.slice(0, 320)
}
