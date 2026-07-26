/** True when a Drizzle/pg error indicates Postgres is unreachable or timed out. */
export function isDbConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string; cause?: unknown }
  const code = e.code ?? (e.cause as { code?: string } | undefined)?.code
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') return true
  if (code === '57P01' || code === '53300') return true // admin_shutdown, too_many_connections
  const msg = String(e.message ?? err).toLowerCase()
  return (
    msg.includes('connect') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('database unreachable') ||
    msg.includes('connection terminated')
  )
}

export function dbUnavailablePayload() {
  return { error: 'Database unavailable', code: 'db_unavailable' as const }
}
