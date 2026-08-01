/**
 * Normalized view model for the Dancecard ISO share card (1200×630 PNG).
 * Selection / ranking lives here; SVG rendering stays separate.
 */
import {
  ISO_APPROACH,
  ISO_CAPACITY,
  ISO_MENU_TAGS,
  ISO_PLAY_INTENT,
  ISO_PITCH_INTENSITY,
  ISO_PITCH_ROLE,
  ISO_PITCH_SEX,
  ISO_ROLE_TAGS,
  ISO_SEEKING_WHO,
  ISO_SOCIAL_OFFERS,
  ISO_VENUES,
  normalizeIsoStructured,
  type IsoScenePitch,
  type IsoStructured,
} from '@c2k/shared'
import type { IsoVisibility } from './iso-access.js'

export type IsoShareCardMode = 'full' | 'teaser'

export type IsoShareCardFeaturedPitch = {
  title: string
  description: string
  metaLine: string
}

export type IsoShareCardModel = {
  mode: IsoShareCardMode
  displayName: string
  username: string
  visibility: IsoVisibility
  rolesLine: string
  /** Contextual approach / capacity / intent lines (not bare enums). */
  contextLines: string[]
  featuredPitch: IsoShareCardFeaturedPitch | null
  freeformExcerpt: string | null
  additionalPitchTitles: string[]
  morePitchCount: number
  playMenuLine: string
  playMenuOverflow: number
  curiousLine: string
  hardNoLine: string
  venuesLine: string
  seekingLine: string
  socialLine: string
  discordHandle: string
  photoUrl: string | null
  totalPhotoCount: number
  totalPitchCount: number
  sharePath: string
  footerCta: string
  footerInline: string
}

export type BuildIsoShareCardModelInput = {
  displayName: string
  username: string
  visibility: IsoVisibility
  body: string
  structured: unknown
  imageUrls: string[]
  /** When false, build anonymous teaser (no private details / images). */
  revealFull: boolean
}

const GENERIC_PLAY_TAG_IDS = new Set(['sex', 'oral', 'makeouts', 'massage', 'groping'])

function labelOf(id: string, catalog: readonly { id: string; label: string }[]): string {
  return catalog.find((x) => x.id === id)?.label ?? id
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Display-only title softener for the share card (does not mutate saved ISO). */
export function displayFeaturedPitchTitle(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim()
  if (/anything I have listed/i.test(t)) {
    return t.replace(/anything I have listed/gi, 'anything on my menu')
  }
  return t
}

export function approachContext(approachId: string, visualSignal: string): string {
  switch (approachId) {
    case 'dms_open':
      return 'DMs open — no need to ask first'
    case 'ask_first':
      return 'Ask before DMing'
    case 'in_person':
      return 'Prefer in-person first'
    case 'visual_signal':
      return visualSignal.trim()
        ? `Look for: ${visualSignal.trim()}`
        : 'Look for my visual signal'
    default:
      return labelOf(approachId, ISO_APPROACH)
  }
}

export function capacityContext(capacityId: string): string {
  switch (capacityId) {
    case 'high':
      return 'Booking scenes — actively making plans'
    case 'selective':
      return 'Selective — open, keeping schedule light'
    case 'social_first':
      return 'Social first — meet before discussing play'
    case 'no_prebook':
      return 'No prebooking — say hello at the event'
    default:
      return labelOf(capacityId, ISO_CAPACITY)
  }
}

export function playIntentContext(intentId: string): string {
  switch (intentId) {
    case 'open':
      return 'Open either way — chemistry + negotiation decide'
    case 'platonic':
      return 'Platonic / non-sexual — play without sex as the goal'
    case 'sexual':
      return 'Sexual play welcome — still negotiated'
    default:
      return labelOf(intentId, ISO_PLAY_INTENT)
  }
}

/** @deprecated Prefer approachContext / capacityContext / playIntentContext */
export function approachDisplay(approachId: string): string {
  return approachContext(approachId, '').toUpperCase()
}

export function capacityDisplay(capacityId: string): string {
  return capacityContext(capacityId).toUpperCase()
}

export function playIntentDisplay(intentId: string): string {
  return playIntentContext(intentId).toUpperCase()
}

function pitchMetaLine(pitch: IsoScenePitch): string {
  const parts = [
    labelOf(pitch.intensity, ISO_PITCH_INTENSITY).toUpperCase(),
    pitch.myRole === 'either'
      ? 'EITHER / NEGOTIATE'
      : labelOf(pitch.myRole, ISO_PITCH_ROLE).toUpperCase(),
    pitch.sex === 'optional'
      ? 'SEX OPTIONAL'
      : pitch.sex === 'none'
        ? 'NON-SEXUAL'
        : pitch.sex === 'yes'
          ? 'SEXUAL'
          : labelOf(pitch.sex, ISO_PITCH_SEX).toUpperCase(),
  ]
  return parts.join(' • ')
}

function compactTagLabel(id: string): string {
  const full = labelOf(id, ISO_MENU_TAGS)
  // Shorter play-menu tokens where safe
  const short: Record<string, string> = {
    fire: 'Fire',
    wax: 'Wax',
    breath: 'Breath',
    knife: 'Knife',
    primal: 'Primal',
    cgl: 'CG/l',
    rough_body: 'Rough body play',
    thuddy: 'Thuddy impact',
    impact: 'Impact',
    stingy: 'Stingy impact',
    needles: 'Needles / sharps',
    sensory_dep: 'Sensory dep',
    forced_orgasm: 'Forced orgasm',
    orgasm_control: 'Orgasm control',
    roleplay: 'Roleplay',
  }
  return short[id] ?? full
}

function venueCompact(id: string): string {
  const map: Record<string, string> = {
    dungeon: 'Dungeon / public',
    outdoor: 'Outdoor',
    private: 'Private / quieter',
    tent: 'Tent / shelter',
  }
  return map[id] ?? labelOf(id, ISO_VENUES)
}

function socialCompact(id: string): string {
  const map: Record<string, string> = {
    lunch: 'Coffee',
    swim: 'Swim',
    craft: 'Craft',
    fire: 'Fire chat',
    cards: 'Games',
    walk: 'Walk',
    sunscreen: 'Sunscreen',
    self_tie: 'Self-tie jam',
    friends_only: 'Friends with no play pressure',
  }
  return map[id] ?? labelOf(id, ISO_SOCIAL_OFFERS)
}

/**
 * Hard nos always win: remove Into tags whose normalized label matches a hard no.
 */
export function filterPlayTagsAgainstHardNos(intoIds: string[], hardNoIds: string[]): string[] {
  const hardKeys = new Set(
    hardNoIds.flatMap((id) => {
      const label = normKey(labelOf(id, ISO_MENU_TAGS))
      const compact = normKey(compactTagLabel(id))
      return [normKey(id), label, compact]
    }),
  )
  return intoIds.filter((id) => {
    const keys = [normKey(id), normKey(labelOf(id, ISO_MENU_TAGS)), normKey(compactTagLabel(id))]
    return !keys.some((k) => hardKeys.has(k))
  })
}

/** Rank play tags: pitch tags first, then distinctive Into, deprioritize generic. */
export function rankPlayTags(opts: {
  intoIds: string[]
  hardNoIds: string[]
  pitchTagIds: string[]
  max: number
}): { tags: string[]; overflow: number } {
  const filtered = filterPlayTagsAgainstHardNos(opts.intoIds, opts.hardNoIds)
  const filteredSet = new Set(filtered)
  const preferredOrder = [
    'fire',
    'wax',
    'breath',
    'knife',
    'primal',
    'cgl',
    'rough_body',
    'thuddy',
    'impact',
    'sensory_dep',
    'roleplay',
    'hypno',
    'cnc',
  ]
  const prefIdx = (id: string) => {
    const i = preferredOrder.indexOf(id)
    return i === -1 ? 1000 : i
  }
  // Cap pitch-tag takeover so Into can still surface Wax/Breath/etc.
  const pitchFirst = [...opts.pitchTagIds]
    .filter((id) => filteredSet.has(id))
    .sort((a, b) => prefIdx(a) - prefIdx(b))
    .slice(0, 8)
  const rest = filtered.filter((id) => !pitchFirst.includes(id))
  const distinctive = rest
    .filter((id) => !GENERIC_PLAY_TAG_IDS.has(id))
    .sort((a, b) => prefIdx(a) - prefIdx(b))
  const generic = rest.filter((id) => GENERIC_PLAY_TAG_IDS.has(id))
  const ordered = [...pitchFirst, ...distinctive, ...generic]
  // Dedupe preserving order
  const seen = new Set<string>()
  const unique: string[] = []
  for (const id of ordered) {
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  const tags = unique.slice(0, opts.max)
  return { tags, overflow: Math.max(0, unique.length - tags.length) }
}

function seekingSummary(seekingWho: string[]): string {
  if (!seekingWho.length) return ''
  const hasAnyone = seekingWho.includes('anyone')
  const friendsFirst = seekingWho.includes('friends_first')
  if (hasAnyone && friendsFirst) return 'Open to anyone • Friends-first connections welcome'
  if (hasAnyone) return 'Open to anyone'
  const labels = seekingWho
    .filter((id) => id !== 'anyone')
    .slice(0, 4)
    .map((id) => labelOf(id, ISO_SEEKING_WHO))
  return labels.join(' • ')
}

function teaserModel(input: BuildIsoShareCardModelInput): IsoShareCardModel {
  const s = normalizeIsoStructured(input.structured)
  const roles = s.roles.slice(0, 3).map((id) => labelOf(id, ISO_ROLE_TAGS).toUpperCase())
  const sharePath = `/share/iso/${encodeURIComponent(input.username)}`
  return {
    mode: 'teaser',
    displayName: input.displayName.trim() || input.username,
    username: input.username,
    visibility: input.visibility,
    rolesLine: roles.length ? `@${input.username} • ${roles.join(' • ')}` : `@${input.username}`,
    contextLines: ['Member ISO — sign in to view the full scene menu'],
    featuredPitch: {
      title: 'Private scene menu',
      description: 'Sign in to view the full ISO, logistics, boundaries and photos.',
      metaLine: input.visibility === 'PRIVATE' ? 'PRIVATE' : 'MEMBERS ONLY',
    },
    freeformExcerpt: null,
    additionalPitchTitles: [],
    morePitchCount: 0,
    playMenuLine: '',
    playMenuOverflow: 0,
    curiousLine: '',
    hardNoLine: '',
    venuesLine: '',
    seekingLine: '',
    socialLine: '',
    discordHandle: '',
    photoUrl: null,
    totalPhotoCount: 0,
    totalPitchCount: 0,
    sharePath,
    footerCta: 'SIGN IN TO VIEW THE FULL ISO',
    footerInline: `✦ Sign in to view full ISO · kink.social${sharePath}`,
  }
}

function freeformExcerpt(body: string, maxLines = 3, maxChars = 48): string {
  const words = body.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxChars && cur) {
      lines.push(cur)
      cur = w
      if (lines.length >= maxLines) break
    } else {
      cur = next
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  let text = lines.join(' ')
  const full = words.join(' ')
  if (full.length > text.length) {
    text = `${text.replace(/\s+\S*$/, '').trim()}...`
  }
  return text
}

export function buildIsoShareCardModel(input: BuildIsoShareCardModelInput): IsoShareCardModel {
  if (!input.revealFull) return teaserModel(input)

  const s = normalizeIsoStructured(input.structured)
  const roles = s.roles.slice(0, 4).map((id) => labelOf(id, ISO_ROLE_TAGS).toUpperCase())
  const rolesLine = [`@${input.username}`, ...roles].filter(Boolean).join(' • ')

  const contextLines = [
    approachContext(s.approach, s.visualSignal),
    `${capacityContext(s.capacity)} · ${playIntentContext(s.playIntent)}`,
  ]

  const pitches = s.pitches.filter((p) => p.title.trim() || p.description.trim())
  const featured = pitches[0] ?? null
  const additional = pitches.slice(1)
  const additionalTitles = additional
    .map((p) => p.title.trim())
    .filter(Boolean)
    .slice(0, 2)
  const morePitchCount = Math.max(0, additional.length - additionalTitles.length)

  let featuredPitch: IsoShareCardFeaturedPitch | null = null
  let freeform: string | null = null
  if (featured) {
    featuredPitch = {
      title: displayFeaturedPitchTitle(featured.title.trim() || 'Untitled scene'),
      description: featured.description.replace(/\s+/g, ' ').trim(),
      metaLine: pitchMetaLine(featured),
    }
  } else if (input.body.trim()) {
    freeform = freeformExcerpt(input.body)
  }

  // Show a generous play menu; only truncate truly huge Into lists.
  const ranked = rankPlayTags({
    intoIds: s.into,
    hardNoIds: s.hardNos,
    pitchTagIds: featured?.tags ?? [],
    max: 18,
  })
  const playMenuLine = ranked.tags.map(compactTagLabel).join(' • ')

  const curiousLine = s.curious
    .slice(0, 3)
    .map((id) => compactTagLabel(id).toUpperCase())
    .join(' • ')
  const hardNoLine = s.hardNos
    .slice(0, 4)
    .map((id) => compactTagLabel(id).toUpperCase())
    .join(' • ')
  const venuesLine = s.venues.slice(0, 3).map(venueCompact).join(' • ')
  const socialLine = s.socialOffers.map(socialCompact).join(' • ')
  const sharePath = `/share/iso/${encodeURIComponent(input.username)}`
  const discordHandle = s.discordHandle.trim()

  return {
    mode: 'full',
    displayName: input.displayName.trim() || input.username,
    username: input.username,
    visibility: input.visibility,
    rolesLine,
    contextLines,
    featuredPitch,
    freeformExcerpt: freeform,
    additionalPitchTitles: additionalTitles,
    morePitchCount,
    playMenuLine,
    playMenuOverflow: ranked.overflow,
    curiousLine,
    hardNoLine,
    venuesLine,
    seekingLine: seekingSummary(s.seekingWho),
    socialLine,
    discordHandle,
    photoUrl: input.imageUrls[0] ?? null,
    totalPhotoCount: input.imageUrls.length,
    totalPitchCount: pitches.length,
    sharePath,
    footerCta: 'VIEW THE FULL ISO',
    footerInline: `✦ View full ISO · kink.social${sharePath}`,
  }
}

/** Cache-Control for card.png — never publicly cache auth-gated full cards. */
export function isoCardCacheControl(opts: {
  visibility: IsoVisibility
  revealFull: boolean
}): { cacheControl: string; varyCookie: boolean } {
  if (opts.visibility !== 'PUBLIC') {
    return {
      cacheControl: opts.revealFull ? 'private, no-store' : 'public, max-age=300',
      varyCookie: true,
    }
  }
  return { cacheControl: 'public, max-age=300', varyCookie: false }
}

/** Exported for tests — structured snapshot helpers. */
export function __testNormalizeIso(structured: unknown): IsoStructured {
  return normalizeIsoStructured(structured)
}
