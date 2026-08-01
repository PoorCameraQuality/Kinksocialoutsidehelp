import type { IsoShareCardModel } from './iso-share-card-model.js'

export const ISO_CARD_W = 1200
export const ISO_CARD_H = 630

const C = {
  bg: '#090609',
  elevated: '#161014',
  deep: '#240B14',
  border: '#41202C',
  primary: '#F7F1F3',
  secondary: '#C7BCC1',
  muted: '#90858A',
  pink: '#D83A6D',
  rose: '#B76B83',
  gold: '#C7A45B',
  hardNo: '#D96875',
  footer: '#0E080B',
} as const

const FONT_SERIF = 'DejaVu Serif'
const FONT_SANS = 'DejaVu Sans'

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Word-aware wrap; returns lines and whether truncated. */
export function wrapWords(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return []
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxChars && cur) {
      lines.push(cur)
      cur = w
      if (lines.length >= maxLines) {
        cur = ''
        break
      }
    } else {
      cur = next
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  const joined = lines.join(' ')
  const full = words.join(' ')
  if (full.length > joined.length && lines.length) {
    const last = lines.length - 1
    const trimmed = lines[last]!.replace(/\s+\S*$/, '').trim()
    lines[last] = trimmed ? `${trimmed}...` : `${lines[last]!.slice(0, Math.max(1, maxChars - 3))}...`
  }
  return lines
}

function tspans(lines: string[], x: number, startDy: number, lineDy: number): string {
  return lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? startDy : lineDy}">${escapeXml(line)}</tspan>`)
    .join('')
}

function fitNameSize(name: string): number {
  if (name.length <= 12) return 48
  if (name.length <= 18) return 42
  if (name.length <= 28) return 36
  return 32
}

function fitSceneTitleSize(title: string): { size: number; maxChars: number } {
  if (title.length <= 42) return { size: 26, maxChars: 36 }
  if (title.length <= 70) return { size: 22, maxChars: 40 }
  return { size: 20, maxChars: 42 }
}

export type IsoShareCardSvgOptions = {
  photoDataUri: string | null
}

function brandGlow(): string {
  return `
  <defs>
    <radialGradient id="glowR" cx="92%" cy="18%" r="55%">
      <stop offset="0%" stop-color="${C.deep}" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="${C.bg}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${C.bg}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="footerBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.footer}"/>
      <stop offset="100%" stop-color="${C.bg}"/>
    </linearGradient>
    <clipPath id="photoClip">
      <rect x="800" y="64" width="344" height="400" rx="22"/>
    </clipPath>
  </defs>
  <rect width="${ISO_CARD_W}" height="${ISO_CARD_H}" fill="${C.bg}"/>
  <rect width="${ISO_CARD_W}" height="${ISO_CARD_H}" fill="url(#glowR)"/>`
}

function footerBlock(model: IsoShareCardModel): string {
  // Leave right band clear for the Dancecard-powered wordmark composite.
  const discord =
    model.discordHandle && model.mode === 'full'
      ? `<text x="48" y="612" fill="${C.rose}" font-family="${FONT_SANS}" font-size="13">Discord  ${escapeXml(model.discordHandle)}</text>`
      : ''
  return `
  <rect x="0" y="548" width="${ISO_CARD_W}" height="82" fill="url(#footerBg)"/>
  <line x1="48" y1="548" x2="1152" y2="548" stroke="${C.border}" stroke-width="1"/>
  <text x="48" y="${model.discordHandle && model.mode === 'full' ? 578 : 588}" fill="${C.gold}" font-family="${FONT_SANS}" font-size="14" letter-spacing="0.4">${escapeXml(model.footerInline)}</text>
  ${discord}`
}

function detailStrip(model: IsoShareCardModel, y: number, width: number): string {
  if (model.mode === 'teaser') return ''
  const hasAny = model.curiousLine || model.hardNoLine || model.venuesLine
  if (!hasAny) return ''
  const colW = Math.floor(width / 3)
  const h = 56
  const x = 48
  const curious = escapeXml(wrapWords(model.curiousLine || '—', 22, 1)[0] ?? '—')
  const hard = escapeXml(wrapWords(model.hardNoLine || '—', 24, 1)[0] ?? '—')
  const venues = escapeXml(wrapWords(model.venuesLine || '—', 26, 1)[0] ?? '—')
  return `
  <rect x="${x}" y="${y}" width="${width}" height="${h}" rx="12" fill="${C.elevated}" stroke="${C.border}" stroke-width="1"/>
  <line x1="${x + colW}" y1="${y + 8}" x2="${x + colW}" y2="${y + h - 8}" stroke="${C.border}" stroke-width="1"/>
  <line x1="${x + colW * 2}" y1="${y + 8}" x2="${x + colW * 2}" y2="${y + h - 8}" stroke="${C.border}" stroke-width="1"/>
  <text x="${x + 12}" y="${y + 20}" fill="${C.gold}" font-family="${FONT_SANS}" font-size="10" letter-spacing="1.1">CURIOUS ABOUT</text>
  <text x="${x + 12}" y="${y + 40}" fill="${C.rose}" font-family="${FONT_SANS}" font-size="13">${curious}</text>
  <text x="${x + colW + 12}" y="${y + 20}" fill="${C.hardNo}" font-family="${FONT_SANS}" font-size="10" letter-spacing="1.1">HARD NO</text>
  <rect x="${x + colW + 12}" y="${y + 26}" width="24" height="2" fill="${C.hardNo}" opacity="0.85"/>
  <text x="${x + colW + 12}" y="${y + 44}" fill="${C.primary}" font-family="${FONT_SANS}" font-size="12">${hard}</text>
  <text x="${x + colW * 2 + 12}" y="${y + 20}" fill="${C.gold}" font-family="${FONT_SANS}" font-size="10" letter-spacing="1.1">VENUES</text>
  <text x="${x + colW * 2 + 12}" y="${y + 40}" fill="${C.secondary}" font-family="${FONT_SANS}" font-size="12">${venues}</text>`
}

function featuredPanel(
  model: IsoShareCardModel,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const titleSrc =
    model.featuredPitch?.title ||
    model.freeformExcerpt ||
    (model.mode === 'teaser' ? 'Member ISO' : 'ISO on Dancecard')
  const desc = model.featuredPitch?.description || ''
  const meta = model.featuredPitch?.metaLine || ''
  const { size, maxChars } = fitSceneTitleSize(titleSrc)
  const titleLines = wrapWords(titleSrc, maxChars, 2)
  const descLines = desc ? wrapWords(desc, Math.floor(width / 9.2), 2) : []
  const titleT = tspans(titleLines, x + 20, 0, size + 4)
  let cursor = 28 + titleLines.length * (size + 4)
  const descBlock =
    descLines.length > 0
      ? `<text x="${x + 20}" y="${y + cursor + 14}" fill="${C.secondary}" font-family="${FONT_SANS}" font-size="16">${tspans(descLines, x + 20, 0, 20)}</text>`
      : ''
  const metaY = y + height - 18
  return `
  <text x="${x}" y="${y - 10}" fill="${C.gold}" font-family="${FONT_SANS}" font-size="11" letter-spacing="1.4">FEATURED SCENE</text>
  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${C.elevated}" stroke="${C.rose}" stroke-opacity="0.45" stroke-width="1.5"/>
  <text x="${x + 20}" y="${y + 32}" fill="${C.primary}" font-family="${FONT_SERIF}" font-size="${size}" font-weight="700">${titleT}</text>
  ${descBlock}
  ${
    meta
      ? `<text x="${x + 20}" y="${metaY}" fill="${C.muted}" font-family="${FONT_SANS}" font-size="13" letter-spacing="0.5">${escapeXml(meta)}</text>`
      : ''
  }`
}

function playMenuBlock(model: IsoShareCardModel, x: number, y: number, width: number): string {
  if (!model.playMenuLine) return ''
  let line = model.playMenuLine
  if (model.playMenuOverflow > 0) line = `${line} · +${model.playMenuOverflow} more`
  const lines = wrapWords(line, Math.floor(width / 7.6), 3)
  return `
  <text x="${x}" y="${y}" fill="${C.gold}" font-family="${FONT_SANS}" font-size="12" letter-spacing="1.4">PLAY MENU</text>
  <text x="${x}" y="${y + 24}" fill="${C.secondary}" font-family="${FONT_SANS}" font-size="15">${tspans(lines, x, 0, 20)}</text>`
}

function socialBlock(model: IsoShareCardModel, x: number, y: number, width: number): string {
  if (!model.socialLine || model.mode !== 'full') return ''
  const lines = wrapWords(model.socialLine, Math.floor(width / 7.4), 2)
  return `
  <text x="${x}" y="${y}" fill="${C.pink}" font-family="${FONT_SANS}" font-size="11" letter-spacing="1.1">ALSO HAPPY TO</text>
  <text x="${x}" y="${y + 22}" fill="${C.secondary}" font-family="${FONT_SANS}" font-size="14">${tspans(lines, x, 0, 18)}</text>`
}

function photoBlock(photoDataUri: string | null): string {
  if (!photoDataUri) return ''
  return `
  <rect x="800" y="64" width="344" height="400" rx="22" fill="${C.deep}" stroke="${C.border}" stroke-width="2"/>
  <image href="${photoDataUri}" x="800" y="64" width="344" height="400" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>
  <rect x="800" y="64" width="344" height="400" rx="22" fill="none" stroke="${C.border}" stroke-width="2"/>`
}

function noPhotoSidePanel(model: IsoShareCardModel): string {
  const seeking = wrapWords(model.seekingLine || 'See full ISO', 28, 3)
  const x = 800
  return `
  <text x="${x}" y="96" fill="${C.gold}" font-family="${FONT_SANS}" font-size="12" letter-spacing="1.4">SEEKING</text>
  <text x="${x}" y="124" fill="${C.secondary}" font-family="${FONT_SANS}" font-size="16">${tspans(seeking, x, 0, 22)}</text>
  <rect x="${x}" y="210" width="344" height="2" fill="${C.border}"/>
  <text x="${x}" y="250" fill="${C.muted}" font-family="${FONT_SANS}" font-size="14">Dancecard scene menu</text>
  <text x="${x}" y="278" fill="${C.rose}" font-family="${FONT_SERIF}" font-size="22">Open the full ISO</text>`
}

/** Build the Black Velvet ISO share card SVG markup. */
export function renderIsoShareCardSvg(
  model: IsoShareCardModel,
  opts: IsoShareCardSvgOptions,
): string {
  const hasPhoto = Boolean(opts.photoDataUri)
  const nameSize = fitNameSize(model.displayName)
  const contentW = hasPhoto ? 700 : 720
  const panelW = hasPhoto ? 700 : 1104
  const panelH = 128

  // Identity + contextual approach (2 lines) sit above featured scene.
  const context1 = model.contextLines[0] ?? ''
  const context2 = model.contextLines[1] ?? ''
  const featuredY = 214
  const playY = 360
  const playLines = model.playMenuLine
    ? wrapWords(
        model.playMenuOverflow > 0
          ? `${model.playMenuLine} · +${model.playMenuOverflow} more`
          : model.playMenuLine,
        Math.floor(contentW / 7.6),
        3,
      ).length
    : 0
  const stripY = playY + 28 + playLines * 20 + 14
  const socialY = stripY + 64

  // Seeking summary sits under ALSO HAPPY TO when present (avoids crowding identity).
  const seekingAfterSocial =
    model.seekingLine && model.mode === 'full'
      ? `<text x="48" y="${Math.min(socialY + 44, 540)}" fill="${C.muted}" font-family="${FONT_SANS}" font-size="12">${escapeXml(wrapWords(model.seekingLine, 78, 1)[0] ?? '')}</text>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${ISO_CARD_W}" height="${ISO_CARD_H}" viewBox="0 0 ${ISO_CARD_W} ${ISO_CARD_H}" xmlns="http://www.w3.org/2000/svg">
  ${brandGlow()}
  <text x="48" y="48" fill="${C.gold}" font-family="${FONT_SANS}" font-size="18" letter-spacing="2.6" font-weight="700">DANCECARD • ISO</text>
  <text x="48" y="100" fill="${C.primary}" font-family="${FONT_SERIF}" font-size="${nameSize}" font-weight="700">${escapeXml(model.displayName)}</text>
  <text x="48" y="132" fill="${C.rose}" font-family="${FONT_SANS}" font-size="15">${escapeXml(model.rolesLine)}</text>
  <text x="48" y="156" fill="${C.secondary}" font-family="${FONT_SANS}" font-size="14">${escapeXml(context1)}</text>
  <text x="48" y="178" fill="${C.secondary}" font-family="${FONT_SANS}" font-size="14">${escapeXml(context2)}</text>
  ${featuredPanel(model, 48, featuredY, panelW, panelH)}
  ${playMenuBlock(model, 48, playY, contentW)}
  ${detailStrip(model, Math.min(stripY, 455), contentW)}
  ${socialBlock(model, 48, Math.min(socialY, 508), contentW)}
  ${seekingAfterSocial}
  ${hasPhoto ? photoBlock(opts.photoDataUri) : noPhotoSidePanel(model)}
  ${footerBlock(model)}
</svg>`
}
