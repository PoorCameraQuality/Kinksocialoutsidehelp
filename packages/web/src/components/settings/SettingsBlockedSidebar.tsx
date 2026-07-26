import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'

export default function SettingsBlockedSidebar() {
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <Panel className="!p-4">
        <h2 className="text-sm font-semibold text-dc-text">When you block a member</h2>
        <ul className="mt-2 list-disc space-y-2 pl-4 text-xs text-dc-muted leading-relaxed">
          <li>You stop seeing each other&apos;s profiles, posts, and event activity where blocking applies.</li>
          <li>Direct messages are closed. Existing threads are archived on your side.</li>
          <li>Follow and connection requests between you are removed.</li>
          <li>Comments, reactions, and bookmarks on each other&apos;s content are hidden where the platform enforces blocks.</li>
        </ul>
        <p className="mt-3 text-xs text-dc-muted leading-relaxed">
          Blocking is stronger than muting. To hide someone from feeds without cutting off messages, use{' '}
          <Link to="/settings/muted" className="text-dc-accent hover:underline">
            Muted
          </Link>
          .
        </p>
      </Panel>
    </div>
  )
}
