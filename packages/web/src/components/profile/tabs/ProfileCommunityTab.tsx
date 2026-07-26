import type { ReactNode } from 'react'
import TabButton from '@/components/ui/TabButton'
import {
  COMMUNITY_SECTIONS,
  communitySectionLabel,
  type CommunitySection,
} from '@/lib/public-profile-tabs'
import { cn } from '@/lib/cn'

type Props = {
  activeSection: CommunitySection
  onSectionChange: (section: CommunitySection) => void
  relationships: ReactNode
  connections: ReactNode
  feedback: ReactNode
  /** Hide sections with no public content (visitors). Owner always sees all. */
  visibleSections?: readonly CommunitySection[]
}

export default function ProfileCommunityTab({
  activeSection,
  onSectionChange,
  relationships,
  connections,
  feedback,
  visibleSections = COMMUNITY_SECTIONS,
}: Props) {
  const sections = COMMUNITY_SECTIONS.filter((s) => visibleSections.includes(s))
  const resolvedSection = sections.includes(activeSection) ? activeSection : (sections[0] ?? 'connections')

  return (
    <div className="space-y-5">
      {sections.length > 1 ?
        <div
          className={cn(
            'flex gap-1 overflow-x-auto rounded-lg border border-dc-border/80 bg-dc-surface/30 p-1',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
          role="tablist"
          aria-label="Community sections"
        >
          {sections.map((section) => (
            <TabButton
              key={section}
              label={communitySectionLabel(section)}
              isActive={resolvedSection === section}
              onClick={() => onSectionChange(section)}
              size="small"
              className="flex-shrink-0 whitespace-nowrap rounded-md px-3"
            />
          ))}
        </div>
      : null}

      <div className="min-w-0">
        {resolvedSection === 'relationships' ? relationships : null}
        {resolvedSection === 'connections' ? connections : null}
        {resolvedSection === 'feedback' ? feedback : null}
      </div>
    </div>
  )
}
