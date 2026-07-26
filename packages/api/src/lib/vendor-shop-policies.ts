import { z } from 'zod'

export const vendorShopPoliciesSchema = z
  .object({
    returns: z.string().max(2000).optional().nullable(),
    customOrders: z.string().max(2000).optional().nullable(),
    leadTime: z.string().max(1000).optional().nullable(),
    shippingNotes: z.string().max(2000).optional().nullable(),
  })
  .partial()

export type VendorShopPolicies = z.infer<typeof vendorShopPoliciesSchema>

export function normalizeShopPolicies(raw: unknown): VendorShopPolicies | null {
  if (raw === null || raw === undefined) return null
  const parsed = vendorShopPoliciesSchema.safeParse(raw)
  if (!parsed.success) return null
  const out: VendorShopPolicies = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === 'string' && v.trim()) {
      ;(out as Record<string, string>)[k] = v.trim()
    }
  }
  return Object.keys(out).length > 0 ? out : null
}
