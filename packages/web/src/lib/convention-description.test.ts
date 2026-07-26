import { describe, expect, it } from 'vitest'
import {
  buildOfficialLinks,
  normalizeUrlKey,
  stripStandaloneUrls,
  truncateHeroSummary,
} from './convention-description'

describe('convention-description', () => {
  it('truncates long hero summaries without dumping the full description', () => {
    const long =
      'A three-day hotel takeover featuring classes, special events, vendors, and community experiences. ' +
      'Come join us for an unforgettable weekend of connection, education, and play across multiple hotel floors and event spaces. ' +
      'More details and links follow below for registration and socials.'
    const summary = truncateHeroSummary(long, 220)
    expect(summary.length).toBeLessThanOrEqual(221)
    expect(summary.endsWith('…')).toBe(true)
  })

  it('extracts and labels official links from description URLs', () => {
    const links = buildOfficialLinks({
      websiteUrl: 'https://official.example/',
      description: `
        https://example.com/frostland
        https://fetlife.com/events/123
        https://discord.gg/abc
        https://bsky.app/profile/frost.bsky.social
      `,
      ticketingUrl: 'https://tickets.example.com/register',
    })
    expect(links.find((l) => l.label === 'Official website')?.href).toBe('https://official.example/')
    expect(links.filter((l) => l.label === 'Official website')).toHaveLength(1)
    expect(links.some((l) => l.kind === 'fetlife' && l.label.includes('FetLife'))).toBe(true)
    expect(links.some((l) => l.kind === 'discord')).toBe(true)
    expect(links.some((l) => l.kind === 'bluesky')).toBe(true)
    expect(links[0]?.kind).toBe('registration')
  })

  it('dedupes website URLs that differ only by trailing slash or www', () => {
    const links = buildOfficialLinks({
      websiteUrl: 'https://www.official.example/',
      description: 'https://official.example',
    })
    expect(links.filter((l) => l.kind === 'website')).toHaveLength(1)
    expect(normalizeUrlKey('https://www.official.example/')).toBe(normalizeUrlKey('https://official.example'))
  })

  it('strips standalone URL lines and orphaned link labels from body copy', () => {
    const cleaned = stripStandaloneUrls(`A hotel takeover weekend.

Our Website:
https://example.com

Our Fetlife Group:
https://fetlife.com/groups/1

Our Discord:
https://discord.gg/x

See you there.`)
    expect(cleaned).toContain('hotel takeover')
    expect(cleaned).toContain('See you there')
    expect(cleaned).not.toContain('fetlife.com')
    expect(cleaned).not.toContain('discord.gg')
    expect(cleaned).not.toMatch(/Our Website/i)
    expect(cleaned).not.toMatch(/Our Discord/i)
  })
})
