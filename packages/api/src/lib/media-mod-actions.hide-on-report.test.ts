/**
 * Unit-level contract for post-moderation hide-on-report helper.
 * Full DB coverage lives in scanner/report integration when CI_API_INTEGRATION_DB is on.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hideMediaAssetOnReport, resolveMediaAssetIdFromCase } from './media-mod-actions.js'

describe('media report hide helpers', () => {
  it('exports hideMediaAssetOnReport for createReport wiring', () => {
    assert.equal(typeof hideMediaAssetOnReport, 'function')
  })

  it('resolveMediaAssetIdFromCase returns media_asset ids unchanged', async () => {
    const id = '00000000-0000-4000-8000-000000000099'
    assert.equal(await resolveMediaAssetIdFromCase('media_asset', id), id)
  })
})
