import type { FastifyInstance } from 'fastify'
import * as Sentry from '@sentry/node'
import type { ErrorEvent, EventHint } from '@sentry/node'
import { redactObject, redactString, REDACTED } from './log-redact.js'

const SENSITIVE_PATH_PREFIXES = [
  '/api/v1/messages',
  '/api/v1/dm',
  '/api/v1/moderation',
  '/api/v1/admin',
  '/api/v1/owner',
  '/api/auth/',
  '/api/v1/upload',
  '/api/v1/media',
  '/api/v1/profile',
  '/api/v1/me',
  '/api/v1/feed/posts',
  '/api/v1/legal',
  '/api/v1/privacy',
]

const SENSITIVE_BREADCRUMB_KEYS =
  /^(password|token|secret|body|message|content|kink|consent|legal|moderation|dm|upload|cookie|authorization)$/i

function getErrorTrackingDsn(): string | undefined {
  return process.env.ERROR_TRACKING_DSN?.trim() || process.env.SENTRY_DSN?.trim() || undefined
}

export function isErrorTrackingEnabled(): boolean {
  return process.env.ERROR_TRACKING_ENABLED === 'true' && Boolean(getErrorTrackingDsn())
}

function requestPath(url: string | undefined): string {
  if (!url) return ''
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname
    }
  } catch {
    /* fall through */
  }
  return url.split('?')[0] ?? url
}

function isSensitiveUrl(url: string | undefined): boolean {
  const path = requestPath(url)
  return SENSITIVE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    if (event.request.headers) {
      event.request.headers = redactObject(event.request.headers as Record<string, unknown>) as Record<
        string,
        string
      >
    }
    if (isSensitiveUrl(event.request.url)) {
      // Extra scrub already applied via global body/cookie removal above.
    }
  }

  if (event.extra) {
    event.extra = redactObject(event.extra as Record<string, unknown>)
  }
  if (event.contexts) {
    for (const [key, value] of Object.entries(event.contexts)) {
      if (value && typeof value === 'object') {
        event.contexts[key] = redactObject(value as Record<string, unknown>)
      }
    }
  }
  if (typeof event.message === 'string') {
    event.message = redactString(event.message)
  }

  return event
}

function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.category === 'console' && typeof breadcrumb.message === 'string') {
    breadcrumb.message = redactString(breadcrumb.message)
  }
  if (breadcrumb.data) {
    const data = breadcrumb.data as Record<string, unknown>
    for (const key of Object.keys(data)) {
      if (SENSITIVE_BREADCRUMB_KEYS.test(key)) {
        data[key] = REDACTED
      } else if (typeof data[key] === 'string') {
        data[key] = redactString(data[key] as string)
      }
    }
  }
  return breadcrumb
}

export function initErrorTracking(): void {
  if (!isErrorTrackingEnabled()) return

  Sentry.init({
    dsn: getErrorTrackingDsn(),
    environment: process.env.ERROR_TRACKING_ENVIRONMENT?.trim() || process.env.NODE_ENV || 'development',
    release: process.env.RELEASE_VERSION?.trim() || undefined,
    tracesSampleRate: Number(process.env.ERROR_TRACKING_TRACES_SAMPLE_RATE ?? 0),
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
}

export function setupFastifyErrorTracking(app: FastifyInstance): void {
  if (!isErrorTrackingEnabled()) return

  Sentry.setupFastifyErrorHandler(app, {
    shouldHandleError() {
      return true
    },
  })
}

export function captureApiException(error: unknown, context?: Record<string, unknown>): void {
  if (!isErrorTrackingEnabled()) return
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('extra', redactObject(context) as Record<string, unknown>)
    }
    Sentry.captureException(error)
  })
}

export function reportWorkerJobFailure(queueName: string, jobId: string | undefined, err: unknown): void {
  console.error(`[worker] ${queueName} job failed`, jobId, err)
  if (!isErrorTrackingEnabled()) return
  Sentry.withScope((scope) => {
    scope.setTag('queue', queueName)
    if (jobId) scope.setTag('job_id', jobId)
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
  })
}

export function isErrorTrackingTestRouteAllowed(headers: Record<string, unknown>): boolean {
  if (process.env.ERROR_TRACKING_TEST_ENABLED !== 'true') return false
  if (process.env.NODE_ENV !== 'production') return true

  const secret = process.env.ERROR_TRACKING_TEST_SECRET?.trim()
  if (!secret) return false

  const header = headers['x-error-tracking-test-secret']
  return typeof header === 'string' && header === secret
}
