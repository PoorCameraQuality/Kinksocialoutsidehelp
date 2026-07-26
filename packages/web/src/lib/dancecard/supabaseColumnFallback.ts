/** Detect Postgres "undefined column" errors from Supabase. */
export function isMissingColumn(error: unknown, column?: string): boolean {
  const e = error as { code?: string; message?: string }
  const msg = e?.message ?? ''
  if (e?.code === '42703' || /column .+ does not exist/i.test(msg)) {
    if (!column) return true
    return new RegExp(`\\b${column}\\b`, 'i').test(msg)
  }
  return false
}

export function isMissingTable(error: unknown, tableFragment: string): boolean {
  const e = error as { code?: string; message?: string }
  return e?.code === '42P01' || new RegExp(tableFragment, 'i').test(e?.message ?? '')
}
