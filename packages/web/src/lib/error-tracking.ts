import * as Sentry from '@sentry/react'
import type { ErrorEvent, EventHint } from '@sentry/react'

const REDACTED = '[REDACTED]'

const SENSITIVE_KEY_RE =
  /^(password|token|secret|authorization|cookie|body|message|content|kink|consent|legal|moderation|dm|upload|session)$/i

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /c2k_session=/i,
]

function getErrorTrackingDsn(): string | undefined {
  const dsn =
    (import.meta.env.VITE_ERROR_TRACKING_DSN as string | undefined)?.trim() ||
    (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim()
  return dsn || undefined
}

export function isErrorTrackingEnabled(): boolean {
  return import.meta.env.VITE_ERROR_TRACKING_ENABLED === 'true' && Boolean(getErrorTrackingDsn())
}

function redactString(value: string): string {
  let out = value
  out = out.replace(/([?&]token=)[^&\s]+/gi, `$1${REDACTED}`)
  for (const re of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(re, REDACTED)
  }
  return out
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = REDACTED
    } else if (typeof value === 'string') {
      out[key] = redactString(value)
    } else {
      out[key] = value
    }
  }
  return out
}

function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  delete event.request?.cookies
  delete event.request?.data
  if (event.request?.headers) {
    event.request.headers = redactObject(event.request.headers as Record<string, unknown>) as Record<
      string,
      string
    >
  }
  if (event.extra) {
    event.extra = redactObject(event.extra as Record<string, unknown>)
  }
  if (typeof event.message === 'string') {
    event.message = redactString(event.message)
  }
  return event
}

export function initErrorTracking(): void {
  if (!isErrorTrackingEnabled()) return

  Sentry.init({
    dsn: getErrorTrackingDsn(),
    environment:
      (import.meta.env.VITE_ERROR_TRACKING_ENVIRONMENT as string | undefined)?.trim() ||
      import.meta.env.MODE,
    release: (import.meta.env.VITE_RELEASE_VERSION as string | undefined)?.trim() || undefined,
    tracesSampleRate: Number(import.meta.env.VITE_ERROR_TRACKING_TRACES_SAMPLE_RATE ?? 0),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: scrubSentryEvent,
  })
}

export function captureClientException(error: unknown, context?: Record<string, unknown>): void {
  if (!isErrorTrackingEnabled()) return
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('extra', redactObject(context))
    }
    Sentry.captureException(error)
  })
}

export { Sentry }
