import { Link, useSearchParams } from 'react-router-dom'
import ConnectionGoalsEditor from '@/components/profile/edit/ConnectionGoalsEditor'
import RelationshipsPanel from '@/components/profile/edit/RelationshipsPanel'
import WebsitesPanel from '@/components/profile/edit/WebsitesPanel'
import PrivacyPanel from '@/components/profile/edit/PrivacyPanel'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import { useProfileEdit } from '@/contexts/ProfileEditContext'

export type PresenceSectionId = 'connections' | 'relationships' | 'links' | 'visibility'

const PRESENCE_SECTIONS: { id: PresenceSectionId; label: string }[] = [
  { id: 'connections', label: 'Connections' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'links', label: 'Links' },
  { id: 'visibility', label: 'Visibility' },
]

function resolvePresenceSection(raw: string | null): PresenceSectionId {
  if (raw === 'relationships' || raw === 'links' || raw === 'visibility') return raw
  return 'connections'
}

export default function PresencePanel() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = resolvePresenceSection(searchParams.get('section'))
  const ctx = useProfileEdit()

  function selectSection(section: PresenceSectionId) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (section === 'connections') next.delete('section')
        else next.set('section', section)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Presence sections" className="flex flex-wrap gap-2 border-b border-dc-border pb-3">
        {PRESENCE_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => selectSection(section.id)}
            className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
              activeSection === section.id ?
                'bg-dc-accent/15 text-dc-text border border-dc-accent/30'
              : 'text-dc-muted hover:text-dc-text hover:bg-dc-elevated/60 border border-transparent'
            }`}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {activeSection === 'connections' ?
        <ProfileStudioInsetCard className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-dc-text">Connection goals</h3>
            <p className="mt-1 text-xs leading-relaxed text-dc-muted">
              Help people know whether it makes sense to reach out — friends, event companions, play partners, and more.
            </p>
          </div>
          <ConnectionGoalsEditor selected={ctx.lookingFor} onChange={ctx.setLookingFor} />
          <p className="text-xs leading-relaxed text-dc-muted">
            Selected goals appear on your public profile. For field-level privacy, see{' '}
            <button
              type="button"
              onClick={() => selectSection('visibility')}
              className="text-dc-accent hover:underline"
            >
              Visibility
            </button>
            .
          </p>
        </ProfileStudioInsetCard>
      : null}

      {activeSection === 'relationships' ?
        <RelationshipsPanel />
      : null}

      {activeSection === 'links' ?
        <WebsitesPanel />
      : null}

      {activeSection === 'visibility' ?
        <div className="space-y-4">
          <PrivacyPanel />
          <ProfileStudioInsetCard className="space-y-2">
            <h3 className="text-sm font-semibold text-dc-text">Account-wide settings</h3>
            <p className="text-xs leading-relaxed text-dc-muted">
              Messaging, People search, regional discovery, and adult-content preferences live in account settings — not
              on your public profile.
            </p>
            <Link
              to="/settings/privacy"
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-accent hover:bg-dc-accent-muted/20"
            >
              Open account privacy settings
            </Link>
          </ProfileStudioInsetCard>
        </div>
      : null}
    </div>
  )
}
