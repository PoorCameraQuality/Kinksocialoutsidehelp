import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapEckeEventToImport, slugifyEckeOrganizer } from './ecke-import-map.js'

const FUSION: Parameters<typeof mapEckeEventToImport>[0] = {
  name: 'Dark Odyssey Fusion',
  slug: 'dark-odyssey-fusion',
  date: { start: '2026-06-23', end: '2026-06-29', display: 'Jun 23-29, 2026' },
  location: { city: 'Darlington', state: 'MD', region: 'North Eastern, Maryland' },
  category: 'Outdoor Event',
  excerpt: 'Fusion weekend.',
  longDescription: 'Long fusion copy.',
  website: 'https://darkodyssey.com/fusion/',
  organizer: 'Dark Odyssey',
  venue: '200+ acre private retreat, Northern Maryland',
  logo: '/images/darkodyssey.png',
  features: ['Fusion of Sex, Kink, and Spirit', 'Pool Parties'],
}

describe('slugifyEckeOrganizer', () => {
  it('slugifies organizer names', () => {
    assert.equal(slugifyEckeOrganizer('Dark Odyssey'), 'dark-odyssey')
  })
})

describe('mapEckeEventToImport', () => {
  it('maps Dark Odyssey Fusion to org + convention with pinned ECKE slug', () => {
    const plan = mapEckeEventToImport(FUSION)
    assert.equal(plan.org.slug, 'dark-odyssey')
    assert.equal(plan.org.displayName, 'Dark Odyssey')
    assert.equal(plan.convention.slug, 'dark-odyssey-fusion')
    assert.equal(plan.eckeEventSlug, 'dark-odyssey-fusion')
    assert.equal(plan.convention.settings.eckeListingSlug, 'dark-odyssey-fusion')
    assert.equal(plan.convention.settings.dancecardSlug, 'dark-odyssey-fusion')
    assert.equal(plan.convention.settings.eckeListing?.venueName, FUSION.venue)
    assert.equal(plan.convention.settings.eckeListing?.websiteUrl, FUSION.website)
    assert.deepEqual(plan.convention.settings.eckeListing?.highlights, FUSION.features)
    assert.equal(plan.anchorEvent.publicLocationSummary?.includes('Darlington'), true)
    assert.equal(plan.anchorEvent.imageWebPath, '/images/darkodyssey.png')
    assert.equal(plan.org.logoWebPath, '/images/darkodyssey.png')
  })

  it('falls back to event name when organizer is missing', () => {
    const plan = mapEckeEventToImport({ ...FUSION, organizer: undefined })
    assert.equal(plan.org.displayName, 'Dark Odyssey Fusion')
    assert.ok(plan.org.slug.length >= 2)
  })
})
