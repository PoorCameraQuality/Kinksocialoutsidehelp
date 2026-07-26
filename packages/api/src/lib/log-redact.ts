const SENSITIVE_KEY_RE =
  /^(password|token|secret|authorization|cookie|smtp|api[_-]?key|session|invite|reset|credential|private[_-]?key)$/i

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /c2k_session=/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /reset-password\?token=/i,
  /password-reset\?token=/i,
  /smtp[_-]?pass/i,
]

export const REDACTED = '[REDACTED]'

export function redactString(value: string): string {
  let out = value
  out = out.replace(/([?&]token=)[^&\s]+/gi, `$1${REDACTED}`)
  for (const re of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(re, REDACTED)
  }
  return out
}

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_RE.test(key)) return REDACTED
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map((v) => redactUnknown(v))
  if (value && typeof value === 'object') return redactObject(value as Record<string, unknown>)
  return value
}

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    out[key] = redactValue(key, value)
  }
  return out
}

export function redactUnknown(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map(redactUnknown)
  if (typeof value === 'object') return redactObject(value as Record<string, unknown>)
  return value
}

/** Pino redact paths for Fastify logger configuration. */
export const PINO_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  'req.body.inviteCode',
  'req.body.newPassword',
  'req.body.identifier',
  'res.headers["set-cookie"]',
  'err.config.headers.Authorization',
  'smtpPass',
  'SMTP_PASS',
  'password',
  'token',
  'secret',
  'rawToken',
  'tokenHash',
]
