import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'

export default function SettingsPrivacySidebar() {
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <Panel className="!p-4">
        <h2 className="text-sm font-semibold text-dc-text">Kink Social &amp; privacy</h2>
        <p className="mt-2 text-xs text-dc-muted leading-relaxed">
          We treat location, event attendance, and messaging as sensitive. You control what appears on your profile,
          in People search, and in organizer-facing history. Separate from what event staff need at the door.
        </p>
        <Link to="/privacy" className="mt-3 inline-block text-xs text-dc-accent hover:underline">
          Read our privacy policy
        </Link>
      </Panel>
      <Panel className="!p-4">
        <h2 className="text-sm font-semibold text-dc-text">Need help?</h2>
        <p className="mt-2 text-xs text-dc-muted leading-relaxed">
          Questions about visibility, blocking, or a report? Our support team can walk through options without changing
          settings for you.
        </p>
        <Link to="/support" className="mt-3 inline-block text-xs text-dc-accent hover:underline">
          Contact support
        </Link>
      </Panel>
    </div>
  )
}
