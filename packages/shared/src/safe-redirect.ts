/**
 * Prevent open redirects: only same-origin relative paths are allowed.
 */
export function safeInternalPath(path: string | undefined | null): string | undefined {
  if (path == null || path === '') return undefined
  const p = path.trim()
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('\\')) return undefined
  return p
}
