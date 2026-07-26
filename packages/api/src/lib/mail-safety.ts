/** Email header injection guards and address validation for outbound mail. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Reject CRLF and other header-breaking characters in display fields. */
export function stripHeaderInjection(value: string, maxLen = 320): string {
  return value
    .replace(/[\r\n\0]/g, '')
    .replace(/[^\t\x20-\x7e]/g, '')
    .trim()
    .slice(0, maxLen)
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = stripHeaderInjection(email, 320)
  if (!trimmed || trimmed.length > 320) return false
  return EMAIL_RE.test(trimmed)
}

/** Returns normalized email or null if invalid / unsafe. */
export function validateReplyToEmail(email: string | undefined | null): string | null {
  if (!email) return null
  const trimmed = stripHeaderInjection(email, 320)
  if (!isValidEmailAddress(trimmed)) return null
  return trimmed.toLowerCase()
}

export function sanitizeEmailSubject(subject: string): string {
  return stripHeaderInjection(subject, 255)
}

export function sanitizeDisplayName(name: string): string {
  return stripHeaderInjection(name, 255)
}
