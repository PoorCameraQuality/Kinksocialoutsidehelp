import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import { PROFILE_EDIT_TABS } from '@/components/profile/edit/ProfileEditTabNav'
import { useSettingsContext } from '../SettingsContext'

export default function SettingsProfilePage() {
  const { viewerUsername } = useSettingsContext()
  const publicHref = viewerUsername ? `/profile/${encodeURIComponent(viewerUsername)}` : null

  return (
    <div className="space-y-6">
      <Panel>
        <SectionHeader
          eyebrow="Profile"
          title="Public profile content"
          description="Everything visitors see on your profile page. Photos, bio, interests, and links. Is edited separately from account credentials."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/profile/edit"
            className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Open profile studio
          </Link>
          {publicHref ?
            <Link
              to={publicHref}
              className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              View public profile
            </Link>
          : null}
        </div>
      </Panel>

      <Panel>
        <SectionHeader eyebrow="Sections" title="Edit profile tabs" description="Jump straight to a section." />
        <ul className="mt-4 divide-y divide-dc-border rounded-xl border border-dc-border">
          {PROFILE_EDIT_TABS.map((tab) => (
            <li key={tab.id}>
              <Link
                to={tab.path}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-dc-text hover:bg-dc-elevated/50"
              >
                <span>{tab.label}</span>
                <span className="text-dc-muted" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
