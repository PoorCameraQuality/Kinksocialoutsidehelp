import { z } from 'zod'

function isSafeRootRelativeUrl(s: string): boolean {
  if (!s.startsWith('/')) return false
  if (s.startsWith('//')) return false
  return /^\/[\w./?=&%-]+$/i.test(s)
}

function isHttpOrHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Absolute http(s) URL or same-origin path (e.g. `/api/public-seed/paf/banner.png`). */
export const zHttpOrRootMediaUrl = z
  .string()
  .max(2048)
  .refine((s) => isSafeRootRelativeUrl(s) || isHttpOrHttpsUrl(s), {
    message: 'Must be http(s) URL or root-relative path',
  })

export const zHttpOrRootMediaUrlNullable = zHttpOrRootMediaUrl.nullable()
