/**
 * Pickup-play Matchmaker — negotiation-checklist style quiz + scoring.
 * Catalog inspired by common BDSM negotiation starters (activities, feelings,
 * marks, aftercare, STI prefs) — original kink.social copy.
 */

import {
  CATALOG_BY_ID,
  PICKUP_PLAY_AFTERCARE,
  PICKUP_PLAY_CATALOG,
  PICKUP_PLAY_FEELINGS,
  PICKUP_PLAY_I_AM,
  PICKUP_PLAY_STI_RISK,
  PICKUP_PLAY_WITH,
  type CatalogCategoryId,
} from './pickup-play-catalog.js'

export {
  CATALOG_BY_ID,
  CATALOG_CATEGORIES,
  PICKUP_PLAY_AFTERCARE,
  PICKUP_PLAY_CATALOG,
  PICKUP_PLAY_FEELINGS,
  PICKUP_PLAY_I_AM,
  PICKUP_PLAY_STI_RISK,
  PICKUP_PLAY_WITH,
  type CatalogCategoryId,
  type CatalogItem,
} from './pickup-play-catalog.js'

export const PICKUP_PLAY_QUIZ_VERSION = 'pickup_play_v2' as const
export const PICKUP_PLAY_QUIZ_VERSION_V1 = 'pickup_play_v1' as const

export type LikertValue = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type PickupPlayAnswers = {
  version: typeof PICKUP_PLAY_QUIZ_VERSION
  roleTonight: 'top' | 'bottom' | 'switch'
  /** “I prefer to play with…” — partner gender / identity filters */
  playWith: string[]
  /** “For matching, I show up as…” — scene-scoped self tags */
  iAm: string[]
  /** “I want the scene to feel…” */
  moods: string[]
  intent: 'non_sexual' | 'open_to_sexual' | 'sexual_focus'
  /** Activities I want to receive / experience */
  seeking: string[]
  /** Activities I’m happy to give / do for a partner */
  offering: string[]
  /** Curious / soft-yes — not required for a match */
  maybe: string[]
  /** Hard nos for tonight (from catalog) */
  hardNos: string[]
  marksOk: 'none' | 'today' | 'week' | 'discuss'
  /** Mid-scene check-in preference (negotiation checklist style) */
  checkIns: 'welcome' | 'minimal' | 'discuss'
  /** Escalation within negotiated envelope */
  escalate: 'ask_first' | 'within_limits' | 'discuss'
  /** Safeword / signal readiness */
  signals: 'traffic_light' | 'custom_word' | 'nonverbal_ready' | 'discuss'
  aftercare: string[]
  /** Sexual-health risk profile chips (alike / acceptable risk). */
  stiRisk: string[]
  experience: 'new' | 'some' | 'experienced'
  likert: Record<string, number>
  note?: string
  /** @deprecated v1 field retained for migration */
  flavors?: string[]
  /** @deprecated migrated into stiRisk */
  stiPref?: 'disclose_yes' | 'want_theirs' | 'optional' | 'skip_nonsexual'
}

export type QuizPage =
  | {
      id: string
      title: string
      subtitle?: string
      kind: 'chips'
      field: 'moods' | 'aftercare' | 'stiRisk' | 'playWith' | 'iAm'
      min?: number
      max?: number
      options: { id: string; label: string }[]
    }
  | {
      id: string
      title: string
      subtitle?: string
      kind: 'choice'
      field: 'intent' | 'experience' | 'roleTonight' | 'marksOk' | 'checkIns' | 'escalate' | 'signals'
      options: { id: string; label: string; hint?: string }[]
    }
  | {
      id: string
      title: string
      subtitle?: string
      kind: 'catalog'
      /** seeking | offering | maybe | hardNos */
      buckets: Array<'seeking' | 'offering' | 'maybe' | 'hardNos'>
    }
  | {
      id: string
      title: string
      subtitle?: string
      kind: 'likert'
      items: { id: string; statement: string }[]
    }
  | {
      id: string
      title: string
      subtitle?: string
      kind: 'note'
      field: 'note'
      placeholder: string
    }

/** @deprecated — use PICKUP_PLAY_FEELINGS / catalog */
export const PICKUP_PLAY_MOODS = PICKUP_PLAY_FEELINGS

/** @deprecated — use PICKUP_PLAY_CATALOG */
export const PICKUP_PLAY_FLAVORS = PICKUP_PLAY_CATALOG.map((i) => ({ id: i.id, label: i.label }))

export const PICKUP_PLAY_LIKERT_ITEMS: {
  id: string
  statement: string
  score: 'similar' | 'lead' | 'follow'
}[] = [
  {
    id: 'intensity',
    statement: 'Tonight I want intensity — sweaty, focused play, not a gentle hang.',
    score: 'similar',
  },
  {
    id: 'lead',
    statement: 'I’m glad to lead negotiation, hold the container, and drive the scene.',
    score: 'lead',
  },
  {
    id: 'follow',
    statement: 'I want someone else to lead negotiation and hold the container tonight.',
    score: 'follow',
  },
  {
    id: 'switchy',
    statement: 'I can flip roles depending on chemistry and what my partner needs.',
    score: 'similar',
  },
  {
    id: 'negotiation_depth',
    statement: 'I want a thorough negotiation before we start — limits, signals, and outs on the table.',
    score: 'similar',
  },
  {
    id: 'soft_limit_pace',
    statement: 'I’m open to approaching soft limits slowly if we check in clearly along the way.',
    score: 'similar',
  },
  {
    id: 'public_ok',
    statement: 'I’m comfortable with play that others at the event might see (within house rules).',
    score: 'similar',
  },
  {
    id: 'aftercare_need',
    statement: 'Aftercare / a real check-in after play matters a lot to me tonight.',
    score: 'similar',
  },
  {
    id: 'short_scene',
    statement: 'I’m looking for a short pickup scene, not a hours-long commitment.',
    score: 'similar',
  },
  {
    id: 'risk_aware',
    statement: 'I treat risk-aware negotiation as non-negotiable, even for “just a little” play.',
    score: 'similar',
  },
  {
    id: 'meet_effort',
    statement: 'I’m actively trying to meet play partners at this event and will put in the effort.',
    score: 'similar',
  },
  {
    id: 'debrief_next',
    statement: 'I want a real debrief later (same night or next day) — what worked, what to change.',
    score: 'similar',
  },
]

export const PICKUP_PLAY_PAGES: QuizPage[] = [
  {
    id: 'role',
    title: 'Tonight I want to show up as…',
    subtitle: 'Like a negotiation starter — you can still switch with chemistry.',
    kind: 'choice',
    field: 'roleTonight',
    options: [
      { id: 'top', label: 'Top / dominant energy', hint: 'More giving structure, impact, restraint, lead.' },
      { id: 'bottom', label: 'Bottom / receptive energy', hint: 'More receiving, following, being held.' },
      { id: 'switch', label: 'Switch / flexible', hint: 'Happy to negotiate either way.' },
    ],
  },
  {
    id: 'playWith',
    title: 'I prefer to play with…',
    subtitle:
      'Who you want in the deck. Multi-select is fine. “Anyone” skips gender filtering. This is about fit, not a purity test.',
    kind: 'chips',
    field: 'playWith',
    min: 1,
    max: 10,
    options: [...PICKUP_PLAY_WITH],
  },
  {
    id: 'iAm',
    title: 'For matching tonight, I show up as…',
    subtitle:
      'So other people’s filters can find you. Scene-scoped only — does not change your profile. Pick all that apply.',
    kind: 'chips',
    field: 'iAm',
    min: 1,
    max: 6,
    options: [...PICKUP_PLAY_I_AM],
  },
  {
    id: 'moods',
    title: 'I want the scene to feel…',
    subtitle:
      'Emotional tone and headspace — not the toy list. Pick several; negotiate the specifics in person.',
    kind: 'chips',
    field: 'moods',
    min: 1,
    max: 16,
    options: [...PICKUP_PLAY_FEELINGS],
  },
  {
    id: 'intent',
    title: 'Sexual vs non-sexual — what’s on the table?',
    kind: 'choice',
    field: 'intent',
    options: [
      {
        id: 'non_sexual',
        label: 'Non-sexual only',
        hint: 'Skill, rope, sensation, social — keep genital/sexual contact off.',
      },
      {
        id: 'open_to_sexual',
        label: 'Open either way',
        hint: 'Chemistry + negotiation decide.',
      },
      {
        id: 'sexual_focus',
        label: 'Sexual play is a goal',
        hint: 'Still negotiated, consensual, and venue-legal.',
      },
    ],
  },
  {
    id: 'catalog',
    title: 'Negotiation menu — seeking, offering, maybe, hard nos',
    subtitle:
      'Seeking = receive / bottom energy. Offering = give / top energy. Browse the full menu — including edge & taboo — so you can soft-yes or hard-no them. Venue rules still win.',
    kind: 'catalog',
    buckets: ['seeking', 'offering', 'maybe', 'hardNos'],
  },
  {
    id: 'likert_vibe',
    title: 'To what extent do you agree with each statement?',
    kind: 'likert',
    items: PICKUP_PLAY_LIKERT_ITEMS.slice(0, 6).map(({ id, statement }) => ({ id, statement })),
  },
  {
    id: 'marks',
    title: 'Marks — what are you okay with tonight?',
    kind: 'choice',
    field: 'marksOk',
    options: [
      { id: 'none', label: 'No visible marks', hint: 'Keep it bruise-light / mark-free.' },
      { id: 'today', label: 'Marks for today are fine', hint: 'Coverable by tomorrow is ideal.' },
      { id: 'week', label: 'Marks for the week are fine', hint: 'Discuss placement.' },
      { id: 'discuss', label: 'Discuss per scene', hint: 'Depends on chemistry and clothing.' },
    ],
  },
  {
    id: 'checkIns',
    title: 'Check-ins during play',
    subtitle: 'From negotiation checklists: some people need them; others get pulled out of headspace.',
    kind: 'choice',
    field: 'checkIns',
    options: [
      {
        id: 'welcome',
        label: 'Check-ins welcome',
        hint: 'Verbal pauses / “color?” style check-ins are good.',
      },
      {
        id: 'minimal',
        label: 'Keep check-ins minimal',
        hint: 'Prefer safewords + reading body language unless something feels off.',
      },
      {
        id: 'discuss',
        label: 'Discuss per scene',
        hint: 'Depends on intensity and partner.',
      },
    ],
  },
  {
    id: 'escalate',
    title: 'Escalation if things are going well',
    kind: 'choice',
    field: 'escalate',
    options: [
      {
        id: 'ask_first',
        label: 'Ask before escalating',
        hint: 'Check in before turning intensity up.',
      },
      {
        id: 'within_limits',
        label: 'Escalate inside what we negotiated',
        hint: 'Once the envelope is clear, don’t pause for every notch.',
      },
      {
        id: 'discuss',
        label: 'Discuss per scene',
        hint: 'Chemistry and activity decide.',
      },
    ],
  },
  {
    id: 'signals',
    title: 'Safewords & signals',
    subtitle: 'You’ll still set specifics in person — this is about style fit.',
    kind: 'choice',
    field: 'signals',
    options: [
      {
        id: 'traffic_light',
        label: 'Traffic light (green / yellow / red)',
        hint: 'Common dungeon default.',
      },
      {
        id: 'custom_word',
        label: 'Custom safeword',
        hint: 'Prefer a word/phrase we pick together.',
      },
      {
        id: 'nonverbal_ready',
        label: 'Non-verbal signal ready',
        hint: 'Gags / subspace — taps, drop object, etc.',
      },
      {
        id: 'discuss',
        label: 'Figure it out together',
        hint: 'Flexible — just don’t skip it.',
      },
    ],
  },
  {
    id: 'aftercare',
    title: 'Aftercare I may want',
    subtitle:
      'How you want to land — water and blankets, kisses and massage, a nap, or erotic cool-down. Pick several.',
    kind: 'chips',
    field: 'aftercare',
    min: 0,
    max: 20,
    options: [...PICKUP_PLAY_AFTERCARE],
  },
  {
    id: 'likert_safety',
    title: 'Logistics, visibility, and effort',
    kind: 'likert',
    items: PICKUP_PLAY_LIKERT_ITEMS.slice(6).map(({ id, statement }) => ({ id, statement })),
  },
  {
    id: 'sti',
    title: 'Sexual-health risk profile',
    subtitle:
      'Match on alike or acceptable risk — not shame. Pick what you’re open to negotiate; talk details in person.',
    kind: 'chips',
    field: 'stiRisk',
    min: 1,
    max: 8,
    options: PICKUP_PLAY_STI_RISK.map(({ id, label }) => ({ id, label })),
  },
  {
    id: 'experience',
    title: 'Pickup-play experience',
    kind: 'choice',
    field: 'experience',
    options: [
      { id: 'new', label: 'New to pickup play', hint: 'Prefer patient partners who negotiate clearly.' },
      { id: 'some', label: 'Some experience', hint: 'Comfortable with event norms.' },
      { id: 'experienced', label: 'Experienced', hint: 'Happy to play with a range of experience levels.' },
    ],
  },
  {
    id: 'note',
    title: 'Optional notes for partners',
    subtitle:
      'Catch-all for what chips can’t say: injuries, access needs, gear you brought, languages, custom safewords, or “ask me about X.” Skip if nothing to add.',
    kind: 'note',
    field: 'note',
    placeholder:
      'e.g. bad left shoulder, brought a flogger, ASL ok, yellow = slow not stop, ask me about rope experience…',
  },
]

export const DEFAULT_PICKUP_PLAY_FORM_SCHEMA = {
  kind: PICKUP_PLAY_QUIZ_VERSION,
  title: 'Pickup play matchmaker',
  description:
    'Negotiation-style matching: feelings, seeking/offering, marks, aftercare, and sexual-health risk profile.',
} as const

export function emptyPickupPlayAnswers(): PickupPlayAnswers {
  return {
    version: PICKUP_PLAY_QUIZ_VERSION,
    roleTonight: 'switch',
    playWith: ['anyone'],
    iAm: ['prefer_not'],
    moods: [],
    intent: 'open_to_sexual',
    seeking: [],
    offering: [],
    maybe: [],
    hardNos: [],
    marksOk: 'discuss',
    checkIns: 'discuss',
    escalate: 'discuss',
    signals: 'discuss',
    aftercare: [],
    stiRisk: ['discuss_before'],
    experience: 'some',
    likert: {},
    note: '',
  }
}

function migrateStiPref(raw: unknown): string[] {
  if (Array.isArray(raw)) return asStringArr(raw)
  if (raw === 'skip_nonsexual') return ['skip_nonsexual']
  if (raw === 'disclose_yes' || raw === 'want_theirs') return ['discuss_before', 'same_profile_prefer']
  if (raw === 'optional') return ['discuss_before']
  return ['discuss_before']
}

/** Normalize v1 or partial payloads into v2. */
export function normalizePickupPlayAnswers(raw: unknown): PickupPlayAnswers | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== PICKUP_PLAY_QUIZ_VERSION && o.version !== PICKUP_PLAY_QUIZ_VERSION_V1) {
    // Legacy tag prototype
    if (Array.isArray(o.seeking) || Array.isArray(o.offering)) {
      const base = emptyPickupPlayAnswers()
      return {
        ...base,
        seeking: asStringArr(o.seeking),
        offering: asStringArr(o.offering),
        moods: asStringArr(o.roles).length ? asStringArr(o.roles) : base.moods,
      }
    }
    return null
  }

  const base = emptyPickupPlayAnswers()
  const flavors = asStringArr(o.flavors)
  const seeking = asStringArr(o.seeking).length ? asStringArr(o.seeking) : flavors
  const offering = asStringArr(o.offering).length ? asStringArr(o.offering) : flavors

  return {
    ...base,
    roleTonight:
      o.roleTonight === 'top' || o.roleTonight === 'bottom' || o.roleTonight === 'switch' ?
        o.roleTonight
      : 'switch',
    playWith: asStringArr(o.playWith).length ? asStringArr(o.playWith) : base.playWith,
    iAm: asStringArr(o.iAm).length ? asStringArr(o.iAm) : base.iAm,
    moods: asStringArr(o.moods),
    intent:
      o.intent === 'non_sexual' || o.intent === 'sexual_focus' || o.intent === 'open_to_sexual' ?
        o.intent
      : 'open_to_sexual',
    seeking,
    offering,
    maybe: asStringArr(o.maybe),
    hardNos: asStringArr(o.hardNos),
    marksOk:
      o.marksOk === 'none' || o.marksOk === 'today' || o.marksOk === 'week' || o.marksOk === 'discuss' ?
        o.marksOk
      : 'discuss',
    checkIns:
      o.checkIns === 'welcome' || o.checkIns === 'minimal' || o.checkIns === 'discuss' ?
        o.checkIns
      : 'discuss',
    escalate:
      o.escalate === 'ask_first' || o.escalate === 'within_limits' || o.escalate === 'discuss' ?
        o.escalate
      : 'discuss',
    signals:
      o.signals === 'traffic_light' ||
      o.signals === 'custom_word' ||
      o.signals === 'nonverbal_ready' ||
      o.signals === 'discuss' ?
        o.signals
      : 'discuss',
    aftercare: asStringArr(o.aftercare),
    stiRisk:
      Array.isArray(o.stiRisk) && o.stiRisk.length ?
        asStringArr(o.stiRisk)
      : migrateStiPref(o.stiPref),
    experience:
      o.experience === 'new' || o.experience === 'some' || o.experience === 'experienced' ?
        o.experience
      : 'some',
    likert: typeof o.likert === 'object' && o.likert ? (o.likert as Record<string, number>) : {},
    note: typeof o.note === 'string' ? o.note : '',
  }
}

export function isPickupPlayAnswers(v: unknown): v is PickupPlayAnswers {
  return normalizePickupPlayAnswers(v) != null
}

function clampLikert(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (n < 1 || n > 7) return null
  return n
}

function chipOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const as = new Set(a.map((x) => x.toLowerCase()))
  const hit = b.filter((x) => as.has(x.toLowerCase())).length
  return hit / Math.max(as.size, b.length)
}

/** Jaccard-ish with soft credit when either side is large. */
function menuFit(seeking: string[], offering: string[]): number {
  if (!seeking.length || !offering.length) return 0
  const offer = new Set(offering)
  const hits = seeking.filter((id) => offer.has(id)).length
  return hits / seeking.length
}

function similarLikert(a: number, b: number): number {
  return 1 - Math.min(1, Math.abs(a - b) / 6)
}

function complementLeadFollow(aLead: number, aFollow: number, bLead: number, bFollow: number): number {
  const pair1 = (aLead / 7) * (bFollow / 7)
  const pair2 = (bLead / 7) * (aFollow / 7)
  return Math.max(pair1, pair2)
}

function roleComplement(a: PickupPlayAnswers['roleTonight'], b: PickupPlayAnswers['roleTonight']): number {
  if (a === 'switch' || b === 'switch') return 0.85
  if (a === b) return 0.45
  return 1
}

/** Soft fit for negotiation-style enums; "discuss" is compatible with anything. */
function negoStyleFit(a: string, b: string): number {
  if (a === b) return 0.95
  if (a === 'discuss' || b === 'discuss') return 0.8
  // Opposite poles on check-ins / escalate
  if (
    (a === 'welcome' && b === 'minimal') ||
    (a === 'minimal' && b === 'welcome') ||
    (a === 'ask_first' && b === 'within_limits') ||
    (a === 'within_limits' && b === 'ask_first')
  ) {
    return 0.4
  }
  return 0.7
}

/** Which self-tags satisfy a “play with” preference. Soft tags match anyone. */
const PLAY_WITH_ACCEPTS: Record<string, readonly string[] | '*'> = {
  anyone: '*',
  open_exploring: '*',
  discuss_gender: '*',
  bi_curious_partners: '*',
  men: ['man', 'trans_man'],
  women: ['woman', 'trans_woman'],
  nonbinary: ['nonbinary', 'genderfluid', 'queer_gender'],
  trans_masc: ['trans_man'],
  trans_fem: ['trans_woman'],
  amab: ['amab'],
  afab: ['afab'],
  intersex: ['intersex'],
  queer_gender: ['queer_gender', 'nonbinary', 'genderfluid'],
}

/** One-way: does `playWith` accept someone who tagged `iAm`? */
export function playWithAcceptsIdentity(playWith: string[], iAm: string[]): boolean {
  const prefs = playWith.length ? playWith : ['anyone']
  if (prefs.includes('anyone') || prefs.includes('open_exploring') || prefs.includes('discuss_gender')) {
    return true
  }
  // Prefer-not / empty self-tags only match open filters (handled above)
  const identity = new Set(iAm.filter((t) => t !== 'prefer_not'))
  if (identity.size === 0) return false
  for (const pref of prefs) {
    const accepts = PLAY_WITH_ACCEPTS[pref]
    if (!accepts) continue
    if (accepts === '*') return true
    if (accepts.some((tag) => identity.has(tag))) return true
  }
  return false
}

/** Mutual gender / identity fit for the deck (both directions required). */
export function mutualPlayIdentityFit(a: PickupPlayAnswers, b: PickupPlayAnswers): number {
  const ab = playWithAcceptsIdentity(a.playWith, b.iAm)
  const ba = playWithAcceptsIdentity(b.playWith, a.iAm)
  return ab && ba ? 1 : 0
}

/**
 * Score two pickup-play profiles. Returns 0–1.
 * Primary signal: A.seeking ∩ B.offering and B.seeking ∩ A.offering.
 * Hard-nos against the other person's seeking/offering heavily penalize.
 */
export function scorePickupPlayAnswers(aRaw: unknown, bRaw: unknown): number {
  const a = normalizePickupPlayAnswers(aRaw)
  const b = normalizePickupPlayAnswers(bRaw)
  if (!a || !b) return scoreLegacyFallback(aRaw, bRaw)

  if (
    (a.intent === 'non_sexual' && b.intent === 'sexual_focus') ||
    (b.intent === 'non_sexual' && a.intent === 'sexual_focus')
  ) {
    return 0.05
  }

  // Hard-no collisions
  const aNos = new Set(a.hardNos)
  const bNos = new Set(b.hardNos)
  const aHitsNo = [...b.seeking, ...b.offering].some((id) => aNos.has(id))
  const bHitsNo = [...a.seeking, ...a.offering].some((id) => bNos.has(id))
  if (aHitsNo || bHitsNo) return 0.08

  const identityFit = mutualPlayIdentityFit(a, b)
  if (identityFit === 0) return 0.04

  let stiBoost = 0
  const aSkipSti = a.stiRisk.includes('skip_nonsexual')
  const bSkipSti = b.stiRisk.includes('skip_nonsexual')
  const sexualLikely = a.intent !== 'non_sexual' && b.intent !== 'non_sexual' && !aSkipSti && !bSkipSti
  if (sexualLikely) {
    const aRisk = a.stiRisk.filter((id) => id !== 'skip_nonsexual')
    const bRisk = b.stiRisk.filter((id) => id !== 'skip_nonsexual')
    const overlap = chipOverlap(aRisk, bRisk)
    stiBoost = 0.04 + 0.12 * overlap
    // Prefer similar posture when either side asks for it
    if (aRisk.includes('same_profile_prefer') || bRisk.includes('same_profile_prefer')) {
      stiBoost += 0.06 * overlap
    }
    // Clear-panel preference vs informed-HSV-only with no discuss can be a soft mismatch
    if (
      (aRisk.includes('prefer_recent_clear') && !bRisk.includes('prefer_recent_clear') && !bRisk.includes('discuss_before')) ||
      (bRisk.includes('prefer_recent_clear') && !aRisk.includes('prefer_recent_clear') && !aRisk.includes('discuss_before'))
    ) {
      stiBoost -= 0.05
    }
  } else if (aSkipSti && bSkipSti) {
    stiBoost = 0.04
  }

  const parts: number[] = []

  // Core negotiation fit
  const ab = menuFit(a.seeking, b.offering)
  const ba = menuFit(b.seeking, a.offering)
  const seekOffer = (ab + ba) / 2
  parts.push(0.35 + 0.65 * seekOffer)

  // Soft yes overlap
  const maybeOverlap = chipOverlap(
    [...a.maybe, ...a.seeking],
    [...b.maybe, ...b.seeking, ...b.offering],
  )
  parts.push(0.4 + 0.4 * maybeOverlap)

  parts.push(0.5 + 0.5 * chipOverlap(a.moods, b.moods))
  parts.push(roleComplement(a.roleTonight, b.roleTonight))
  parts.push(identityFit)

  if (a.intent === b.intent) parts.push(1)
  else if (a.intent === 'open_to_sexual' || b.intent === 'open_to_sexual') parts.push(0.75)
  else parts.push(0.35)

  if (a.marksOk === b.marksOk) parts.push(0.9)
  else if (a.marksOk === 'discuss' || b.marksOk === 'discuss') parts.push(0.75)
  else if (
    (a.marksOk === 'none' && (b.marksOk === 'week' || b.marksOk === 'today')) ||
    (b.marksOk === 'none' && (a.marksOk === 'week' || a.marksOk === 'today'))
  ) {
    parts.push(0.35)
  } else parts.push(0.65)

  parts.push(0.5 + 0.5 * chipOverlap(a.aftercare, b.aftercare))

  // Negotiation style fit (checklists: check-ins, escalation, signals)
  parts.push(negoStyleFit(a.checkIns, b.checkIns))
  parts.push(negoStyleFit(a.escalate, b.escalate))
  parts.push(negoStyleFit(a.signals, b.signals))

  const aLead = clampLikert(a.likert.lead)
  const aFollow = clampLikert(a.likert.follow)
  const bLead = clampLikert(b.likert.lead)
  const bFollow = clampLikert(b.likert.follow)
  if (aLead != null && aFollow != null && bLead != null && bFollow != null) {
    parts.push(complementLeadFollow(aLead, aFollow, bLead, bFollow))
  }

  for (const item of PICKUP_PLAY_LIKERT_ITEMS) {
    if (item.score !== 'similar') continue
    const av = clampLikert(a.likert[item.id])
    const bv = clampLikert(b.likert[item.id])
    if (av == null || bv == null) continue
    parts.push(similarLikert(av, bv))
  }

  if (a.experience === b.experience) parts.push(0.85)
  else if (a.experience === 'new' || b.experience === 'new') parts.push(0.7)
  else parts.push(0.8)

  if (parts.length === 0) return 0
  const base = parts.reduce((s, n) => s + n, 0) / parts.length
  return Math.max(0, Math.min(1, base + stiBoost))
}

function scoreLegacyFallback(a: unknown, b: unknown): number {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return 0
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const parts: number[] = []
  const seekOffer =
    (chipOverlap(asStringArr(ao.seeking), asStringArr(bo.offering)) +
      chipOverlap(asStringArr(bo.seeking), asStringArr(ao.offering))) /
    2
  if (seekOffer > 0) parts.push(seekOffer)
  for (const k of Object.keys(ao)) {
    if (k === 'seeking' || k === 'offering' || k === 'notes' || k === 'note') continue
    if (!(k in bo)) continue
    const x = ao[k]
    const y = bo[k]
    if (Array.isArray(x) && Array.isArray(y)) parts.push(chipOverlap(x.map(String), y.map(String)))
    else if (typeof x === 'number' && typeof y === 'number') parts.push(similarLikert(x, y))
    else if (x === y) parts.push(1)
  }
  if (parts.length === 0) return 0
  return parts.reduce((s, n) => s + n, 0) / parts.length
}

function asStringArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : []
}

const ROLE_LABELS: Record<PickupPlayAnswers['roleTonight'], string> = {
  top: 'Top or leading',
  bottom: 'Bottom or receiving',
  switch: 'Switch or flexible',
}

const INTENT_LABELS: Record<PickupPlayAnswers['intent'], string> = {
  non_sexual: 'Non-sexual only',
  open_to_sexual: 'Open either way',
  sexual_focus: 'Sexual play is a goal',
}

const MARKS_LABELS: Record<PickupPlayAnswers['marksOk'], string> = {
  none: 'No marks',
  today: 'Marks that fade today',
  week: 'Marks that may last about a week',
  discuss: 'Discuss case by case',
}

const CHECKIN_LABELS: Record<PickupPlayAnswers['checkIns'], string> = {
  welcome: 'Frequent check-ins welcome',
  minimal: 'Minimal verbal check-ins',
  discuss: 'Discuss before the scene',
}

const ESCALATE_LABELS: Record<PickupPlayAnswers['escalate'], string> = {
  ask_first: 'Ask before each meaningful escalation',
  within_limits: 'Escalation okay within negotiated limits',
  discuss: 'Discuss before the scene',
}

const SIGNAL_LABELS: Record<PickupPlayAnswers['signals'], string> = {
  traffic_light: 'Traffic-light system',
  custom_word: 'Custom safeword',
  nonverbal_ready: 'Nonverbal signals prepared',
  discuss: 'Discuss before the scene',
}

const EXPERIENCE_LABELS: Record<PickupPlayAnswers['experience'], string> = {
  new: 'New to pickup play',
  some: 'Some experience',
  experienced: 'Very experienced',
}

function chipLabels(ids: string[], opts: readonly { id: string; label: string }[]): string[] {
  return ids.map((id) => opts.find((o) => o.id === id)?.label ?? id)
}

/** Human overview for returning users — no health chips or hard-no lists. */
export function pickupPlayHumanOverview(answers: PickupPlayAnswers): {
  showingUp: string
  lookingFor: string
  sceneFeel: string
  menu: string
  communication: string
  careComplete: boolean
} {
  const n = normalizePickupPlayAnswers(answers) ?? answers
  const moods = chipLabels(n.moods, PICKUP_PLAY_FEELINGS).slice(0, 4)
  const playWith = chipLabels(n.playWith, PICKUP_PLAY_WITH).slice(0, 5)
  return {
    showingUp: `${ROLE_LABELS[n.roleTonight]} · ${INTENT_LABELS[n.intent]}`,
    lookingFor: playWith.join(', ') || 'Not set',
    sceneFeel: moods.join(' · ') || 'Not set',
    menu: `${n.seeking.length} seeking · ${n.offering.length} offering · ${n.maybe.length} maybe`,
    communication: `${ESCALATE_LABELS[n.escalate]} · ${SIGNAL_LABELS[n.signals]}`,
    careComplete: Boolean(n.stiRisk.length && n.experience),
  }
}

/** Full private review lines — human labels only, never raw enum IDs. */
export function pickupPlayAnswerSummary(answers: PickupPlayAnswers): string[] {
  const n = normalizePickupPlayAnswers(answers) ?? answers
  const label = (id: string) => CATALOG_BY_ID[id]?.label ?? id
  const lines: string[] = []
  lines.push(`Showing up: ${ROLE_LABELS[n.roleTonight]}`)
  lines.push(`Play on the table: ${INTENT_LABELS[n.intent]}`)
  if (n.iAm.length) lines.push(`Matching as: ${chipLabels(n.iAm, PICKUP_PLAY_I_AM).slice(0, 6).join(', ')}`)
  if (n.playWith.length) {
    lines.push(`Deck includes: ${chipLabels(n.playWith, PICKUP_PLAY_WITH).slice(0, 8).join(', ')}`)
  }
  if (n.moods.length) {
    lines.push(`Scene feel: ${chipLabels(n.moods, PICKUP_PLAY_FEELINGS).slice(0, 8).join(', ')}`)
  }
  if (n.seeking.length) lines.push(`Seeking: ${n.seeking.slice(0, 8).map(label).join(', ')}`)
  if (n.offering.length) lines.push(`Offering: ${n.offering.slice(0, 8).map(label).join(', ')}`)
  if (n.maybe.length) lines.push(`Maybe: ${n.maybe.slice(0, 6).map(label).join(', ')}`)
  lines.push(`Hard nos: ${n.hardNos.length ? `${n.hardNos.length} selected` : 'None listed'}`)
  lines.push(`Marks: ${MARKS_LABELS[n.marksOk]}`)
  lines.push(`Check-ins: ${CHECKIN_LABELS[n.checkIns]}`)
  lines.push(`Escalation: ${ESCALATE_LABELS[n.escalate]}`)
  lines.push(`Signals: ${SIGNAL_LABELS[n.signals]}`)
  if (n.aftercare.length) {
    lines.push(`Aftercare: ${chipLabels(n.aftercare, PICKUP_PLAY_AFTERCARE).slice(0, 6).join(', ')}`)
  }
  lines.push(`Sexual-health conversation: completed`)
  lines.push(`Experience: ${EXPERIENCE_LABELS[n.experience]}`)
  if (n.note?.trim()) lines.push('Optional note: added')
  return lines
}

export type MatchmakerFitBand = 'strong' | 'promising' | 'some'

export function matchmakerFitBand(score: number): MatchmakerFitBand {
  if (score >= 0.72) return 'strong'
  if (score >= 0.55) return 'promising'
  return 'some'
}

export function matchmakerFitBandLabel(band: MatchmakerFitBand): string {
  if (band === 'strong') return 'Strong fit'
  if (band === 'promising') return 'Promising fit'
  return 'Some overlap'
}

/** Minimum score to appear in deck (below = safety/compat floor). */
export const MATCHMAKER_DECK_MIN_SCORE = 0.2

/**
 * Privacy-safe deck explanation. Never includes hard nos, STI/risk chips,
 * identity-filter logic, or private notes.
 */
export function buildMatchmakerDeckSummary(
  viewerRaw: unknown,
  otherRaw: unknown,
): {
  score: number
  fitBand: MatchmakerFitBand
  reasons: string[]
  sceneFeel: string[]
} {
  const score = scorePickupPlayAnswers(viewerRaw, otherRaw)
  const a = normalizePickupPlayAnswers(viewerRaw)
  const b = normalizePickupPlayAnswers(otherRaw)
  const fitBand = matchmakerFitBand(score)
  const reasons: string[] = []
  const sceneFeel: string[] = []
  if (!a || !b) {
    return { score, fitBand, reasons, sceneFeel }
  }

  if (a.roleTonight === 'top' && b.roleTonight === 'bottom') {
    reasons.push('Their receiving energy complements your leading energy tonight')
  } else if (a.roleTonight === 'bottom' && b.roleTonight === 'top') {
    reasons.push('Their leading energy complements your receiving energy tonight')
  } else if (a.roleTonight === 'switch' || b.roleTonight === 'switch') {
    reasons.push('Flexible role energy that can negotiate either direction')
  } else if (a.roleTonight === b.roleTonight) {
    reasons.push('Similar role energy for tonight — negotiate who leads what')
  }

  const sharedActs = [
    ...a.seeking.filter((id) => b.offering.includes(id)),
    ...a.offering.filter((id) => b.seeking.includes(id)),
  ]
  const uniqueActs = [...new Set(sharedActs)]
    .map((id) => CATALOG_BY_ID[id]?.label)
    .filter((x): x is string => Boolean(x))
    .slice(0, 2)
  if (uniqueActs.length) {
    reasons.push(`Shared interest in ${uniqueActs.join(' and ')}`)
  }

  const sharedMoods = a.moods.filter((id) => b.moods.includes(id))
  for (const id of sharedMoods.slice(0, 3)) {
    const lab = PICKUP_PLAY_FEELINGS.find((x) => x.id === id)?.label
    if (lab) sceneFeel.push(lab)
  }
  if (sceneFeel.length >= 2) {
    reasons.push(`Similar scene feel: ${sceneFeel.slice(0, 2).join(' and ')}`)
  }

  if (a.checkIns === b.checkIns && a.checkIns !== 'discuss') {
    reasons.push(
      a.checkIns === 'welcome'
        ? 'Similar preference for clear check-ins'
        : 'Similar preference for quieter mid-scene check-ins',
    )
  }

  if (a.intent === b.intent) {
    if (a.intent === 'non_sexual') reasons.push('Both prefer non-sexual play tonight')
    else if (a.intent === 'open_to_sexual') reasons.push('Both open either way sexually')
    else reasons.push('Both treating sexual play as a goal tonight')
  }

  const aNeg = a.likert.negotiation_depth
  const bNeg = b.likert.negotiation_depth
  if (typeof aNeg === 'number' && typeof bNeg === 'number' && Math.abs(aNeg - bNeg) <= 1 && aNeg >= 5) {
    reasons.push('Similar preference for thorough negotiation')
  }

  const aCare = a.likert.aftercare_need
  const bCare = b.likert.aftercare_need
  if (typeof aCare === 'number' && typeof bCare === 'number' && Math.abs(aCare - bCare) <= 1 && aCare >= 5) {
    reasons.push('Similar preference for aftercare and check-in')
  }

  return {
    score,
    fitBand,
    reasons: reasons.slice(0, 3),
    sceneFeel: sceneFeel.slice(0, 3),
  }
}

export function isMatchmakerSetupComplete(answers: unknown): boolean {
  const n = normalizePickupPlayAnswers(answers)
  if (!n) return false
  for (const page of PICKUP_PLAY_PAGES) {
    if (page.id === 'note' || page.id === 'aftercare') continue
    if (!quizPageComplete(page, n)) return false
  }
  return true
}

export function quizPageComplete(page: QuizPage, answers: PickupPlayAnswers): boolean {
  const n = normalizePickupPlayAnswers(answers) ?? answers
  if (page.kind === 'chips') {
    const vals = n[page.field]
    const min = page.min ?? 1
    return vals.length >= min
  }
  if (page.kind === 'choice') {
    return Boolean(n[page.field])
  }
  if (page.kind === 'catalog') {
    // Need at least one seeking or offering to match on
    return n.seeking.length + n.offering.length >= 1
  }
  if (page.kind === 'likert') {
    return page.items.every((it) => clampLikert(n.likert[it.id]) != null)
  }
  return true
}

export function catalogItemsForCategory(category: CatalogCategoryId) {
  return PICKUP_PLAY_CATALOG.filter((i) => i.category === category)
}
