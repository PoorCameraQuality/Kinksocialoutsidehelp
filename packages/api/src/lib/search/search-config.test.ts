import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { readSearchConfig } from './config.js'
import { resetTypesenseClientsForTests } from './typesense-client.js'

describe('readSearchConfig', () => {
  test('defaults to database provider with flags off', () => {
    const prev = {
      SEARCH_PROVIDER: process.env.SEARCH_PROVIDER,
      SEARCH_INDEXING_ENABLED: process.env.SEARCH_INDEXING_ENABLED,
      SEARCH_QUERY_ENABLED: process.env.SEARCH_QUERY_ENABLED,
      SEARCH_HOST: process.env.SEARCH_HOST,
    }
    delete process.env.SEARCH_PROVIDER
    delete process.env.SEARCH_INDEXING_ENABLED
    delete process.env.SEARCH_QUERY_ENABLED
    delete process.env.SEARCH_HOST
    resetTypesenseClientsForTests()
    try {
      const cfg = readSearchConfig()
      assert.equal(cfg.provider, 'database')
      assert.equal(cfg.indexingEnabled, false)
      assert.equal(cfg.queryEnabled, false)
    } finally {
      process.env.SEARCH_PROVIDER = prev.SEARCH_PROVIDER
      process.env.SEARCH_INDEXING_ENABLED = prev.SEARCH_INDEXING_ENABLED
      process.env.SEARCH_QUERY_ENABLED = prev.SEARCH_QUERY_ENABLED
      process.env.SEARCH_HOST = prev.SEARCH_HOST
      resetTypesenseClientsForTests()
    }
  })

  test('typesense flags require host and explicit enable', () => {
    const prev = {
      SEARCH_PROVIDER: process.env.SEARCH_PROVIDER,
      SEARCH_INDEXING_ENABLED: process.env.SEARCH_INDEXING_ENABLED,
      SEARCH_QUERY_ENABLED: process.env.SEARCH_QUERY_ENABLED,
      SEARCH_HOST: process.env.SEARCH_HOST,
    }
    process.env.SEARCH_PROVIDER = 'typesense'
    process.env.SEARCH_HOST = 'http://127.0.0.1:8108'
    process.env.SEARCH_INDEXING_ENABLED = 'true'
    process.env.SEARCH_QUERY_ENABLED = 'true'
    resetTypesenseClientsForTests()
    try {
      const cfg = readSearchConfig()
      assert.equal(cfg.provider, 'typesense')
      assert.equal(cfg.indexingEnabled, true)
      assert.equal(cfg.queryEnabled, true)
    } finally {
      process.env.SEARCH_PROVIDER = prev.SEARCH_PROVIDER
      process.env.SEARCH_INDEXING_ENABLED = prev.SEARCH_INDEXING_ENABLED
      process.env.SEARCH_QUERY_ENABLED = prev.SEARCH_QUERY_ENABLED
      process.env.SEARCH_HOST = prev.SEARCH_HOST
      resetTypesenseClientsForTests()
    }
  })
})
