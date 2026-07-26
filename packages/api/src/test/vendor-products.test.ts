/**
 * Vendor curated products CRUD + CSV import.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { registerVendorProductRoutes, VENDOR_PRODUCTS_MAX } from '../routes/vendor-products.js'
import { buildCookieApp, cookieHeader, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('vendor curated products API', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const vendorIds: string[] = []
  const productIds: string[] = []

  let ownerId: string
  let ownerUsername: string
  let otherId: string
  let otherUsername: string
  let vendorId: string

  after(async () => {
    for (const id of productIds) {
      await db.delete(schema.products).where(eq(schema.products.id, id))
    }
    for (const id of vendorIds) {
      await db.delete(schema.products).where(eq(schema.products.vendorId, id))
      await db.delete(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, id))
    }
    for (const userId of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function buildApp() {
    ensureCiAuthSecret()
    process.env.USE_DATABASE = 'true'
    return buildCookieApp(registerVendorProductRoutes)
  }

  test('seed owner + vendor shop', async () => {
    const owner = await insertCiUser(`vp_owner_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    userIds.push(owner.id)

    const other = await insertCiUser(`vp_other_${tag}`)
    otherId = other.id
    otherUsername = other.username
    userIds.push(other.id)

    const [vp] = await db
      .insert(schema.vendorProfiles)
      .values({
        userId: ownerId,
        slug: `vp-shop-${tag}`,
        displayName: `VP Shop ${tag}`,
        category: 'Gear & accessories',
        website: 'https://shop.example.test',
      })
      .returning()
    assert.ok(vp)
    vendorId = vp.id
    vendorIds.push(vp.id)
  })

  test('owner can create, list, patch, delete product with per-item listingUrl', async () => {
    const app = await buildApp()
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/vendors/me/products',
      headers: {
        ...cookieHeader(ownerId, ownerUsername),
        'content-type': 'application/json',
      },
      payload: {
        title: 'Curated rope',
        priceCents: 2500,
        listingUrl: 'https://shop.example.test/rope',
        primaryImageUrl: 'https://cdn.example.test/rope.jpg',
        description: 'Soft jute',
      },
    })
    assert.equal(create.statusCode, 201, create.body)
    const created = create.json() as { product: { id: string; listingUrl: string } }
    assert.equal(created.product.listingUrl, 'https://shop.example.test/rope')
    productIds.push(created.product.id)

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/vendors/me/products',
      headers: cookieHeader(ownerId, ownerUsername),
    })
    assert.equal(list.statusCode, 200)
    const listed = list.json() as { items: Array<{ id: string }> }
    assert.ok(listed.items.some((i) => i.id === created.product.id))

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vendors/me/products/${created.product.id}`,
      headers: {
        ...cookieHeader(ownerId, ownerUsername),
        'content-type': 'application/json',
      },
      payload: { priceCents: 2600 },
    })
    assert.equal(patch.statusCode, 200)
    assert.equal((patch.json() as { product: { priceCents: number } }).product.priceCents, 2600)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/vendors/me/products/${created.product.id}`,
      headers: cookieHeader(ownerId, ownerUsername),
    })
    assert.equal(del.statusCode, 200)
    productIds.pop()
  })

  test('non-owner cannot manage products', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/vendors/me/products',
      headers: {
        ...cookieHeader(otherId, otherUsername),
        'content-type': 'application/json',
      },
      payload: {
        title: 'Nope',
        priceCents: 100,
        listingUrl: 'https://shop.example.test/x',
      },
    })
    assert.ok(r.statusCode === 403 || r.statusCode === 404)
  })

  test('CSV import creates rows and respects cap messaging', async () => {
    const app = await buildApp()
    const csv = `title,price,listing_url,image_url
CSV One,10.00,https://shop.example.test/1,https://cdn.example.test/1.jpg
CSV Two,5,https://shop.example.test/2,`
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/vendors/me/products/import-csv',
      headers: {
        ...cookieHeader(ownerId, ownerUsername),
        'content-type': 'application/json',
      },
      payload: { csv },
    })
    assert.equal(r.statusCode, 200, r.body)
    const body = r.json() as { created: number; skipped: number; max: number }
    assert.equal(body.created, 2)
    assert.equal(body.max, VENDOR_PRODUCTS_MAX)

    const rows = await db.select().from(schema.products).where(eq(schema.products.vendorId, vendorId))
    for (const row of rows) productIds.push(row.id)
    assert.ok(rows.some((p) => p.listingUrl === 'https://shop.example.test/1'))
  })
})
