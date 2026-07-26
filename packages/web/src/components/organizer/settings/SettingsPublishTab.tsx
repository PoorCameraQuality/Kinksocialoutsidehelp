import OrganizerOrgEckePanel from '@/components/organizer/OrganizerOrgEckePanel'
import {
  PublishReadinessCard,
  SettingsSection,
  SettingsSubsectionHeader,
} from '@/components/organizer/settings/settings-ui'

type Props = {
  orgSlug: string
  displayName: string
  settingsBase: string
  checks: { label: string; done: boolean }[]
}

export default function SettingsPublishTab({ orgSlug, checks }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
      <div className="space-y-5">
        <SettingsSubsectionHeader
          title="Publishing"
          subtitle="Optionally publish this organization to East Coast Kink Events public listings in addition to the Kink Social public hub."
        />

        <SettingsSection>
          <h4 className="text-sm font-semibold text-dc-text">Two public surfaces</h4>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
              <dt className="font-medium text-dc-text">Kink Social public hub</dt>
              <dd className="mt-1 text-dc-text-muted">
                Your organization page inside Kink Social. Always controlled from these settings.
              </dd>
            </div>
            <div className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
              <dt className="font-medium text-dc-text">East Coast Kink Events listing</dt>
              <dd className="mt-1 text-dc-text-muted">
                An optional public directory listing that may appear in the East Coast Kink Events ecosystem and related
                Attendee app and public pages.
              </dd>
            </div>
          </dl>
        </SettingsSection>

        <SettingsSection>
          <h4 className="text-sm font-semibold text-dc-text">Publishing workflow</h4>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-dc-text-muted">
            <li>Build a publish preview to validate listing content.</li>
            <li>Review the preview and confirm details look correct.</li>
            <li>Publish when ready. Outbound sync requires the publish bridge when enabled.</li>
          </ol>
        </SettingsSection>

        <OrganizerOrgEckePanel orgSlug={orgSlug} />
      </div>

      <aside>
        <PublishReadinessCard checks={checks} />
      </aside>
    </div>
  )
}
