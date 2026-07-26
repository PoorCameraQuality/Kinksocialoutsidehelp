import { Panel } from '@/components/dancecard/ui/Panel'

/** Dev-only note about push/email plumbing - not shown on the public notifications inbox. */
export default function SettingsPushBuildNote() {
  if (!import.meta.env.DEV) return null

  return (
    <Panel className="border-dc-border/60 bg-dc-elevated-muted/40">
      <p className="text-xs leading-relaxed text-dc-muted">
        <span className="font-medium text-dc-text-muted">Local dev:</span> Browser push requires VAPID keys on the API.
        Org digest email uses the preferences below. Push is not surfaced on the notifications inbox page.
      </p>
    </Panel>
  )
}
