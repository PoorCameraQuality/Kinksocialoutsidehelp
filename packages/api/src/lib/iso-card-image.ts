import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  buildIsoShareCardModel,
  type BuildIsoShareCardModelInput,
  type IsoShareCardModel,
} from './iso-share-card-model.js'
import { ISO_CARD_H, ISO_CARD_W, renderIsoShareCardSvg } from './iso-share-card-svg.js'

const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../assets/iso-card')

type LogoBuffers = { powered: Buffer }

let logoCache: LogoBuffers | null = null

function loadBrandLogos(): LogoBuffers | null {
  if (logoCache) return logoCache
  try {
    logoCache = {
      powered: readFileSync(join(ASSETS_DIR, 'dancecard-powered-wordmark.png')),
    }
    return logoCache
  } catch (err) {
    console.error('[iso-card-image] brand logos missing', { dir: ASSETS_DIR, err })
    return null
  }
}

async function resizeLogo(buf: Buffer, targetWidth: number, opacity: number): Promise<Buffer> {
  const resized = await sharp(buf)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { data, info } = resized
  if (opacity < 1) {
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round(data[i]! * opacity)
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function compositeBrandLogos(basePng: Buffer): Promise<Buffer> {
  const logos = loadBrandLogos()
  if (!logos) return basePng

  const padX = 36
  const padY = 16
  const powered = await resizeLogo(logos.powered, 220, 0.95)
  const meta = await sharp(powered).metadata()
  const w = meta.width ?? 220
  const h = meta.height ?? 56
  const top = ISO_CARD_H - padY - h

  return sharp(basePng)
    .composite([{ input: powered, left: ISO_CARD_W - padX - w, top: Math.max(552, top) }])
    .png()
    .toBuffer()
}

/**
 * Fetch ISO photo for the card. Only http(s); short timeout.
 * Returns null on failure so the renderer can use the no-photo layout.
 */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    if (!/^https?:\/\//i.test(url)) return null
    const r = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'follow' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > 12_000_000) return null
    const png = await sharp(buf)
      .rotate()
      .resize(708, 820, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

/** Render a 1200×630 Black Velvet ISO share card from a normalized model. */
export async function renderIsoShareCardPng(
  model: IsoShareCardModel,
  opts?: { skipPhotoFetch?: boolean },
): Promise<Buffer> {
  let photoDataUri: string | null = null
  if (model.mode === 'full' && model.photoUrl && !opts?.skipPhotoFetch) {
    photoDataUri = await fetchImageAsDataUri(model.photoUrl)
  }
  // No-photo layout when fetch fails or no URL
  const svgModel =
    photoDataUri || !model.photoUrl || model.mode === 'teaser'
      ? model
      : { ...model, photoUrl: null }

  const effectivePhoto = photoDataUri
  const svg = Buffer.from(
    renderIsoShareCardSvg(svgModel, { photoDataUri: effectivePhoto }),
    'utf8',
  )
  const base = await sharp(svg).png().toBuffer()
  const withLogos = await compositeBrandLogos(base)
  const meta = await sharp(withLogos).metadata()
  if (meta.width !== ISO_CARD_W || meta.height !== ISO_CARD_H) {
    return sharp(withLogos).resize(ISO_CARD_W, ISO_CARD_H).png().toBuffer()
  }
  return withLogos
}

/** Build model + render (route helper). */
export async function renderIsoCardFromPost(input: BuildIsoShareCardModelInput): Promise<Buffer> {
  const model = buildIsoShareCardModel(input)
  return renderIsoShareCardPng(model)
}

/**
 * @deprecated Prefer renderIsoCardFromPost / renderIsoShareCardPng.
 * Kept for older unit tests that pass a flat body string.
 */
export async function renderIsoCardPng(input: {
  displayName: string
  username: string
  body: string
  revealBody: boolean
  imageUrl?: string | null
}): Promise<Buffer> {
  return renderIsoCardFromPost({
    displayName: input.displayName,
    username: input.username,
    visibility: input.revealBody ? 'PUBLIC' : 'MEMBERS',
    body: input.body,
    structured: input.revealBody
      ? {
          version: 'iso_v2',
          roles: [],
          playIntent: 'open',
          seekingWho: ['anyone'],
          approach: 'dms_open',
          visualSignal: '',
          capacity: 'selective',
          into: [],
          curious: [],
          hardNos: [],
          pitches: input.body.trim()
            ? []
            : [],
          riskNotes: '',
          gearBringing: '',
          venues: [],
          socialOffers: [],
          discordHandle: '',
        }
      : {},
    imageUrls: input.imageUrl ? [input.imageUrl] : [],
    revealFull: input.revealBody,
  })
}

export { buildIsoShareCardModel, ISO_CARD_H, ISO_CARD_W }
