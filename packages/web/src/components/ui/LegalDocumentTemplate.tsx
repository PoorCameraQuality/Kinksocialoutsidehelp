import type { ReactNode } from 'react'

import { Link } from 'react-router-dom'

export type LegalDraftSection = {
  id: string
  title: string
  body: ReactNode
}

type RelatedLink = { label: string; href: string }

type Props = {
  title: string
  intro?: ReactNode
  sections: LegalDraftSection[]
  relatedLinks?: RelatedLink[]
  /** When true, hide draft banner and show effective date in header */
  published?: boolean
  effectiveDate?: string
  lastUpdated?: string
  /** When true, show Policy Hub link alongside Back to home */
  showPoliciesHub?: boolean
}

/**
 * Shared layout for long policy / legal document pages — draft banner, section anchors,
 * collapsible mobile TOC, desktop sticky TOC, Policy Hub navigation.
 */
export default function LegalDocumentTemplate({
  title,
  intro,
  sections,
  relatedLinks = [],
  published = false,
  effectiveDate,
  lastUpdated,
  showPoliciesHub = false,
}: Props) {
  const footerLinks = (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        to="/home"
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
      >
        Back to home
      </Link>
      {showPoliciesHub ?
        <Link
          to="/policies"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
        >
          Policy Hub
        </Link>
      : null}
      {relatedLinks.map((link) => (
        <Link
          key={link.href}
          to={link.href}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
        >
          {link.label}
        </Link>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 c2k-mobile-scroll-pad md:pb-10">
      {!published ?
        <div
          className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-dc-text-muted"
          role="status"
        >
          <strong className="font-semibold text-dc-text">Draft policy for beta.</strong> Final wording may change
          before public launch and counsel review.
        </div>
      : null}

      {showPoliciesHub ?
        <p className="mb-4 lg:hidden">
          <Link to="/policies" className="text-sm font-medium text-dc-accent hover:underline">
            ← Back to Policy Hub
          </Link>
        </p>
      : null}

      <header className="mb-5">
        <h1 className="mb-2 text-2xl font-bold text-dc-text sm:text-3xl">{title}</h1>
        {published && (effectiveDate || lastUpdated) ?
          <p className="mb-2 text-xs text-dc-muted">
            {effectiveDate ? <>Effective {effectiveDate}</> : null}
            {effectiveDate && lastUpdated ? ' · ' : null}
            {lastUpdated ? <>Last updated {lastUpdated}</> : null}
          </p>
        : null}
        {intro ?
          <div className="space-y-3 text-sm leading-relaxed text-dc-muted">{intro}</div>
        : null}
      </header>

      <details className="group mb-6 rounded-xl border border-dc-border bg-dc-elevated/95 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-dc-text marker:content-none [&::-webkit-details-marker]:hidden">
          <span>Sections ({sections.length})</span>
          <span className="text-xs font-normal text-dc-muted group-open:hidden">Jump to a section</span>
          <span className="hidden text-xs font-normal text-dc-muted group-open:inline">Tap to collapse</span>
        </summary>
        <nav aria-label="Table of contents" className="border-t border-dc-border px-2 py-2">
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex min-h-10 items-center rounded-lg px-3 text-sm text-dc-text-muted hover:bg-dc-elevated-solid hover:text-dc-text"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </details>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-5 shadow-[var(--dc-shadow-soft)] sm:p-6">
            <div className="space-y-10 text-dc-text-muted leading-relaxed sm:space-y-12">
              {sections.map((section) => (
                <section key={section.id}>
                  <h2
                    id={section.id}
                    className="text-lg font-semibold text-dc-text scroll-mt-28 sm:text-xl lg:scroll-mt-24"
                  >
                    {section.title}
                  </h2>
                  <div className="prose prose-invert prose-sm mt-3 max-w-none text-dc-text-muted [&_a]:text-dc-accent [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="mt-8">{footerLinks}</div>
        </div>

        <aside className="hidden shrink-0 lg:block lg:w-56">
          <div className="sticky top-24">
            {showPoliciesHub ?
              <p className="mb-4">
                <Link to="/policies" className="text-sm font-medium text-dc-accent hover:underline">
                  ← Policy Hub
                </Link>
              </p>
            : null}
            <h3 className="mb-2 text-xs font-semibold uppercase text-dc-muted">On this page</h3>
            <ul className="space-y-2 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-dc-text-muted hover:text-dc-text">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
