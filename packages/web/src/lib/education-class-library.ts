import type { ApiEducationArticle } from '@/lib/education-article-types'

export type ClassFormat = 'workshop' | 'demo' | 'lecture' | 'lab'

export type EducationClassOutline = {
  id: string
  title: string
  href: string
  format: ClassFormat
  level: string
  topic: string
  durationLabel: string
  sectionCount: number
  educatorHandle: string
  educatorName: string | null
  summary: string
  heroImageUrl: string | null
  tags: string[]
  featured?: boolean
}

export const CLASS_FORMAT_META: Record<ClassFormat, { label: string; icon: string }> = {
  workshop: { label: 'Workshop', icon: '🎓' },
  demo: { label: 'Demo', icon: '▶️' },
  lecture: { label: 'Lecture', icon: '📖' },
  lab: { label: 'Hands-on lab', icon: '🧪' },
}

const FORMAT_ORDER: ClassFormat[] = ['workshop', 'demo', 'lecture', 'lab']

function inferFormat(article: ApiEducationArticle): ClassFormat {
  const haystack = `${article.title} ${(article.categories ?? []).join(' ')}`.toLowerCase()
  if (/embed|video|walkthrough|demo/.test(haystack) || /youtube\.com\/embed/i.test(article.bodyHtml ?? '')) {
    return 'demo'
  }
  if (/rope|gear|floor|lab|hands-on|technique/.test(haystack)) return 'lab'
  if (/framework|101|essentials|fundamentals|ssc|rack/.test(haystack)) return 'lecture'
  return 'workshop'
}

function sessionDuration(article: ApiEducationArticle): string {
  const minutes = article.readingMinutes
  if (minutes == null || minutes < 1) return '60 min session'
  const session = Math.max(45, Math.min(120, minutes * 12))
  return `${session} min session`
}

function sectionCount(article: ApiEducationArticle): number {
  const minutes = article.readingMinutes ?? 4
  return Math.max(3, Math.min(6, Math.round(minutes / 2) + 2))
}

function articleToClassOutline(article: ApiEducationArticle, featured = false): EducationClassOutline {
  const topic = article.categories[0] ?? 'Education'
  return {
    id: article.id,
    title: article.title,
    href: `/education/${encodeURIComponent(article.slug)}`,
    format: inferFormat(article),
    level: article.difficulty ?? 'All levels',
    topic,
    durationLabel: sessionDuration(article),
    sectionCount: sectionCount(article),
    educatorHandle: article.authorUsername,
    educatorName: article.authorDisplayName,
    summary: article.excerpt ?? 'Session outline with educator notes and practice prompts.',
    heroImageUrl: article.heroImageUrl,
    tags: article.categories.slice(0, 3),
    featured,
  }
}

/** Demo outlines when the hub catalogue is empty (logged-out mock). */
export const MOCK_CLASS_OUTLINES: EducationClassOutline[] = [
  {
    id: 'mock-negotiation-lab',
    title: 'Negotiation role-play lab',
    href: '/education?view=articles',
    format: 'lab',
    level: 'Beginner',
    topic: 'Consent',
    durationLabel: '75 min session',
    sectionCount: 5,
    educatorHandle: 'RopeDreamer',
    educatorName: 'Rope Dreamer',
    summary: 'Pair exercises for naming limits, desires, and aftercare — facilitator script included.',
    heroImageUrl: null,
    tags: ['Beginner', 'Consent', 'Safety'],
    featured: true,
  },
  {
    id: 'mock-floor-rope',
    title: 'Floor rope fundamentals',
    href: '/education?view=articles',
    format: 'lab',
    level: 'Beginner',
    topic: 'Rope',
    durationLabel: '90 min session',
    sectionCount: 6,
    educatorHandle: 'RopeDreamer',
    educatorName: 'Rope Dreamer',
    summary: 'Body mechanics, frictions, and safety shears. Mat work suitable for first-time riggers.',
    heroImageUrl: null,
    tags: ['Gear', 'Safety'],
    featured: true,
  },
  {
    id: 'mock-munch-etiquette',
    title: 'Event etiquette at munches',
    href: '/education?view=articles',
    format: 'lecture',
    level: 'All levels',
    topic: 'Event Etiquette',
    durationLabel: '45 min session',
    sectionCount: 4,
    educatorHandle: 'LeatherCraftDemo',
    educatorName: 'Leather Craft Demo',
    summary: 'How to introduce yourself, read the room, and respect venue staff.',
    heroImageUrl: '/landing/marcin-sajur-3uwcD9V0O1k.jpg',
    tags: ['Event Etiquette'],
  },
  {
    id: 'mock-consent-checkins',
    title: 'Consent check-ins that actually stick',
    href: '/education?view=articles',
    format: 'demo',
    level: 'Intermediate',
    topic: 'Safety',
    durationLabel: '50 min session',
    sectionCount: 4,
    educatorHandle: 'RopeDreamer',
    educatorName: 'Rope Dreamer',
    summary: 'Short mid-scene check-ins and aftercare prompts with live walkthrough clips.',
    heroImageUrl: null,
    tags: ['Safety', 'Psychology'],
  },
  {
    id: 'mock-ssc-rack',
    title: 'SSC vs RACK: safety frameworks',
    href: '/education?view=articles',
    format: 'lecture',
    level: 'All levels',
    topic: 'Safety',
    durationLabel: '60 min session',
    sectionCount: 5,
    educatorHandle: 'RopeDreamer',
    educatorName: 'Rope Dreamer',
    summary: 'Compare risk-aware and traditional frameworks with scene-planning worksheets.',
    heroImageUrl: null,
    tags: ['Safety', 'Beginner'],
  },
  {
    id: 'mock-aftercare',
    title: 'Aftercare essentials',
    href: '/education?view=articles',
    format: 'workshop',
    level: 'Beginner',
    topic: 'Psychology',
    durationLabel: '70 min session',
    sectionCount: 5,
    educatorHandle: 'RopeDreamer',
    educatorName: 'Rope Dreamer',
    summary: 'Physical and emotional aftercare planning for tops, bottoms, and switches.',
    heroImageUrl: null,
    tags: ['Safety', 'Psychology'],
  },
]

type ClassLibrarySection = {
  id: string
  title: string
  description: string
  items: EducationClassOutline[]
}

export type ClassLibrarySnapshot = {
  stats: { classCount: number; educatorCount: number; topicCount: number }
  featured: EducationClassOutline[]
  sections: ClassLibrarySection[]
  all: EducationClassOutline[]
}

function groupSections(items: EducationClassOutline[]): ClassLibrarySection[] {
  const safety = items.filter((c) => /safety|consent|beginner|ssc|rack|aftercare|negotiation/i.test(c.topic + c.title))
  const skills = items.filter((c) => /gear|rope|lab|technique|floor/i.test(c.topic + c.title + c.format))
  const community = items.filter((c) => /etiquette|psychology|community|munch|event/i.test(c.topic + c.title))

  const used = new Set<string>()
  const take = (pool: EducationClassOutline[], limit: number) => {
    const out: EducationClassOutline[] = []
    for (const item of pool) {
      if (used.has(item.id)) continue
      out.push(item)
      used.add(item.id)
      if (out.length >= limit) break
    }
    return out
  }

  const sections: ClassLibrarySection[] = []

  const featuredPool = items.filter((c) => c.featured)
  if (featuredPool.length > 0) {
    sections.push({
      id: 'featured',
      title: 'Featured outlines',
      description: 'Popular session plans educators reuse at munches and conventions.',
      items: featuredPool.slice(0, 3),
    })
    featuredPool.forEach((c) => used.add(c.id))
  }

  const safetyItems = take(safety, 4)
  if (safetyItems.length > 0) {
    sections.push({
      id: 'safety',
      title: 'Safety & consent',
      description: 'Negotiation, frameworks, check-ins, and aftercare session plans.',
      items: safetyItems,
    })
  }

  const skillItems = take(skills, 4)
  if (skillItems.length > 0) {
    sections.push({
      id: 'skills',
      title: 'Skills & technique',
      description: 'Hands-on labs and demos with equipment lists and safety notes.',
      items: skillItems,
    })
  }

  const communityItems = take(community, 4)
  if (communityItems.length > 0) {
    sections.push({
      id: 'community',
      title: 'Community & culture',
      description: 'Etiquette, psychology, and scene navigation for newer members.',
      items: communityItems,
    })
  }

  const remaining = items.filter((c) => !used.has(c.id))
  if (remaining.length > 0) {
    sections.push({
      id: 'more',
      title: 'More outlines',
      description: 'Additional educator-published session materials.',
      items: remaining.slice(0, 6),
    })
  }

  return sections
}

export function buildClassLibrarySnapshot(articles: ApiEducationArticle[]): ClassLibrarySnapshot {
  const all =
    articles.length > 0 ?
      articles.map((article, index) => articleToClassOutline(article, index < 2))
    : MOCK_CLASS_OUTLINES

  const educators = new Set(all.map((c) => c.educatorHandle))
  const topics = new Set(all.map((c) => c.topic))

  return {
    stats: {
      classCount: all.length,
      educatorCount: educators.size,
      topicCount: topics.size,
    },
    featured: all.filter((c) => c.featured).slice(0, 3),
    sections: groupSections(all),
    all,
  }
}

export function filterClassLibrary(
  snapshot: ClassLibrarySnapshot,
  format: ClassFormat | '',
  topic: string | null,
): ClassLibrarySnapshot {
  const match = snapshot.all.filter((c) => {
    if (format && c.format !== format) return false
    if (topic && c.topic !== topic && !c.tags.includes(topic)) return false
    return true
  })

  return {
    ...snapshot,
    featured: match.filter((c) => c.featured).slice(0, 3),
    sections: groupSections(match),
    all: match,
    stats: {
      classCount: match.length,
      educatorCount: new Set(match.map((c) => c.educatorHandle)).size,
      topicCount: new Set(match.map((c) => c.topic)).size,
    },
  }
}

export { FORMAT_ORDER as CLASS_FORMAT_FILTER_ORDER }
