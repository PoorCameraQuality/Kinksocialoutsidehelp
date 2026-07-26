import { useState } from 'react'
import { parseDmRetentionSelectValue, type PrivacySettings } from '@c2k/shared'
import { WizardChoiceCard, WizardSelect, WizardStepHeader } from '@/components/ui/primitives'
import { OnboardingStepLayout } from '@/components/onboarding/OnboardingTips'

const LockIcon = (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

const WHO_CAN_MESSAGE_OPTIONS: { value: PrivacySettings['whoCanMessage']; label: string; description: string }[] = [
  { value: 'connections_only', label: 'Connections only', description: 'Recommended. Only people you connect with can message you.' },
  { value: 'groups_only', label: 'People in my groups', description: 'Members of groups you belong to can message you.' },
  { value: 'open', label: 'Anyone on kink.social', description: 'Any member can message you.' },
  { value: 'nobody', label: 'No one', description: 'You can still message people first.' },
]

const DM_RETENTION_OPTIONS: { value: string; label: string }[] = [
  { value: '180', label: '6 months — more private' },
  { value: '365', label: '12 months — recommended' },
  { value: '730', label: '24 months' },
  { value: '', label: 'Keep until I delete them' },
]

const RECOMMENDED_PRIVACY: {
  whoCanMessage: PrivacySettings['whoCanMessage']
  dmRetentionDays: PrivacySettings['dmRetentionDays']
  connectionsListVisibility: PrivacySettings['connectionsListVisibility']
  feedActivityPrivacy: Partial<PrivacySettings['feedActivityPrivacy']>
} = {
  whoCanMessage: 'connections_only',
  dmRetentionDays: 365,
  connectionsListVisibility: 'hidden',
  feedActivityPrivacy: {
    showReactions: 'connections_only',
    showGroupJoins: 'ask',
    defaultGroupMemberListVisibility: 'ask',
  },
}

function dmRetentionSelectValue(days: number | null | undefined): string {
  if (days === null) return ''
  if (days === undefined) return '365'
  return String(days)
}

type PrivacyStepProps = {
  privacy: PrivacySettings
  onChange: (next: PrivacySettings) => void
}

/** Step 4 — privacy defaults. Leads with a recommended preset; advanced controls behind a disclosure. */
export default function PrivacyStep({ privacy, onChange }: PrivacyStepProps) {
  const [customizing, setCustomizing] = useState(false)

  function applyRecommended() {
    setCustomizing(false)
    onChange({
      ...privacy,
      whoCanMessage: RECOMMENDED_PRIVACY.whoCanMessage,
      dmRetentionDays: RECOMMENDED_PRIVACY.dmRetentionDays,
      connectionsListVisibility: RECOMMENDED_PRIVACY.connectionsListVisibility,
      feedActivityPrivacy: { ...privacy.feedActivityPrivacy, ...RECOMMENDED_PRIVACY.feedActivityPrivacy },
    })
  }

  return (
    <OnboardingStepLayout
      tips={[
        { title: 'Start private', body: 'You can always open up later. Recommended defaults are a safe first setup.' },
        { title: 'Change anytime', body: 'Every control here is available again under Settings → Privacy.' },
      ]}
    >
      <WizardStepHeader
        icon={LockIcon}
        eyebrow="Privacy"
        title="Set your privacy comfort"
        description="Most people start private and open up later. You can change any of this in Settings whenever you like."
      />

      <div className="space-y-3">
        <WizardChoiceCard
          title="Keep the recommended private setup"
          description="Connections-only messages, 12-month message retention, activity shown to connections, and your connection list hidden. The safest place to start."
          badge="Recommended"
          selected={!customizing}
          onSelect={applyRecommended}
        />
        <WizardChoiceCard
          title="Customize my privacy"
          description="Fine-tune who can message you, how long messages are kept, and how public your activity is."
          selected={customizing}
          onSelect={() => setCustomizing(true)}
        />
      </div>

      {customizing ? (
        <div className="mt-6 space-y-6 border-t border-dc-border pt-6">
          <section className="space-y-5" aria-labelledby="privacy-messages-heading">
            <h3 id="privacy-messages-heading" className="text-sm font-semibold text-dc-text">
              Messages
            </h3>
            <WizardSelect
              name="onboarding-who-can-message"
              label="Who can message you?"
              hint="Choose who is allowed to start a new DM with you."
              value={privacy.whoCanMessage}
              onChange={(e) => onChange({ ...privacy, whoCanMessage: e.target.value as PrivacySettings['whoCanMessage'] })}
            >
              {WHO_CAN_MESSAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </WizardSelect>
            <WizardSelect
              name="onboarding-message-retention"
              label="Message retention"
              hint="How long DMs are kept before they are eligible for automatic deletion. Reported content, safety cases, and legal holds may be preserved when required."
              value={dmRetentionSelectValue(privacy.dmRetentionDays)}
              onChange={(e) => onChange({ ...privacy, dmRetentionDays: parseDmRetentionSelectValue(e.target.value) })}
            >
              {DM_RETENTION_OPTIONS.map((opt) => (
                <option key={opt.value || 'keep'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </WizardSelect>
          </section>

          <section className="space-y-5" aria-labelledby="privacy-activity-heading">
            <div>
              <h3 id="privacy-activity-heading" className="text-sm font-semibold text-dc-text">
                How public should your activity be?
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-dc-text-muted">
                Recommended: show reactions to connections, ask before showing group joins, and keep your connection
                list private.
              </p>
            </div>

            <WizardSelect
              name="onboarding-show-reactions"
              label="Reactions and loves in feeds"
              value={privacy.feedActivityPrivacy.showReactions}
              onChange={(e) =>
                onChange({
                  ...privacy,
                  feedActivityPrivacy: {
                    ...privacy.feedActivityPrivacy,
                    showReactions: e.target.value as typeof privacy.feedActivityPrivacy.showReactions,
                  },
                })
              }
            >
              <option value="connections_only">Connections only (recommended)</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </WizardSelect>

            <WizardSelect
              name="onboarding-show-group-joins"
              label="Group joins in feeds"
              value={privacy.feedActivityPrivacy.showGroupJoins}
              onChange={(e) =>
                onChange({
                  ...privacy,
                  feedActivityPrivacy: {
                    ...privacy.feedActivityPrivacy,
                    showGroupJoins: e.target.value as typeof privacy.feedActivityPrivacy.showGroupJoins,
                  },
                })
              }
            >
              <option value="ask">Ask every time (recommended)</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </WizardSelect>

            <WizardSelect
              name="onboarding-group-member-visibility"
              label="Default group member list visibility"
              value={privacy.feedActivityPrivacy.defaultGroupMemberListVisibility}
              onChange={(e) =>
                onChange({
                  ...privacy,
                  feedActivityPrivacy: {
                    ...privacy.feedActivityPrivacy,
                    defaultGroupMemberListVisibility: e.target
                      .value as typeof privacy.feedActivityPrivacy.defaultGroupMemberListVisibility,
                  },
                })
              }
            >
              <option value="ask">Ask when joining (recommended)</option>
              <option value="hidden">Keep me hidden by default</option>
              <option value="visible">Show me in member lists by default</option>
            </WizardSelect>

            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={privacy.connectionsListVisibility !== 'hidden'}
                onChange={(e) =>
                  onChange({
                    ...privacy,
                    connectionsListVisibility: e.target.checked ? 'connections_only' : 'hidden',
                  })
                }
                className="mt-1"
              />
              <span className="text-sm text-dc-text-muted">
                Show my connection list on my profile (off by default for privacy)
              </span>
            </label>
          </section>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3">
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Age, gender, location, and interests stay private by default. After setup you can choose what appears on
            your profile and in search.
          </p>
        </div>
      )}
    </OnboardingStepLayout>
  )
}
