import { Link } from 'react-router-dom'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'

export default function MyPostsRightRail() {
  return (
    <aside className={railAsideClass} aria-label="Posting tips">
      <RailCard title="Create something">
        <ul className="space-y-2 text-sm">
          <li>
            <Link to="/home?mode=discover&tab=Local#home-feed-composer" className="text-dc-accent hover:underline">
              Create post
            </Link>
          </li>
          <li>
            <Link to="/education/write" className="text-dc-accent hover:underline">
              Write article
            </Link>
          </li>
          <li>
            <Link to="/events?create=event" className="text-dc-accent hover:underline">
              Create event
            </Link>
          </li>
        </ul>
      </RailCard>

      <RailCard title="Draft tips">
        <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-dc-text-muted">
          <li>Be clear and respectful in public posts.</li>
          <li>Add content warnings when topics need them.</li>
          <li>Save drafts for articles until you are ready to publish.</li>
        </ul>
      </RailCard>

      <RailCard title="Community posting">
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Posts appear in feeds and on your profile. Review{' '}
          <Link to="/guidelines" className="text-dc-accent hover:underline">
            community guidelines
          </Link>{' '}
          before publishing.
        </p>
      </RailCard>
    </aside>
  )
}
