import { isProductionRuntime } from './production-guard.js'
import { mailTransportMode } from './mailer.js'

const DEV_SMTP_HOSTS = new Set(['127.0.0.1', 'localhost', 'mailpit', 'host.docker.internal'])

export function isPasswordResetEnabled(): boolean {
  return process.env.C2K_PASSWORD_RESET_ENABLED !== 'false'
}

export function smtpConfigSummary(): {
  mode: 'disabled' | 'smtp' | 'resend'
  host?: string
  port?: number
  from?: string
  secure?: boolean
  hasUser: boolean
  hasPass: boolean
} {
  const mode = mailTransportMode()
  return {
    mode,
    host: process.env.SMTP_HOST?.trim(),
    port: Number(process.env.SMTP_PORT ?? 587),
    from: process.env.C2K_MAIL_FROM?.trim(),
    secure: process.env.SMTP_SECURE === 'true',
    hasUser: Boolean(process.env.SMTP_USER?.trim()),
    hasPass: Boolean(process.env.SMTP_PASS?.length),
  }
}

export function assertMailConfiguredForPasswordReset(
  log: Pick<Console, 'info' | 'error'> = console,
): void {
  if (!isPasswordResetEnabled()) {
    log.info('Password reset disabled (C2K_PASSWORD_RESET_ENABLED=false).')
    return
  }

  const mode = mailTransportMode()
  const publicUrl = process.env.C2K_PUBLIC_WEB_URL?.trim()

  if (!publicUrl) {
    log.error('Fatal: C2K_PUBLIC_WEB_URL is required when password reset is enabled.')
    process.exit(1)
  }

  if (mode === 'disabled') {
    if (isProductionRuntime()) {
      log.error(
        'Fatal: password reset requires C2K_MAIL_TRANSPORT=smtp or resend in production.',
      )
      process.exit(1)
    }
    log.info('Password reset enabled; mail transport disabled (dev. Use Mailpit with SMTP).')
    return
  }

  if (mode === 'resend') {
    if (!process.env.RESEND_API_KEY?.trim()) {
      log.error('Fatal: RESEND_API_KEY is required when C2K_MAIL_TRANSPORT=resend.')
      process.exit(1)
    }
    if (!process.env.C2K_MAIL_FROM?.trim()) {
      log.error('Fatal: C2K_MAIL_FROM is required when mail is enabled.')
      process.exit(1)
    }
    return
  }

  const host = process.env.SMTP_HOST?.trim()
  if (!host) {
    log.error('Fatal: SMTP_HOST is required when C2K_MAIL_TRANSPORT=smtp.')
    process.exit(1)
  }

  if (isProductionRuntime() && DEV_SMTP_HOSTS.has(host.toLowerCase())) {
    const allowDev = process.env.C2K_ALLOW_DEV_SMTP_IN_PRODUCTION === 'true'
    if (!allowDev) {
      log.error(
        `Fatal: SMTP_HOST "${host}" looks like a dev/Mailpit host. Use production SMTP or set C2K_ALLOW_DEV_SMTP_IN_PRODUCTION=true (not recommended).`,
      )
      process.exit(1)
    }
    log.info('WARNING: dev SMTP host allowed in production via C2K_ALLOW_DEV_SMTP_IN_PRODUCTION.')
  }

  if (!process.env.C2K_MAIL_FROM?.trim()) {
    log.error('Fatal: C2K_MAIL_FROM is required when SMTP is enabled.')
    process.exit(1)
  }

  log.info(`Mail configured for password reset (transport=${mode}, host=${host}).`)
}

/** Non-destructive diagnostic - does not send mail. */
export function mailConfigDiagnostic(): {
  ok: boolean
  passwordResetEnabled: boolean
  transport: string
  publicWebUrl: boolean
  issues: string[]
} {
  const issues: string[] = []
  const transport = mailTransportMode()
  const publicWebUrl = Boolean(process.env.C2K_PUBLIC_WEB_URL?.trim())

  if (!publicWebUrl) issues.push('C2K_PUBLIC_WEB_URL missing')
  if (isPasswordResetEnabled()) {
    if (transport === 'disabled') issues.push('mail transport disabled')
    if (transport === 'smtp' && !process.env.SMTP_HOST?.trim()) issues.push('SMTP_HOST missing')
    if (transport === 'resend' && !process.env.RESEND_API_KEY?.trim()) issues.push('RESEND_API_KEY missing')
    if (!process.env.C2K_MAIL_FROM?.trim()) issues.push('C2K_MAIL_FROM missing')
  }

  return {
    ok: issues.length === 0,
    passwordResetEnabled: isPasswordResetEnabled(),
    transport,
    publicWebUrl,
    issues,
  }
}
