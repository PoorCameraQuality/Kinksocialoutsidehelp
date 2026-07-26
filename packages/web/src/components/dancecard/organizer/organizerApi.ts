import { supportCopy, toUserFacingErrorMessage } from '@/lib/dancecard/supportCopy'

export class OrganizerApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(messageFromBody(status, body))
    this.status = status
    this.body = body
  }
}

function messageFromBody(status: number, body: string) {
  if (!body) return `HTTP ${status}`
  try {
    const parsed = JSON.parse(body) as { error?: unknown }
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return toUserFacingErrorMessage(parsed.error)
    }
  } catch {
    // Non-JSON errors, like a Next 404 HTML page, are normalized below.
  }
  if (/<!doctype html|<html/i.test(body)) {
    return supportCopy.serviceUnavailable
  }
  return toUserFacingErrorMessage(body.length > 220 ? `${body.slice(0, 220)}...` : body)
}

function base(slug: string) {
  return `/api/v1/conventions/${encodeURIComponent(slug)}`
}

/** v1 API base for download links, uploads, and img src. */
export function organizerConventionApiBase(slug: string): string {
  return base(slug)
}

const getInflight = new Map<string, Promise<unknown>>()
const getCache = new Map<string, { expires: number; data: unknown }>()

function cacheKey(slug: string, path: string) {
  return `GET:${slug.toLowerCase()}:${path}`
}

function cacheTtlMs(path: string): number {
  if (path === '/readiness' || path === '/readiness/summary') return 30_000
  if (path === '/organizer/bootstrap') return 5_000
  if (path === '/tags' || path === '/program-conflicts') return 15_000
  if (path === '/registration-categories') return 15_000
  return 8_000
}

/** Drop cached GET responses after a mutation so lists stay fresh. */
export function invalidateOrganizerDancecardCache(eventSlug: string, pathPrefix?: string) {
  const slug = eventSlug.toLowerCase()
  const needle = pathPrefix
    ? `GET:${slug}:${pathPrefix}`
    : `GET:${slug}:`
  for (const key of Array.from(getCache.keys())) {
    if (key.startsWith(needle)) getCache.delete(key)
  }
  for (const key of Array.from(getInflight.keys())) {
    if (key.startsWith(needle)) getInflight.delete(key)
  }
}

async function organizerDancecardGet<T>(slug: string, path: string): Promise<T> {
  const key = cacheKey(slug, path)
  const now = Date.now()
  const hit = getCache.get(key)
  if (hit && hit.expires > now) return hit.data as T

  const pending = getInflight.get(key)
  if (pending) return (await pending) as T

  const promise = (async () => {
    const headers: HeadersInit = { Accept: 'application/json' }
    const res = await fetch(`${base(slug)}${path}`, { credentials: 'include', headers })
    const text = await res.text()
    if (!res.ok) {
      throw new OrganizerApiError(res.status, text)
    }
    const data = text ? (JSON.parse(text) as T) : (undefined as T)
    getCache.set(key, { expires: Date.now() + cacheTtlMs(path), data })
    return data
  })()

  getInflight.set(key, promise)
  try {
    return (await promise) as T
  } finally {
    getInflight.delete(key)
  }
}

type RegistrantPageResponse<T> = { registrants: T[]; total: number; limit: number; offset: number }

/** Walks paginated GET /registrants until all rows matching filters are loaded. */
export async function fetchAllOrganizerRegistrants<T>(
  slug: string,
  filters: { status?: string; vetting?: string; categoryId?: string; q?: string } = {},
  pageSize = 200,
): Promise<T[]> {
  const out: T[] = []
  let offset = 0
  for (;;) {
    const qs = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
    if (filters.status) qs.set('status', filters.status)
    if (filters.vetting) qs.set('vetting', filters.vetting)
    if (filters.categoryId) qs.set('categoryId', filters.categoryId)
    if (filters.q) qs.set('q', filters.q)
    const res = await organizerDancecardFetch<RegistrantPageResponse<T>>(slug, `/registrants?${qs}`)
    const page = res.registrants ?? []
    out.push(...page)
    const total = res.total ?? out.length
    if (page.length < pageSize || out.length >= total) break
    offset += pageSize
  }
  return out
}

export async function organizerDancecardFetch<T>(slug: string, path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' && !init?.body) {
    return organizerDancecardGet<T>(slug, path)
  }

  if (method !== 'GET') {
    invalidateOrganizerDancecardCache(slug)
  }

  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ?? {}),
  }
  const res = await fetch(`${base(slug)}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new OrganizerApiError(res.status, text)
  }
  if (text) {
    return JSON.parse(text) as T
  }
  return undefined as T
}

/** Multipart upload to a convention-scoped v1 path (e.g. /maps/upload). */
export async function organizerConventionUpload<T>(
  slug: string,
  path: string,
  formData: FormData,
): Promise<T> {
  invalidateOrganizerDancecardCache(slug)
  const res = await fetch(`${base(slug)}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new OrganizerApiError(res.status, text)
  }
  return text ? (JSON.parse(text) as T) : (undefined as T)
}
