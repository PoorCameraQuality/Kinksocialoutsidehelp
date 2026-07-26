import { Link } from 'react-router-dom'
import {
  ALPHA_FEEDBACK_BODY,
  ALPHA_FEEDBACK_HEADLINE,
  ALPHA_FEEDBACK_LINK,
  HOME_ACTIVATION_TAGLINE,
  HOME_ACTIVATION_TITLE,
} from '@/lib/alpha-activation-copy'
import type { HomeActivationItem } from '@/lib/home-activation'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'

type Props = {
  items: HomeActivationItem[]
  className?: string
}

export default function HomeActivationCard({ items, className = '' }: Props) {
  const openItems = items.filter((item) => !item.done)
  if (openItems.length === 0) return null

  return (
    <section
      className={`${cardSurfaceSolidClass} ${cardSurfaceInteractiveClass} p-5 ${className}`.trim()}
      aria-labelledby="home-activation-heading"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent">Getting started</p>
      <h2 id="home-activation-heading" className="mt-1 text-base font-semibold text-dc-text">
        {HOME_ACTIVATION_TITLE}
      </h2>
      <p className="mt-1 text-sm text-dc-text-muted">{HOME_ACTIVATION_TAGLINE}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className={item.done ? 'text-dc-text-muted line-through' : 'text-dc-text'}>{item.label}</span>
            {!item.done ?
              <Link to={item.href} className="shrink-0 font-medium text-dc-accent hover:underline">
                Go
              </Link>
            : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-dc-border pt-4">
        <p className="text-xs font-semibold text-dc-text">{ALPHA_FEEDBACK_HEADLINE}</p>
        <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{ALPHA_FEEDBACK_BODY}</p>
        <Link to="/support" className="mt-2 inline-block text-xs font-medium text-dc-accent hover:underline">
          {ALPHA_FEEDBACK_LINK}
        </Link>
      </div>
    </section>
  )
}
