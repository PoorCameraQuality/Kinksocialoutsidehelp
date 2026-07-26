import { describe, expect, it } from 'vitest'
import { mapEckeDungeonToImport, type EckeImportSourceDungeon } from './ecke-dungeon-import-map.js'

const baltimorePlayhouse: EckeImportSourceDungeon = {
  name: 'Baltimore Playhouse',
  slug: 'baltimore-playhouse',
  location: {
    city: 'Baltimore',
    state: 'MD',
    address: '3010 Washington Blvd., Baltimore, MD 21230',
  },
  category: 'BDSM Dungeon',
  excerpt: 'Charm City premier kink destination since 1997.',
  description: { long: 'Welcome to Baltimore Playhouse\nA 501(c)7 Non-Profit Social Club' },
  website: 'https://baltimoreplayhouse.com/',
  logo: '/images/BPH.PNG',
  contact: { email: 'info@baltimoreplayhouse.com' },
}

describe('mapEckeDungeonToImport', () => {
  it('maps Baltimore Playhouse to org + venue place with pinned slug', () => {
    const plan = mapEckeDungeonToImport(baltimorePlayhouse)
    expect(plan.org.slug).toBe('baltimore-playhouse')
    expect(plan.org.displayName).toBe('Baltimore Playhouse')
    expect(plan.org.externalSiteUrl).toBe('https://baltimoreplayhouse.com/')
    expect(plan.place.category).toBe('dungeon_club')
    expect(plan.place.city).toBe('Baltimore')
    expect(plan.place.region).toBe('MD')
    expect(plan.featureFlags.listingKind).toBe('venue')
    expect(plan.featureFlags.eckeDungeonListing).toBe(true)
    expect(plan.eckeDungeonSlug).toBe('baltimore-playhouse')
  })
})
