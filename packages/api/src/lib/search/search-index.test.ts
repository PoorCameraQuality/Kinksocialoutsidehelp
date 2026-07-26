import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildEducationArticleSearchDocument,
  shouldIndexEducationArticle,
} from './education/education-index-rules.js'
import { isIndexQueryActive, isIndexRolloutEnabled } from './index-registry.js'

describe('education index privacy rules', () => {
  const base = {
    id: 'a1',
    slug: 'test',
    title: 'Safe title',
    excerpt: 'Excerpt',
    categories: ['Safety'],
    difficulty: 'Beginner',
    visibility: 'PUBLIC',
    listInEducation: true,
    publicationStatus: 'PUBLISHED',
    publishedAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  }

  test('indexes public published hub articles only', () => {
    assert.equal(shouldIndexEducationArticle(base), true)
    const doc = buildEducationArticleSearchDocument(base)
    assert.ok(doc)
    assert.equal(doc!.entity_id, 'a1')
    assert.equal(doc!.visibility, 'PUBLIC')
  })

  test('rejects CONNECTIONS visibility', () => {
    assert.equal(shouldIndexEducationArticle({ ...base, visibility: 'CONNECTIONS' }), false)
  })

  test('rejects MEMBERS visibility', () => {
    assert.equal(shouldIndexEducationArticle({ ...base, visibility: 'MEMBERS' }), false)
  })

  test('rejects draft and non-hub articles', () => {
    assert.equal(shouldIndexEducationArticle({ ...base, publicationStatus: 'DRAFT' }), false)
    assert.equal(shouldIndexEducationArticle({ ...base, listInEducation: false }), false)
  })
})

describe('index registry rollout', () => {
  test('only education_articles is rollout-enabled in Pass 2B', () => {
    assert.equal(isIndexRolloutEnabled('education_articles'), true)
    assert.equal(isIndexRolloutEnabled('people_discoverable'), false)
    assert.equal(isIndexRolloutEnabled('events_public'), false)
  })

  test('query inactive without env flags', () => {
    const prev = {
      SEARCH_PROVIDER: process.env.SEARCH_PROVIDER,
      SEARCH_QUERY_ENABLED: process.env.SEARCH_QUERY_ENABLED,
      SEARCH_HOST: process.env.SEARCH_HOST,
    }
    delete process.env.SEARCH_PROVIDER
    delete process.env.SEARCH_QUERY_ENABLED
    delete process.env.SEARCH_HOST
    try {
      assert.equal(isIndexQueryActive('education_articles'), false)
    } finally {
      process.env.SEARCH_PROVIDER = prev.SEARCH_PROVIDER
      process.env.SEARCH_QUERY_ENABLED = prev.SEARCH_QUERY_ENABLED
      process.env.SEARCH_HOST = prev.SEARCH_HOST
    }
  })
})
