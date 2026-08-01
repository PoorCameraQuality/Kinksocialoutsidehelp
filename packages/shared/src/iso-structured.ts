/**
 * Structured Dancecard ISO (In Search Of) — header, menu, scene pitches, logistics.
 * Freeform `body` stays on the post row for voice/story.
 */

import { PICKUP_PLAY_WITH } from './pickup-play-catalog.js'

export const ISO_STRUCTURED_VERSION = 'iso_v2' as const
export const ISO_BODY_MAX = 12000
export const ISO_PITCH_MAX = 12
export const ISO_TAG_MAX = 40
export const ISO_FIELD_MAX = 2000

export const ISO_ROLE_TAGS = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'switch', label: 'Switch' },
  { id: 'service_top', label: 'Service top' },
  { id: 'sadist', label: 'Sadist' },
  { id: 'masochist', label: 'Masochist' },
  { id: 'rope_top', label: 'Rope top' },
  { id: 'rope_bottom', label: 'Rope bottom' },
  { id: 'dominant', label: 'Dominant' },
  { id: 'submissive', label: 'Submissive' },
  { id: 'brat', label: 'Brat' },
  { id: 'caregiver', label: 'Caregiver' },
  { id: 'little', label: 'Little' },
  { id: 'primal', label: 'Primal' },
  { id: 'pet', label: 'Pet' },
  { id: 'handler', label: 'Handler' },
] as const

export const ISO_PLAY_INTENT = [
  { id: 'platonic', label: 'Platonic kink / non-sexual', hint: 'Play without sex as the goal.' },
  { id: 'open', label: 'Open either way', hint: 'Chemistry + negotiation decide.' },
  { id: 'sexual', label: 'Sexual play welcome', hint: 'Still negotiated; risk talk expected.' },
] as const

export const ISO_APPROACH = [
  { id: 'dms_open', label: 'DMs open — no need to ask first' },
  { id: 'ask_first', label: 'Ask before DMing' },
  { id: 'in_person', label: 'Prefer in-person first' },
  { id: 'visual_signal', label: 'Look for my visual signal' },
] as const

export const ISO_CAPACITY = [
  { id: 'high', label: 'Booking scenes', hint: 'I am actively making plans.' },
  { id: 'selective', label: 'Selective', hint: 'I am open, but keeping my schedule light.' },
  { id: 'social_first', label: 'Social first', hint: 'I want to meet before discussing play.' },
  { id: 'no_prebook', label: 'No prebooking', hint: 'Come say hello at the event.' },
] as const

export const ISO_PITCH_INTENSITY = [
  { id: 'quick', label: 'Quick', hint: 'Easy to fit into the event' },
  { id: 'planned', label: 'Planned', hint: 'Needs a real conversation first' },
  { id: 'elaborate', label: 'Elaborate', hint: 'More time, setup, or equipment' },
  { id: 'oddball', label: 'Oddball', hint: 'Unusual, playful, or hard to categorize' },
] as const

export const ISO_PITCH_ROLE = [
  { id: 'top', label: 'I top' },
  { id: 'bottom', label: 'I bottom' },
  { id: 'third', label: 'I’m a third / helper' },
  { id: 'service', label: 'Service' },
  { id: 'either', label: 'Either / negotiate' },
] as const

export const ISO_PITCH_SEX = [
  { id: 'none', label: 'Non-sexual' },
  { id: 'optional', label: 'Sex optional' },
  { id: 'yes', label: 'Sexual' },
] as const

export const ISO_VENUES = [
  { id: 'dungeon', label: 'Dungeon / public play space' },
  { id: 'tent', label: 'Tent / private shelter' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'private', label: 'Private corner / quieter' },
] as const

export const ISO_SOCIAL_OFFERS = [
  { id: 'lunch', label: 'Lunch / coffee' },
  { id: 'swim', label: 'Swim' },
  { id: 'craft', label: 'Craft / stitch-&-bitch' },
  { id: 'fire', label: 'Fire chat' },
  { id: 'cards', label: 'Games / cards' },
  { id: 'walk', label: 'Walk around camp' },
  { id: 'sunscreen', label: 'Sunscreen buddy' },
  { id: 'self_tie', label: 'Self-tie jam' },
  { id: 'friends_only', label: 'Friends with no play pressure' },
] as const

/** Who I’m seeking — play-with chips + couple/group shapes. */
export const ISO_SEEKING_WHO = [
  ...PICKUP_PLAY_WITH,
  { id: 'couples', label: 'Couples / established pairs' },
  { id: 'groups', label: 'Group / more-than-two energy' },
  { id: 'friends_first', label: 'Friends-first connections' },
] as const

/**
 * Curated ISO menu tags (shorter than full matchmaker catalog).
 * Labels only — ids are stable for matching/display.
 */
export const ISO_MENU_TAGS = [
  { id: 'rope', label: 'Rope' },
  { id: 'suspension', label: 'Suspension' },
  { id: 'bondage', label: 'Bondage / restraint' },
  { id: 'impact', label: 'Impact' },
  { id: 'stingy', label: 'Stingy impact' },
  { id: 'thuddy', label: 'Thuddy impact' },
  { id: 'needles', label: 'Needles / sharps' },
  { id: 'electro', label: 'Electro' },
  { id: 'wax', label: 'Wax' },
  { id: 'fire', label: 'Fire play' },
  { id: 'knife', label: 'Knife play' },
  { id: 'breath', label: 'Breath play' },
  { id: 'rough_body', label: 'Rough body play' },
  { id: 'primal', label: 'Primal' },
  { id: 'pet_play', label: 'Pet play' },
  { id: 'cgl', label: 'CG/l' },
  { id: 'service', label: 'Service' },
  { id: 'protocol', label: 'Protocol / D/s' },
  { id: 'degradation', label: 'Degradation' },
  { id: 'praise', label: 'Praise' },
  { id: 'mindfuck', label: 'Mindfuck' },
  { id: 'fearplay', label: 'Fear play' },
  { id: 'cnc', label: 'CNC' },
  { id: 'hypno', label: 'Hypnosis' },
  { id: 'exhibition', label: 'Exhibitionism' },
  { id: 'voyeur', label: 'Voyeurism' },
  { id: 'freeuse', label: 'Freeuse' },
  { id: 'group', label: 'Group play' },
  { id: 'sensory_dep', label: 'Sensory deprivation' },
  { id: 'tickling', label: 'Tickling' },
  { id: 'medical', label: 'Medical play' },
  { id: 'objectification', label: 'Objectification' },
  { id: 'forced_orgasm', label: 'Forced orgasm' },
  { id: 'orgasm_control', label: 'Orgasm control' },
  { id: 'body_writing', label: 'Body writing' },
  { id: 'massage', label: 'Massage' },
  { id: 'groping', label: 'Groping' },
  { id: 'makeouts', label: 'Makeouts' },
  { id: 'oral', label: 'Oral' },
  { id: 'sex', label: 'Sex' },
  { id: 'tent_play', label: 'Tent play' },
  { id: 'outdoor_tie', label: 'Outdoor tie' },
  { id: 'foot_play', label: 'Feet / foot worship' },
  { id: 'shaving', label: 'Shaving' },
  { id: 'trampling', label: 'Trampling' },
  { id: 'fisting', label: 'Fisting' },
  { id: 'alien_toys', label: 'Alien / monster toys' },
  { id: 'hucow', label: 'Hucow' },
  { id: 'roleplay', label: 'Roleplay / scenes' },
] as const

export type IsoScenePitch = {
  id: string
  title: string
  description: string
  intensity: (typeof ISO_PITCH_INTENSITY)[number]['id']
  myRole: (typeof ISO_PITCH_ROLE)[number]['id']
  sex: (typeof ISO_PITCH_SEX)[number]['id']
  tags: string[]
}

export type IsoStructured = {
  version: typeof ISO_STRUCTURED_VERSION
  roles: string[]
  playIntent: (typeof ISO_PLAY_INTENT)[number]['id']
  seekingWho: string[]
  approach: (typeof ISO_APPROACH)[number]['id']
  visualSignal: string
  capacity: (typeof ISO_CAPACITY)[number]['id']
  into: string[]
  curious: string[]
  hardNos: string[]
  pitches: IsoScenePitch[]
  riskNotes: string
  gearBringing: string
  venues: string[]
  socialOffers: string[]
  /** Optional Discord username for share cards / off-platform contact (no @). */
  discordHandle: string
}

/** Normalize a Discord username for ISO share cards (max 64). */
export function normalizeIsoDiscordHandle(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/[^\w.#-]/g, '')
    .slice(0, 64)
}

export function emptyIsoStructured(): IsoStructured {
  return {
    version: ISO_STRUCTURED_VERSION,
    roles: [],
    playIntent: 'open',
    seekingWho: ['anyone'],
    approach: 'dms_open',
    visualSignal: '',
    capacity: 'selective',
    into: [],
    curious: [],
    hardNos: [],
    pitches: [],
    riskNotes: '',
    gearBringing: '',
    venues: [],
    socialOffers: [],
    discordHandle: '',
  }
}

function asStringArr(v: unknown, max = ISO_TAG_MAX): string[] {
  if (!Array.isArray(v)) return []
  return v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, max)
}

function asEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

export function normalizeIsoStructured(raw: unknown): IsoStructured {
  const base = emptyIsoStructured()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const intensityIds = ISO_PITCH_INTENSITY.map((x) => x.id)
  const roleIds = ISO_PITCH_ROLE.map((x) => x.id)
  const sexIds = ISO_PITCH_SEX.map((x) => x.id)

  const pitchesRaw = Array.isArray(o.pitches) ? o.pitches : []
  const pitches: IsoScenePitch[] = pitchesRaw
    .slice(0, ISO_PITCH_MAX)
    .map((p, i) => {
      const row = p && typeof p === 'object' ? (p as Record<string, unknown>) : {}
      const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `pitch_${i}`
      return {
        id,
        title: typeof row.title === 'string' ? row.title.slice(0, 120) : '',
        description: typeof row.description === 'string' ? row.description.slice(0, ISO_FIELD_MAX) : '',
        intensity: asEnum(row.intensity, intensityIds, 'planned'),
        myRole: asEnum(row.myRole, roleIds, 'either'),
        sex: asEnum(row.sex, sexIds, 'optional'),
        tags: asStringArr(row.tags, 12),
      }
    })
    .filter((p) => p.title.trim() || p.description.trim())

  return {
    version: ISO_STRUCTURED_VERSION,
    roles: asStringArr(o.roles, 16),
    playIntent: asEnum(o.playIntent, ISO_PLAY_INTENT.map((x) => x.id), 'open'),
    seekingWho: asStringArr(o.seekingWho).length ? asStringArr(o.seekingWho) : base.seekingWho,
    approach: asEnum(o.approach, ISO_APPROACH.map((x) => x.id), 'dms_open'),
    visualSignal: typeof o.visualSignal === 'string' ? o.visualSignal.slice(0, 120) : '',
    capacity: asEnum(o.capacity, ISO_CAPACITY.map((x) => x.id), 'selective'),
    into: asStringArr(o.into),
    curious: asStringArr(o.curious),
    hardNos: asStringArr(o.hardNos),
    pitches,
    riskNotes: typeof o.riskNotes === 'string' ? o.riskNotes.slice(0, ISO_FIELD_MAX) : '',
    gearBringing: typeof o.gearBringing === 'string' ? o.gearBringing.slice(0, ISO_FIELD_MAX) : '',
    venues: asStringArr(o.venues, 8),
    socialOffers: asStringArr(o.socialOffers, 12),
    discordHandle: normalizeIsoDiscordHandle(o.discordHandle),
  }
}

export function isoStructuredHasContent(s: IsoStructured): boolean {
  return Boolean(
    s.roles.length ||
      s.into.length ||
      s.curious.length ||
      s.hardNos.length ||
      s.pitches.length ||
      s.riskNotes.trim() ||
      s.gearBringing.trim() ||
      s.venues.length ||
      s.socialOffers.length ||
      (s.seekingWho.length && !(s.seekingWho.length === 1 && s.seekingWho[0] === 'anyone')) ||
      s.visualSignal.trim(),
  )
}

export function isoPostHasListableContent(body: string, structured: unknown): boolean {
  if (body.trim()) return true
  return isoStructuredHasContent(normalizeIsoStructured(structured))
}

function labelForIsoId(id: string, catalog: readonly { id: string; label: string }[]): string {
  return catalog.find((x) => x.id === id)?.label ?? id
}

/**
 * Plain text for OG description + share-card PNG.
 * Prefers freeform body; otherwise summarizes structured pitches/roles/into.
 */
export function isoShareCardText(body: string, structured: unknown): string {
  const trimmed = body.replace(/\s+/g, ' ').trim()
  if (trimmed) return trimmed
  const s = normalizeIsoStructured(structured)
  const parts: string[] = []
  const pitches = s.pitches.map((p) => p.title.trim()).filter(Boolean).slice(0, 3)
  if (pitches.length) parts.push(pitches.join(' · '))
  const roles = s.roles.map((id) => labelForIsoId(id, ISO_ROLE_TAGS)).slice(0, 4)
  if (roles.length) parts.push(roles.join(', '))
  const into = s.into.map((id) => labelForIsoId(id, ISO_MENU_TAGS)).slice(0, 5)
  if (into.length) parts.push(`Into: ${into.join(', ')}`)
  if (s.visualSignal.trim()) parts.push(`Look for: ${s.visualSignal.trim()}`)
  const joined = parts.join(' — ').replace(/\s+/g, ' ').trim()
  return joined || 'In Search Of on Kink.Social'
}

/** Shared readiness for editor completion + board listing eligibility. */
export function getIsoReadiness(
  structured: unknown,
  body: string,
  visibility?: string | null,
): {
  hasContent: boolean
  legacyBodyOnly: boolean
  structuredReady: boolean
  canList: boolean
  missing: string[]
} {
  const s = normalizeIsoStructured(structured)
  const bodyTrim = body.trim()
  const hasStructured = isoStructuredHasContent(s)
  const hasContent = hasStructured || Boolean(bodyTrim)
  const legacyBodyOnly = Boolean(bodyTrim) && !hasStructured
  const missing: string[] = []
  if (!s.roles.length) missing.push('A role')
  if (!s.seekingWho.length) missing.push('Who you hope to meet')
  if (!s.pitches.length && s.into.length < 2) missing.push('One scene idea or two interests')
  const structuredReady = missing.length === 0
  const visibilityOk = !visibility || visibility === 'PUBLIC' || visibility === 'MEMBERS'
  // Legacy body-only remains listable during migration; structured path uses readiness.
  const canList = visibilityOk && (structuredReady || legacyBodyOnly)
  return { hasContent, legacyBodyOnly, structuredReady, canList, missing }
}

function labelOf(id: string, opts: readonly { id: string; label: string }[]): string {
  return opts.find((o) => o.id === id)?.label ?? id
}

/** Short lines for board cards / summaries. */
export function isoBoardCardSummary(structured: unknown, body: string): {
  roleLine: string | null
  seekingLine: string | null
  pitchTitles: string[]
  tagLine: string | null
  approachLine: string | null
  excerpt: string | null
} {
  const s = normalizeIsoStructured(structured)
  const roleLine = s.roles.length
    ? s.roles
        .slice(0, 4)
        .map((id) => labelOf(id, ISO_ROLE_TAGS))
        .join(' · ')
    : null
  const seekingLine =
    s.seekingWho.length && !(s.seekingWho.length === 1 && s.seekingWho[0] === 'anyone')
      ? `Seeking: ${s.seekingWho
          .slice(0, 4)
          .map((id) => labelOf(id, ISO_SEEKING_WHO))
          .join(', ')}`
      : s.playIntent !== 'open'
        ? labelOf(s.playIntent, ISO_PLAY_INTENT)
        : null
  const pitchTitles = s.pitches.map((p) => p.title.trim()).filter(Boolean).slice(0, 3)
  const tags = [...s.into, ...s.curious].slice(0, 6)
  const tagLine = tags.length
    ? tags.map((id) => labelOf(id, ISO_MENU_TAGS)).join(' · ')
    : null
  const approachLine =
    s.approach === 'visual_signal' && s.visualSignal.trim()
      ? `Signal: ${s.visualSignal.trim()}`
      : labelOf(s.approach, ISO_APPROACH)
  const excerpt = body.trim() ? body.trim().slice(0, 180) : null
  return { roleLine, seekingLine, pitchTitles, tagLine, approachLine, excerpt }
}

export function newIsoPitchId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `pitch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function emptyIsoPitch(): IsoScenePitch {
  return {
    id: newIsoPitchId(),
    title: '',
    description: '',
    intensity: 'planned',
    myRole: 'either',
    sex: 'optional',
    tags: [],
  }
}
