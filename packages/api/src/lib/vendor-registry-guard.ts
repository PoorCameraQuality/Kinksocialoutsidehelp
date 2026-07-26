import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let cachedKeys: Set<string> | null = null

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function loadRegistryKeys(): Set<string> {
  if (cachedKeys) return cachedKeys
  const keys = new Set<string>()

  const envRaw = process.env.C2K_REGISTERED_VENDORS ?? ''
  for (const part of envRaw.split(',')) {
    const k = normalizeKey(part)
    if (k) keys.add(k)
  }

  try {
    const registryPath = join(process.cwd(), 'docs/privacy/vendor-registry.md')
    const md = readFileSync(registryPath, 'utf8')
    for (const line of md.split('\n')) {
      if (!line.startsWith('|') || line.includes('---') || line.includes('Vendor |')) continue
      const cells = line.split('|').map((c) => c.trim())
      const vendorCell = cells[1]
      if (!vendorCell || vendorCell.startsWith('_(')) continue
      const k = normalizeKey(vendorCell)
      if (k) keys.add(k)
    }
  } catch {
    /* docs may be absent in minimal CI contexts - env override still works */
  }

  cachedKeys = keys
  return keys
}

export function isVendorRegistered(vendorKey: string): boolean {
  return loadRegistryKeys().has(normalizeKey(vendorKey))
}

export function assertVendorRegistered(vendorKey: string): void {
  if (!isVendorRegistered(vendorKey)) {
    throw new Error(
      `Vendor "${vendorKey}" is not registered. Add to docs/privacy/vendor-registry.md or C2K_REGISTERED_VENDORS.`
    )
  }
}

export function resetVendorRegistryCache(): void {
  cachedKeys = null
}
