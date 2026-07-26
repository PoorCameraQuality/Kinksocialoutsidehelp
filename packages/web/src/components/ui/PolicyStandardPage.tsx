import type { ReactNode } from 'react'
import LegalDraftPage, { type LegalDraftSection } from '@/components/ui/LegalDraftPage'

const STANDARD_SECTION_KEYS = [
  'whatThisMeans',
  'notAllowed',
  'allowed',
  'howToReport',
  'whoCanReport',
  'whatHappensNext',
  'escalation',
] as const

type PolicyStandardBodyKey = (typeof STANDARD_SECTION_KEYS)[number]

export type PolicyStandardContent = {
  [K in PolicyStandardBodyKey]?: ReactNode
} & {
  /** Extra sections appended after the standard blocks (before last updated). */
  additionalSections?: LegalDraftSection[]
}

type RelatedLink = { label: string; href: string }

const STANDARD_SECTIONS: { id: PolicyStandardBodyKey; title: string }[] = [
  { id: 'whatThisMeans', title: 'What this means' },
  { id: 'notAllowed', title: 'What is not allowed' },
  { id: 'allowed', title: 'What is allowed' },
  { id: 'howToReport', title: 'How to report' },
  { id: 'whoCanReport', title: 'Who can report' },
  { id: 'whatHappensNext', title: 'What happens next' },
  { id: 'escalation', title: 'Escalation path' },
]

function buildStandardSections(content: PolicyStandardContent, lastUpdated?: string): LegalDraftSection[] {
  const sections: LegalDraftSection[] = []

  for (const block of STANDARD_SECTIONS) {
    const body = content[block.id]
    if (body) {
      sections.push({ id: block.id.replace(/([A-Z])/g, '-$1').toLowerCase(), title: block.title, body })
    }
  }

  if (content.additionalSections?.length) {
    sections.push(...content.additionalSections)
  }

  if (lastUpdated) {
    sections.push({
      id: 'last-updated',
      title: 'Last updated',
      body: (
        <p>
          This page was last updated {lastUpdated}. Draft policies may change before counsel review and public launch.
          See the <a href="/policies">Policy Hub</a> for related documents.
        </p>
      ),
    })
  }

  return sections
}

/**
 * Policy pages with a shared section vocabulary (report → review → escalation).
 * Wraps LegalDraftPage; always links back to the Policy Hub.
 */
export default function PolicyStandardPage({
  title,
  intro,
  content,
  relatedLinks = [],
  published = false,
  effectiveDate,
  lastUpdated,
}: {
  title: string
  intro: string
  content: PolicyStandardContent
  relatedLinks?: RelatedLink[]
  published?: boolean
  effectiveDate?: string
  lastUpdated?: string
}) {
  const hubLink: RelatedLink = { label: 'All policies', href: '/policies' }
  const mergedRelated = [hubLink, ...relatedLinks.filter((l) => l.href !== '/policies')]

  return (
    <LegalDraftPage
      title={title}
      intro={intro}
      sections={buildStandardSections(content, lastUpdated ?? effectiveDate)}
      relatedLinks={mergedRelated}
      published={published}
      effectiveDate={effectiveDate}
      lastUpdated={lastUpdated}
      showPoliciesHub
    />
  )
}
