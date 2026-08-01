import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import sharp from 'sharp'
import { BRAX_ISO_STRUCTURED, MANY_PITCHES_STRUCTURED } from './iso-share-card-fixtures.js'
import { renderIsoCardFromPost, renderIsoCardPng, renderIsoShareCardPng } from './iso-card-image.js'
import { buildIsoShareCardModel } from './iso-share-card-model.js'
import { ISO_CARD_H, ISO_CARD_W, renderIsoShareCardSvg } from './iso-share-card-svg.js'

async function assertPngDims(buf: Buffer) {
  assert.ok(buf.length > 2000)
  assert.equal(buf[0], 0x89)
  assert.equal(buf[1], 0x50)
  const meta = await sharp(buf).metadata()
  assert.equal(meta.width, ISO_CARD_W)
  assert.equal(meta.height, ISO_CARD_H)
}

describe('renderIsoShareCardPng', () => {
  it('renders Brax-sized public card without photo fetch', async () => {
    const model = buildIsoShareCardModel({
      displayName: 'Brax',
      username: 'Brax',
      visibility: 'PUBLIC',
      body: '',
      structured: BRAX_ISO_STRUCTURED,
      imageUrls: [],
      revealFull: true,
    })
    const buf = await renderIsoShareCardPng(model, { skipPhotoFetch: true })
    await assertPngDims(buf)
  })

  it('renders no-photo layout', async () => {
    const buf = await renderIsoCardFromPost({
      displayName: 'Brax',
      username: 'Brax',
      visibility: 'PUBLIC',
      body: '',
      structured: BRAX_ISO_STRUCTURED,
      imageUrls: [],
      revealFull: true,
    })
    await assertPngDims(buf)
  })

  it('renders many pitches card', async () => {
    const buf = await renderIsoCardFromPost({
      displayName: 'Brax',
      username: 'Brax',
      visibility: 'PUBLIC',
      body: '',
      structured: MANY_PITCHES_STRUCTURED,
      imageUrls: [],
      revealFull: true,
    })
    await assertPngDims(buf)
  })

  it('renders private teaser', async () => {
    const buf = await renderIsoCardFromPost({
      displayName: 'Brax',
      username: 'Brax',
      visibility: 'PRIVATE',
      body: 'hidden',
      structured: BRAX_ISO_STRUCTURED,
      imageUrls: ['https://example.invalid/x.jpg'],
      revealFull: false,
    })
    await assertPngDims(buf)
  })

  it('renders long name / long title without throwing', async () => {
    const structured = {
      ...BRAX_ISO_STRUCTURED,
      pitches: [
        {
          ...BRAX_ISO_STRUCTURED.pitches[0]!,
          title:
            'Seeking an elaborate negotiated scene with rope, impact, and aftercare for a carefully planned evening together',
          description:
            'Looking for experienced partners who communicate clearly & enjoy debriefs / aftercare — first sessions stay light.',
        },
      ],
    }
    const buf = await renderIsoCardFromPost({
      displayName: 'Alexandria Montgomery-Whitaker III',
      username: 'alexandria_montgomery',
      visibility: 'PUBLIC',
      body: '',
      structured,
      imageUrls: [],
      revealFull: true,
    })
    await assertPngDims(buf)
  })

  it('SVG escapes special characters and stays valid-ish', () => {
    const model = buildIsoShareCardModel({
      displayName: `Brax & Co`,
      username: 'Brax',
      visibility: 'PUBLIC',
      body: '',
      structured: {
        ...BRAX_ISO_STRUCTURED,
        pitches: [
          {
            ...BRAX_ISO_STRUCTURED.pitches[0]!,
            title: `Tops & bottoms <3 / "fun"`,
            description: `Apostrophe's & ampersands`,
          },
        ],
      },
      imageUrls: [],
      revealFull: true,
    })
    const svg = renderIsoShareCardSvg(model, { photoDataUri: null })
    assert.ok(svg.includes('&amp;'))
    assert.ok(!svg.includes('<3')) // should be escaped as &lt;3
    assert.ok(svg.includes('&lt;3'))
    assert.ok(!svg.includes('[object Object]'))
    assert.ok(!svg.includes('undefined'))
    assert.match(svg, /viewBox="0 0 1200 630"/)
  })

  it('legacy renderIsoCardPng still produces PNG', async () => {
    const buf = await renderIsoCardPng({
      displayName: 'Phoenix',
      username: 'shibariphoenix',
      body: 'Looking for rope and negotiation practice this weekend.',
      revealBody: true,
      imageUrl: null,
    })
    await assertPngDims(buf)
  })
})
