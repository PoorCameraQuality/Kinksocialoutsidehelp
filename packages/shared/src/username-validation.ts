/** Usernames must not look like emails. They are public @handles, not login identifiers. */
export function isEmailLikeUsername(username: string): boolean {
  const trimmed = username.trim()
  if (!trimmed) return false
  if (trimmed.includes('@')) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function usernameEqualsEmail(username: string, email: string): boolean {
  const u = username.trim().toLowerCase()
  const e = email.trim().toLowerCase()
  return u.length > 0 && e.length > 0 && u === e
}

export function validatePublicUsername(username: string, email?: string): string | null {
  const trimmed = username.trim()
  if (isEmailLikeUsername(trimmed)) {
    return 'Username cannot be an email address. Pick a public @handle instead.'
  }
  if (email && usernameEqualsEmail(trimmed, email)) {
    return 'Username must be different from your email address.'
  }
  return null
}
