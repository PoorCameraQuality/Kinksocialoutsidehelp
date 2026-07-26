import { timingSafeEqual } from 'node:crypto'

/** Constant-time string compare for shared access codes (UTF-8). */
export function codesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a ?? ''), 'utf8')
  const bb = Buffer.from(String(b ?? ''), 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
