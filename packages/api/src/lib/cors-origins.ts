/** Parse `CORS_ORIGIN` (comma-separated). Empty entries are dropped. */
export function corsOriginsFromEnv(): string[] {
  const fromEnv = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean)
  if (fromEnv?.length) return fromEnv
  return ['http://localhost:5173', 'http://127.0.0.1:5173']
}
