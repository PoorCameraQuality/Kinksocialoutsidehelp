import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { ApiEducationArticle } from '@/hooks/useApiEducationArticles'

type HubArticle = Pick<
  ApiEducationArticle,
  'slug' | 'title' | 'excerpt' | 'categories' | 'readingMinutes' | 'difficulty' | 'heroImageUrl'
>

export type EducationArticleCardProps =
  | {
      article: HubArticle
      slug?: never
      title?: never
      excerpt?: never
      heroImageUrl?: never
      badge?: never
      subtitle?: never
    }
  | {
      article?: never
      slug: string
      title: string
      excerpt: string | null
      heroImageUrl?: string | null
      badge?: ReactNode
      subtitle?: ReactNode
    }

function formatReadTime(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes < 1) return null
  return `${minutes} min read`
}

function normalizeTag(label: string): string {
  return label.trim().toLowerCase().replace(/^#/, '')
}

/** Extra pills after the eyebrow category — skips duplicates of primary category and difficulty. */
function articleTagPills(categories: string[], difficulty: string | null): string[] {
  const primaryKey = categories[0] ? normalizeTag(categories[0]) : ''
  const seen = new Set<string>()
  if (primaryKey) seen.add(primaryKey)

  const pills: string[] = []

  if (difficulty) {
    const label = difficulty.trim()
    const key = normalizeTag(label)
    if (key && !seen.has(key)) {
      pills.push(label)
      seen.add(key)
    }
  }

  for (const category of categories.slice(1)) {
    const label = category.trim()
    const key = normalizeTag(label)
    if (!key || seen.has(key) || pills.length >= 2) continue
    pills.push(label)
    seen.add(key)
  }

  return pills
}

function ArticleMediaPlaceholder({ category }: { category?: string }) {
  return (
    <div
      className="flex h-full flex-col items-start justify-end bg-gradient-to-br from-dc-accent/18 via-dc-surface-muted to-violet-950/35 p-4"
      aria-hidden
    >
      {category ?
        <span className="rounded-md bg-dc-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-dc-accent">
          {category}
        </span>
      : null}
      <svg className="mt-auto h-7 w-7 text-dc-accent/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    </div>
  )
}

function HubEducationArticleCard({ article }: { article: HubArticle }) {
  const { slug, title, excerpt, categories, readingMinutes, difficulty, heroImageUrl } = article
  const primaryCategory = categories?.[0]?.trim()
  const tagPills = articleTagPills(categories ?? [], difficulty)
  const href = `/education/${encodeURIComponent(slug)}`
  const readLabel = formatReadTime(readingMinutes)

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-dc-accent-border/45 hover:shadow-[var(--dc-shadow-soft),0_12px_40px_-16px_rgba(0,0,0,0.45)]">
      <Link to={href} className="block shrink-0 overflow-hidden" tabIndex={-1} aria-hidden>
        <div className="aspect-[16/10] w-full bg-dc-surface-muted">
          {heroImageUrl ?
            <img
              src={heroImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          : <ArticleMediaPlaceholder category={primaryCategory} />}
        </div>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-2 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-1">
          {primaryCategory ?
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dc-accent">{primaryCategory}</span>
          : difficulty ?
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dc-accent">{difficulty}</span>
          : null}
          {tagPills.map((pill) => (
            <span
              key={pill}
              className="rounded-full border border-dc-border bg-dc-elevated-muted/80 px-2 py-0.5 text-[10px] font-medium capitalize text-dc-text-muted"
            >
              {pill}
            </span>
          ))}
        </div>

        <Link to={href} className="block min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-dc-text transition-colors group-hover:text-dc-accent">
            {title}
          </h3>
        </Link>

        {excerpt ?
          <p className="mt-2 flex-1 line-clamp-2 text-sm leading-relaxed text-dc-text-muted">{excerpt}</p>
        : <div className="mt-2 flex-1" aria-hidden />}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-dc-border/50 pt-3">
          <span className="text-xs text-dc-muted">{readLabel ?? 'Article'}</span>
          <span className="text-xs font-semibold text-dc-accent opacity-80 transition-opacity group-hover:opacity-100">
            Read
          </span>
        </div>
      </div>
    </article>
  )
}

function PreviewEducationArticleCard({
  slug,
  title,
  excerpt,
  heroImageUrl,
  badge,
  subtitle,
}: {
  slug: string
  title: string
  excerpt: string | null
  heroImageUrl?: string | null
  badge?: ReactNode
  subtitle?: ReactNode
}) {
  return (
    <li>
      <Link
        to={`/education/${encodeURIComponent(slug)}`}
        className="flex min-h-[4.25rem] gap-4 rounded-xl border border-dc-border bg-dc-elevated-solid p-3 text-left transition-colors hover:border-dc-accent-border/40 sm:p-4"
      >
        {heroImageUrl ?
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-dc-elevated-muted sm:h-24 sm:w-24">
            <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {badge ? <span className="inline-flex">{badge}</span> : null}
            <h3 className="text-sm font-semibold text-dc-text sm:text-base">{title}</h3>
          </div>
          {subtitle ? <p className="mt-0.5 text-[11px] text-dc-muted">{subtitle}</p> : null}
          {excerpt ?
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-dc-text-muted sm:text-sm">{excerpt}</p>
          : null}
        </div>
      </Link>
    </li>
  )
}

/**
 * Hub grid card (`article` prop) or compact preview row (`slug` + `title` + …) for profile / presenter lists.
 */
export default function EducationArticleCard(props: EducationArticleCardProps) {
  if ('article' in props && props.article) {
    return <HubEducationArticleCard article={props.article} />
  }
  return (
    <PreviewEducationArticleCard
      slug={props.slug}
      title={props.title}
      excerpt={props.excerpt}
      heroImageUrl={props.heroImageUrl}
      badge={props.badge}
      subtitle={props.subtitle}
    />
  )
}
