import { Link } from 'react-router-dom'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'

export default function ActivityRightRail() {
  return (
    <aside className={railAsideClass} aria-label="Activity shortcuts">
      <RailCard title="Notification settings">
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Choose which alerts you receive by email and in-app.
        </p>
        <Link to="/settings/notifications" className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline">
          Open settings
        </Link>
      </RailCard>

      <RailCard title="Message safety">
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Block, report, or review message requests from your inbox.
        </p>
        <Link to="/messaging" className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline">
          Go to Messages
        </Link>
      </RailCard>

      <RailCard title="Connection requests">
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Accept or decline pending requests on your Connections page.
        </p>
        <Link
          to="/connections?tab=requests"
          className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline"
        >
          View requests
        </Link>
      </RailCard>
    </aside>
  )
}
