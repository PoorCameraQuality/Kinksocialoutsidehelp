import { and, asc, count, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { preprocessVendorWriteBody } from '@c2k/shared'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import {
  requireVendorShopManager,
  resolveManagedVendorForMeRoutes,
  type VendorProfileRow,
} from '../lib/vendor-shop-people.js'

export const VENDOR_PRODUCTS_MAX = 50

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Database not enabled' })
    return false
  }
  return true
}

function vendorIdHintFromRequest(req: FastifyRequest): string | undefined {
  const q = req.query as { vendorId?: string }
  return typeof q.vendorId === 'string' && q.vendorId.trim() ? q.vendorId.trim() : undefined
}

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => {
    try {
      const parsed = new URL(u)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Must be an http(s) URL')

const productBody = z.object({
  title: z.string().trim().min(1).max(255),
  priceCents: z.number().int().min(0).max(100_000_000),
  listingUrl: httpUrl,
  primaryImageUrl: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  description: z.union([z.string().trim().max(2000), z.literal(''), z.null()]).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
})

const productPatchBody = productBody.partial().refine((o) => Object.keys(o).length > 0, {
  message: 'At least one field required',
})

const csvImportBody = z.object({
  csv: z.string().min(1).max(500_000),
})

export type VendorProductDto = {
  id: string
  vendorId: string
  title: string
  priceCents: number
  listingUrl: string
  primaryImageUrl: string | null
  description: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

function toDto(row: typeof schema.products.$inferSelect): VendorProductDto {
  return {
    id: row.id,
    vendorId: row.vendorId,
    title: row.title,
    priceCents: row.priceCents,
    listingUrl: row.listingUrl,
    primaryImageUrl: row.primaryImageUrl ?? null,
    description: row.description ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function resolveVendor(
  req: FastifyRequest,
  reply: FastifyReply,
  vendorProfileId?: string,
): Promise<VendorProfileRow | null> {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    void reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    void reply.status(401).send({ error: 'Valid session required' })
    return null
  }
  if (vendorProfileId) {
    const gate = await requireVendorShopManager(vendorProfileId, userId)
    if (!gate.ok) {
      void reply.status(gate.status).send({ error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' })
      return null
    }
    return gate.vendor
  }
  const gate = await resolveManagedVendorForMeRoutes(userId, vendorIdHintFromRequest(req))
  if (!gate.ok) {
    void reply.status(gate.status).send({ error: gate.error })
    return null
  }
  return gate.vendor
}

/** `asDollars`: treat whole numbers as dollars (for `price` column). Else whole numbers are cents. */
function parsePriceToCents(raw: string, asDollars = false): number | null {
  const t = raw.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!t) return null
  if (/^\d+$/.test(t) && !asDollars) {
    const n = Number.parseInt(t, 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const dollars = Number.parseFloat(t)
  if (!Number.isFinite(dollars) || dollars < 0) return null
  return Math.round(dollars * 100)
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        q = !q
      }
      continue
    }
    if (ch === ',' && !q) {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += ch
  }
  cells.push(cell.trim())
  return cells
}

/** Minimal CSV parser: handles quoted fields and commas. */
export function parseCsvRows(csv: string): { headers: string[]; rows: string[][] } {
  const normalized = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]!
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      cur += ch
      continue
    }
    if (ch === '\n' && !inQuotes) {
      lines.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.length) lines.push(cur)

  const nonEmpty = lines.filter((l) => l.trim().length > 0)
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const headers = splitCsvLine(nonEmpty[0]!).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = nonEmpty.slice(1).map(splitCsvLine)
  return { headers, rows }
}

export function mapCsvRowToProduct(
  headers: string[],
  cells: string[],
): { ok: true; value: z.infer<typeof productBody> } | { ok: false; error: string } {
  const get = (names: string[]): string => {
    for (const n of names) {
      const idx = headers.indexOf(n)
      if (idx >= 0 && cells[idx] != null && String(cells[idx]).trim()) return String(cells[idx]).trim()
    }
    return ''
  }
  const title = get(['title', 'name', 'product'])
  if (!title) return { ok: false, error: 'Missing title' }
  const centsRaw = get(['price_cents', 'pricecents'])
  const dollarsRaw = get(['price'])
  const priceRaw = centsRaw || dollarsRaw
  if (!priceRaw) return { ok: false, error: 'Missing price' }
  const priceCents = parsePriceToCents(priceRaw, Boolean(dollarsRaw) && !centsRaw)
  if (priceCents == null) return { ok: false, error: `Invalid price: ${priceRaw}` }
  const listingUrl = get(['listing_url', 'url', 'link', 'product_url'])
  if (!listingUrl) return { ok: false, error: 'Missing listing_url' }
  const image = get(['image_url', 'image', 'primary_image_url', 'photo'])
  const description = get(['description', 'desc']) || undefined
  const parsed = productBody.safeParse({
    title: title.slice(0, 255),
    priceCents,
    listingUrl,
    primaryImageUrl: image || null,
    description: description?.slice(0, 2000) ?? null,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid row' }
  return { ok: true, value: parsed.data }
}

async function productCountForVendor(vendorId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.products)
    .where(eq(schema.products.vendorId, vendorId))
  return Number(row?.n ?? 0)
}

export async function registerVendorProductRoutes(app: FastifyInstance) {
  const listHandler = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const vendor = await resolveVendor(req, reply, vendorProfileId)
    if (!vendor) return
    const rows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.vendorId, vendor.id))
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.title))
      .limit(VENDOR_PRODUCTS_MAX)
    return reply.send({ items: rows.map(toDto), max: VENDOR_PRODUCTS_MAX })
  }

  const createHandler = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const vendor = await resolveVendor(req, reply, vendorProfileId)
    if (!vendor) return
    const parsed = productBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })

    const existing = await productCountForVendor(vendor.id)
    if (existing >= VENDOR_PRODUCTS_MAX) {
      return reply.status(400).send({
        error: `Catalog limit reached (${VENDOR_PRODUCTS_MAX} products). Remove some or use CSV to replace carefully.`,
      })
    }

    const now = new Date()
    const [row] = await db
      .insert(schema.products)
      .values({
        vendorId: vendor.id,
        title: parsed.data.title,
        priceCents: parsed.data.priceCents,
        listingUrl: parsed.data.listingUrl,
        primaryImageUrl: parsed.data.primaryImageUrl || null,
        description: parsed.data.description || null,
        sortOrder: parsed.data.sortOrder ?? existing,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    return reply.status(201).send({ product: toDto(row) })
  }

  const patchHandler = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const vendor = await resolveVendor(req, reply, vendorProfileId)
    if (!vendor) return
    const { productId } = req.params as { productId: string }
    const parsed = productPatchBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })

    const patch: Partial<typeof schema.products.$inferInsert> = { updatedAt: new Date() }
    if (parsed.data.title !== undefined) patch.title = parsed.data.title
    if (parsed.data.priceCents !== undefined) patch.priceCents = parsed.data.priceCents
    if (parsed.data.listingUrl !== undefined) patch.listingUrl = parsed.data.listingUrl
    if (parsed.data.primaryImageUrl !== undefined) {
      patch.primaryImageUrl = parsed.data.primaryImageUrl || null
    }
    if (parsed.data.description !== undefined) {
      patch.description = parsed.data.description || null
    }
    if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder

    const [row] = await db
      .update(schema.products)
      .set(patch)
      .where(and(eq(schema.products.id, productId), eq(schema.products.vendorId, vendor.id)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Product not found' })
    return reply.send({ product: toDto(row) })
  }

  const deleteHandler = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const vendor = await resolveVendor(req, reply, vendorProfileId)
    if (!vendor) return
    const { productId } = req.params as { productId: string }
    const [row] = await db
      .delete(schema.products)
      .where(and(eq(schema.products.id, productId), eq(schema.products.vendorId, vendor.id)))
      .returning({ id: schema.products.id })
    if (!row) return reply.status(404).send({ error: 'Product not found' })
    return reply.send({ ok: true })
  }

  const csvHandler = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const vendor = await resolveVendor(req, reply, vendorProfileId)
    if (!vendor) return
    const parsed = csvImportBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })

    const { headers, rows } = parseCsvRows(parsed.data.csv)
    if (!headers.length) return reply.status(400).send({ error: 'CSV has no header row' })
    if (!headers.includes('title') && !headers.includes('name') && !headers.includes('product')) {
      return reply.status(400).send({ error: 'CSV must include a title (or name) column' })
    }

    let existing = await productCountForVendor(vendor.id)
    let created = 0
    let skipped = 0
    const errors: Array<{ row: number; error: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2
      const mapped = mapCsvRowToProduct(headers, rows[i])
      if (!mapped.ok) {
        skipped++
        errors.push({ row: rowNum, error: mapped.error })
        continue
      }
      if (existing >= VENDOR_PRODUCTS_MAX) {
        skipped++
        errors.push({ row: rowNum, error: `Catalog limit (${VENDOR_PRODUCTS_MAX}) reached` })
        continue
      }
      const now = new Date()
      await db.insert(schema.products).values({
        vendorId: vendor.id,
        title: mapped.value.title,
        priceCents: mapped.value.priceCents,
        listingUrl: mapped.value.listingUrl,
        primaryImageUrl: mapped.value.primaryImageUrl || null,
        description: mapped.value.description || null,
        sortOrder: existing,
        createdAt: now,
        updatedAt: now,
      })
      existing++
      created++
    }

    return reply.send({ created, skipped, errors: errors.slice(0, 40), max: VENDOR_PRODUCTS_MAX })
  }

  app.get('/api/v1/vendors/me/products', (req, reply) => listHandler(req, reply))
  app.post('/api/v1/vendors/me/products', (req, reply) => createHandler(req, reply))
  app.patch('/api/v1/vendors/me/products/:productId', (req, reply) => patchHandler(req, reply))
  app.delete('/api/v1/vendors/me/products/:productId', (req, reply) => deleteHandler(req, reply))
  app.post('/api/v1/vendors/me/products/import-csv', (req, reply) => csvHandler(req, reply))

  app.get('/api/v1/vendors/:vendorId/products', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return listHandler(req, reply, vendorId)
  })
  app.post('/api/v1/vendors/:vendorId/products', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return createHandler(req, reply, vendorId)
  })
  app.patch('/api/v1/vendors/:vendorId/products/:productId', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return patchHandler(req, reply, vendorId)
  })
  app.delete('/api/v1/vendors/:vendorId/products/:productId', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return deleteHandler(req, reply, vendorId)
  })
  app.post('/api/v1/vendors/:vendorId/products/import-csv', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return csvHandler(req, reply, vendorId)
  })
}
