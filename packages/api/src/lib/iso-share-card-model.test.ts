import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BRAX_ISO_STRUCTURED, MANY_PITCHES_STRUCTURED } from './iso-share-card-fixtures.js'
import {
  buildIsoShareCardModel,
  displayFeaturedPitchTitle,
  filterPlayTagsAgainstHardNos,
  isoCardCacheControl,
  rankPlayTags,
} from './iso-share-card-model.js'
import { escapeXml, wrapWords } from './iso-share-card-svg.js'

describe('iso share card model', () => {
  it('builds Brax fixture with featured scene and no stingy in play menu', () => {
    const m = buildIsoShareCardModel({
      displayName: 'Brax',
      username: 'Brax',
      visibility: 'PUBLIC',
      body: '',
      structured: BRAX_ISO_STRUCTURED,
      imageUrls: ['https://example.com/a.jpg'],
      revealFull: true,
    })
    assert.equal(m.mode, 'full')
    assert.equal(m.featuredPitch?.title, 'Seeking to top or bottom for anything on my menu')
    assert.match(m.contextLines.join(' '), /DMs open/i)
    assert.match(m.contextLines.join(' '), /Selective — open, keeping schedule light/i)
    assert.match(m.contextLines.join(' '), /Open either way — chemistry/i)
    assert.match(m.playMenuLine, /Fire/)
    assert.doesNotMatch(m.playMenuLine, /Stingy/i)
    assert.match(m.hardNoLine, /STINGY IMPACT/)
    assert.match(m.hardNoLine, /NEEDLES/)
    assert.match(m.curiousLine, /CNC/)
    assert.match(m.footerInline, /View full ISO · kink\.social\/share\/iso\/Brax/)
    assert.equal(m.sharePath, '/share/iso/Brax')
    assert.ok(!m.playMenuLine.includes('undefined'))
    assert.ok(!JSON.stringify(m).includes('[object Object]'))
  })

  it('hard nos override conflicting into tags', () => {
    const filtered = filterPlayTagsAgainstHardNos(['stingy', 'fire', 'wax'], ['stingy', 'needles'])
    assert.deepEqual(filtered, ['fire', 'wax'])
    const ranked = rankPlayTags({
      intoIds: ['stingy', 'fire', 'sex', 'knife'],
      hardNoIds: ['stingy'],
      pitchTagIds: ['knife', 'fire'],
      max: 8,
    })
    assert.ok(!ranked.tags.includes('stingy'))
    assert.ok(ranked.tags.includes('knife'))
    assert.ok(ranked.tags.includes('fire'))
  })

  it('ranks pitch tags first and deprioritizes generic tags', () => {
    const ranked = rankPlayTags({
      intoIds: ['sex', 'oral', 'fire', 'wax', 'knife'],
      hardNoIds: [],
      pitchTagIds: ['knife'],
      max: 3,
    })
    assert.equal(ranked.tags[0], 'knife')
    assert.ok(ranked.tags.indexOf('fire') < ranked.tags.indexOf('sex') || !ranked.tags.includes('sex'))
  })

  it('teaser hides protected content for MEMBERS anonymous', () => {
    const m = buildIsoShareCardModel({
      displayName: 'Brax',
      username: 'Brax',
      visibility: 'MEMBERS',
      body: 'secret body',
      structured: BRAX_ISO_STRUCTURED,
      imageUrls: ['https://example.com/a.jpg'],
      revealFull: false,
    })
    assert.equal(m.mode, 'teaser')
    assert.equal(m.photoUrl, null)
    assert.equal(m.hardNoLine, '')
    assert.equal(m.playMenuLine, '')
    assert.match(m.featuredPitch?.description ?? '', /Sign in/i)
    assert.doesNotMatch(JSON.stringify(m), /Stingy|fun casual|secret body/i)
  })

  it('handles many pitches with additional titles', () => {
    const m = buildIsoShareCardModel({
      displayName: 'Brax',
      username: 'Brax',
      visibility: 'PUBLIC',
      body: '',
      structured: MANY_PITCHES_STRUCTURED,
      imageUrls: [],
      revealFull: true,
    })
    assert.equal(m.totalPitchCount, 4)
    assert.equal(m.additionalPitchTitles.length, 2)
    assert.equal(m.morePitchCount, 1)
  })

  it('freeform-only ISO uses body excerpt', () => {
    const m = buildIsoShareCardModel({
      displayName: 'Alex & Jordan',
      username: 'aj',
      visibility: 'PUBLIC',
      body: 'Looking for rope bottoms who love negotiation & aftercare — first sessions stay light.',
      structured: {
        version: 'iso_v2',
        roles: ['rope_top'],
        playIntent: 'open',
        seekingWho: ['anyone'],
        approach: 'ask_first',
        visualSignal: '',
        capacity: 'selective',
        into: ['rope'],
        curious: [],
        hardNos: [],
        pitches: [],
        riskNotes: '',
        gearBringing: '',
        venues: [],
        socialOffers: [],
        discordHandle: '',
      },
      imageUrls: [],
      revealFull: true,
    })
    assert.ok(m.freeformExcerpt)
    assert.match(m.freeformExcerpt!, /rope|negotiation/i)
    assert.equal(m.featuredPitch, null)
  })

  it('softens display title without mutating source', () => {
    assert.equal(
      displayFeaturedPitchTitle('Seeking to top or bottom for anything I have listed'),
      'Seeking to top or bottom for anything on my menu',
    )
    assert.equal(BRAX_ISO_STRUCTURED.pitches[0]!.title.includes('I have listed'), true)
  })

  it('cache control never publicly caches auth-gated full cards', () => {
    assert.equal(isoCardCacheControl({ visibility: 'PUBLIC', revealFull: true }).cacheControl, 'public, max-age=300')
    assert.equal(isoCardCacheControl({ visibility: 'MEMBERS', revealFull: false }).cacheControl, 'public, max-age=300')
    assert.equal(isoCardCacheControl({ visibility: 'MEMBERS', revealFull: true }).cacheControl, 'private, no-store')
    assert.equal(isoCardCacheControl({ visibility: 'PRIVATE', revealFull: true }).cacheControl, 'private, no-store')
    assert.equal(isoCardCacheControl({ visibility: 'PRIVATE', revealFull: true }).varyCookie, true)
  })
})

describe('iso share card svg helpers', () => {
  it('escapes XML special characters', () => {
    assert.equal(escapeXml(`A&B <C> "D" 'E'`), 'A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;')
  })

  it('wraps by words and truncates cleanly', () => {
    const lines = wrapWords('one two three four five six seven', 10, 2)
    assert.ok(lines.length <= 2)
    assert.ok(lines.join(' ').includes('...'))
  })

  it('preserves ampersands and slashes in wrap input via escape at render', () => {
    const lines = wrapWords('Tops & bottoms / switches welcome', 40, 2)
    assert.equal(lines[0], 'Tops & bottoms / switches welcome')
  })
})
