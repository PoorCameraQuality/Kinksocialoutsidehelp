import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { mapCsvRowToProduct, parseCsvRows } from './vendor-products.js'

describe('vendor products CSV helpers', () => {
  test('parseCsvRows handles headers and quoted commas', () => {
    const csv = `title,price,listing_url,image_url
"Rope, soft",12.50,https://shop.example/a,https://cdn.example/a.jpg
Shears,899,https://shop.example/b,`
    const { headers, rows } = parseCsvRows(csv)
    assert.deepEqual(headers, ['title', 'price', 'listing_url', 'image_url'])
    assert.equal(rows.length, 2)
    assert.equal(rows[0][0], 'Rope, soft')
    assert.equal(rows[0][1], '12.50')
  })

  test('mapCsvRowToProduct accepts dollar price and price_cents', () => {
    const headers = ['title', 'price', 'listing_url']
    const dollars = mapCsvRowToProduct(headers, ['Item', '19.99', 'https://shop.example/x'])
    assert.equal(dollars.ok, true)
    if (dollars.ok) assert.equal(dollars.value.priceCents, 1999)

    const centsHeaders = ['title', 'price_cents', 'listing_url']
    const cents = mapCsvRowToProduct(centsHeaders, ['Item', '1999', 'https://shop.example/x'])
    assert.equal(cents.ok, true)
    if (cents.ok) assert.equal(cents.value.priceCents, 1999)
  })

  test('mapCsvRowToProduct rejects missing listing_url', () => {
    const r = mapCsvRowToProduct(['title', 'price'], ['Item', '10'])
    assert.equal(r.ok, false)
  })
})
