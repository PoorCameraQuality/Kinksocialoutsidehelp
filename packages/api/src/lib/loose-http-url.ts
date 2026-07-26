import { z } from 'zod'

/** Accept `example.com`, `www.example.com`, or full `https://…` URLs. */
export function normalizeHttpUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

export const zLooseHttpUrl = z.string().min(1).max(2000).transform((val, ctx) => {
  const normalized = normalizeHttpUrl(val)
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid URL (e.g. https://example.com or example.com)',
    })
    return z.NEVER
  }
  return normalized
})

export const zLooseHttpUrlNullable = z
  .union([z.string().max(2000), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined) return null
    const trimmed = val.trim()
    if (!trimmed) return null
    return normalizeHttpUrl(trimmed)
  })
