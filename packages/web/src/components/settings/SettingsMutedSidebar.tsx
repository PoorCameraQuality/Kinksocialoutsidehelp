import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'

function HelpBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="!p-4">
      <h2 className="text-sm font-semibold text-dc-text">{title}</h2>
      <div className="mt-2 space-y-2 text-xs text-dc-muted leading-relaxed">{children}</div>
    </Panel>
  )
}

export default function SettingsMutedSidebar() {
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <HelpBlock title="What happens when a tag is muted?">
        <p>
          Content tagged with that interest is hidden from your Following feed, Near you, and tag browse pages.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Posts and media with that tag</li>
          <li>When people you follow are tagged in matching content</li>
          <li>When people you follow react to or comment on tagged content</li>
          <li>Trending items tied to that tag</li>
        </ul>
      </HelpBlock>
      <HelpBlock title="What happens when a group is muted?">
        <p>Activity from that group is hidden from your feeds. Feed filtering for group mutes is rolling out. Your list is saved now.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>New discussions and replies in the group</li>
          <li>Group event announcements in activity</li>
          <li>Join and membership notifications from that group</li>
        </ul>
      </HelpBlock>
      <HelpBlock title="What happens when a member is muted?">
        <p>
          That member&apos;s activity is hidden from your Following feed and explore surfaces. Feed filtering for
          member mutes is rolling out. Your list is saved now.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Their posts, reactions, and comments in your feeds</li>
          <li>When they join groups or events you follow</li>
        </ul>
      </HelpBlock>
      <Panel className="!p-4">
        <h2 className="text-sm font-semibold text-dc-text">Mute vs block</h2>
        <p className="mt-2 text-xs text-dc-muted leading-relaxed">
          Muting only hides someone or something from your feeds. Blocking stops messages and interaction. Manage that
          on the{' '}
          <Link to="/settings/blocked" className="text-dc-accent hover:underline">
            Blocked
          </Link>{' '}
          tab.
        </p>
      </Panel>
    </div>
  )
}
