import {
  normalizeVendorCategories,
  normalizeVendorCategory,
  normalizeVendorTags,
  vendorCategorySchema,
  VENDOR_CATEGORY_SELECT_MAX,
  VENDOR_TAG_MAX,
} from './vendor-categories.js'
import { normalizeVendorWebsite } from './vendor-website.js'
import { z } from 'zod'

const URL_FIELD_KEYS = ['website', 'storeUrl', 'siteUrl', 'shopUrl'] as const

function preprocessUrlField(key: (typeof URL_FIELD_KEYS)[number], raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return key === 'shopUrl' ? null : ''
  }
  const normalized = normalizeVendorWebsite(trimmed)
  if (normalized) return normalized
  // Etsy shopUrl may be a shop name. Keep the trimmed value for later resolution.
  if (key === 'shopUrl') return trimmed
  return null
}

/** Normalize vendor write payloads before zod parse (website, categories, tags, store URLs). */
export function preprocessVendorWriteBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const src = body as Record<string, unknown>
  const out: Record<string, unknown> = { ...src }

  for (const key of URL_FIELD_KEYS) {
    if (!(key in out)) continue
    const val = out[key]
    if (val === null || val === undefined) continue
    if (typeof val !== 'string') continue
    out[key] = preprocessUrlField(key, val)
  }

  if ('category' in out && typeof out.category === 'string') {
    out.category = normalizeVendorCategory(out.category) ?? undefined
  }

  if ('categories' in out && Array.isArray(out.categories)) {
    out.categories = normalizeVendorCategories(out.categories.map(String))
  }

  if ('tags' in out && Array.isArray(out.tags)) {
    out.tags = normalizeVendorTags(out.tags.map(String))
  }

  return out
}

export const zVendorCategoryOptional = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return val
    if (typeof val !== 'string') return val
    return normalizeVendorCategory(val) ?? undefined
  },
  vendorCategorySchema.optional().nullable(),
)

export const zVendorCategoriesOptional = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return val
    if (!Array.isArray(val)) return val
    return normalizeVendorCategories(val.map(String))
  },
  z.array(vendorCategorySchema).max(VENDOR_CATEGORY_SELECT_MAX).optional(),
)

export const zVendorTagsOptional = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return val
    if (!Array.isArray(val)) return val
    return normalizeVendorTags(val.map(String))
  },
  z.array(z.string().min(1).max(64)).max(VENDOR_TAG_MAX).optional().nullable(),
)

export const zVendorTagsRequired = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return val
    return normalizeVendorTags(val.map(String))
  },
  z.array(z.string().min(1).max(64)).max(VENDOR_TAG_MAX).optional(),
)
