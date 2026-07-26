/** Build vendor management API paths (owner `/me` or scoped by shop id for runners). */
export function vendorExternalStorePath(vendorProfileId?: string | null): string {
  return vendorProfileId ?
      `/api/v1/vendors/${encodeURIComponent(vendorProfileId)}/external-store`
    : '/api/v1/vendors/me/external-store'
}

export function vendorExternalSyncPath(vendorProfileId?: string | null): string {
  return vendorProfileId ?
      `/api/v1/vendors/${encodeURIComponent(vendorProfileId)}/external-store/sync`
    : '/api/v1/vendors/me/external-store/sync'
}

export function vendorEtsyPath(vendorProfileId?: string | null): string {
  return vendorProfileId ?
      `/api/v1/vendors/${encodeURIComponent(vendorProfileId)}/etsy`
    : '/api/v1/vendors/me/etsy'
}

export function vendorProductsPath(vendorProfileId?: string | null): string {
  return vendorProfileId ?
      `/api/v1/vendors/${encodeURIComponent(vendorProfileId)}/products`
    : '/api/v1/vendors/me/products'
}

export function vendorProductPath(productId: string, vendorProfileId?: string | null): string {
  return vendorProfileId ?
      `/api/v1/vendors/${encodeURIComponent(vendorProfileId)}/products/${encodeURIComponent(productId)}`
    : `/api/v1/vendors/me/products/${encodeURIComponent(productId)}`
}

export function vendorProductsCsvPath(vendorProfileId?: string | null): string {
  return vendorProfileId ?
      `/api/v1/vendors/${encodeURIComponent(vendorProfileId)}/products/import-csv`
    : '/api/v1/vendors/me/products/import-csv'
}

export function vendorAppearancePatchPath(vendorProfileId?: string | null): string {
  return vendorProfileId ?
      `/api/v1/vendors/${encodeURIComponent(vendorProfileId)}`
    : '/api/v1/vendors/me'
}

export function etsyInstallPath(vendorProfileId?: string | null): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
  const q = new URLSearchParams()
  if (vendorProfileId) q.set('vendorId', vendorProfileId)
  const qs = q.toString()
  return `${base}/api/v1/integrations/etsy/install${qs ? `?${qs}` : ''}`
}

export function shopifyInstallPath(shop: string, vendorProfileId?: string | null): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
  const q = new URLSearchParams({ shop })
  if (vendorProfileId) q.set('vendorId', vendorProfileId)
  return `${base}/api/v1/integrations/shopify/install?${q.toString()}`
}
