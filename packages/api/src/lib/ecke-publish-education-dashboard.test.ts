import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, it } from 'node:test'
import type { EducationArticlePublishRow } from './ecke-public-publish.js'
import {
  EDUCATION_ECKE_AUTHOR_ONLY_MESSAGE,
  canViewerPublishEducationArticleEcke,
} from './ecke-publish-service.js'
import { getRegistryEntry, listRegistryForOrgDashboard } from './ecke-publish-registry.js'

const AUTHOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function baseArticle(overrides: Partial<EducationArticlePublishRow> = {}): EducationArticlePublishRow {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    slug: 'safety-basics',
    title: 'Safety Basics',
    excerpt: 'Intro',
    bodyHtml: '<p>Public body</p>',
    categories: ['Safety'],
    contentWarnings: [],
    difficulty: null,
    heroImageUrl: null,
    readingMinutes: 5,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    visibility: 'PUBLIC',
    publicationStatus: 'PUBLISHED',
    eckePublish: true,
    authorUserId: AUTHOR_ID,
    organizationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    presenterProfileUserId: null,
    ...overrides,
  }
}

describe('ecke-publish-registry dashboard visibility', () => {
  it('education_article appears on org and group dashboards', () => {
    const entry = getRegistryEntry('education_article')!
    assert.equal(entry.visibleInOrgDashboard, true)
    assert.equal(entry.visibleInGroupDashboard, true)
    assert.ok(listRegistryForOrgDashboard().some((e) => e.sourceKind === 'education_article'))
  })
})

describe('education dashboard publish permissions', () => {
  it('only author can publish', () => {
    const article = baseArticle()
    assert.equal(canViewerPublishEducationArticleEcke(article, AUTHOR_ID), true)
    assert.equal(canViewerPublishEducationArticleEcke(article, OTHER_USER), false)
  })

  it('author-only message is defined for dashboard read-only state', () => {
    assert.match(EDUCATION_ECKE_AUTHOR_ONLY_MESSAGE, /author/i)
    assert.match(EDUCATION_ECKE_AUTHOR_ONLY_MESSAGE, /education writer/i)
  })
})

describe('ecke-publish-control convention dashboard routes', () => {
  it('registers convention-scoped overview and write routes', () => {
    const src = fs.readFileSync(
      new URL('../routes/ecke-publish-control-routes.ts', import.meta.url),
      'utf8',
    )
    assert.match(src, /\/api\/v1\/conventions\/:conventionKey\/ecke-publish/)
    assert.match(src, /getConventionEckePublishOverview/)
  })

  it('org-scoped writes include listing and dungeon kinds', () => {
    const src = fs.readFileSync(
      new URL('../routes/ecke-publish-control-routes.ts', import.meta.url),
      'utf8',
    )
    assert.match(src, /organization_listing/)
    assert.match(src, /dungeon_profile/)
  })
})

describe('ecke-publish-control org dashboard routes', () => {
  it('registers org-scoped ECKE overview and write routes', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../routes/ecke-publish-control-routes.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /getOrgEckePublishOverview/)
    assert.match(src, /\/api\/v1\/organizations\/:orgKey\/ecke-publish/)
    assert.match(src, /education_article/)
    assert.match(src, /vendor_profile/)
  })

  it('group scoped write resolver accepts education_article', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../routes/ecke-publish-control-routes.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /sourceKind === 'education_article'/)
  })

  it('service exposes getOrgEckePublishOverview and org-linked article loaders', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /getOrgEckePublishOverview/)
    assert.match(src, /loadOrgLinkedEducationArticleSummaries/)
    assert.match(src, /resolveArticleEckeAccess/)
  })
})
