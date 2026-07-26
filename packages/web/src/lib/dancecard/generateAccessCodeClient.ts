const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Browser-safe comp / gate code (no 0/O/1/I). */
export function generateAccessCodeClient(length = 8): string {
  const n = Math.min(Math.max(length, 6), 24)
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ACCESS_CODE_ALPHABET[b % ACCESS_CODE_ALPHABET.length]).join('')
}
