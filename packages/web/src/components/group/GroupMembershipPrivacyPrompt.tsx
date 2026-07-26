import { useId, useState } from 'react'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import type { GroupMemberListVisibility } from '@c2k/shared'

export type GroupJoinPrivacyChoices = {
  memberListVisibility: GroupMemberListVisibility
  showGroupOnProfile: boolean
  announceGroupJoinInFeed: boolean
  rememberAsDefault: boolean
}

type Props = {
  open: boolean
  groupName: string
  defaults: Omit<GroupJoinPrivacyChoices, 'rememberAsDefault'>
  joining?: boolean
  onCancel: () => void
  onConfirm: (choices: GroupJoinPrivacyChoices) => void
}

export default function GroupMembershipPrivacyPrompt({
  open,
  groupName,
  defaults,
  joining = false,
  onCancel,
  onConfirm,
}: Props) {
  const baseId = useId()
  const [memberListVisibility, setMemberListVisibility] = useState<GroupMemberListVisibility>(
    defaults.memberListVisibility,
  )
  const [showGroupOnProfile, setShowGroupOnProfile] = useState(defaults.showGroupOnProfile)
  const [announceGroupJoinInFeed, setAnnounceGroupJoinInFeed] = useState(defaults.announceGroupJoinInFeed)
  const [rememberAsDefault, setRememberAsDefault] = useState(false)

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Choose how you appear in this group"
      description="Some groups can reveal sensitive interests or location. You can join without showing your name on the public member list. Group owners and moderators may still see membership so they can keep the space safe."
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={joining}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={joining}
            onClick={() =>
              onConfirm({
                memberListVisibility,
                showGroupOnProfile,
                announceGroupJoinInFeed,
                rememberAsDefault,
              })
            }
          >
            {joining ? 'Joining…' : 'Join group'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-dc-text-muted">
          Joining <span className="font-medium text-dc-text">{groupName}</span>.
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-dc-text">Member list</legend>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-dc-border p-3">
            <input
              type="radio"
              name={`${baseId}-visibility`}
              checked={memberListVisibility === 'visible'}
              onChange={() => setMemberListVisibility('visible')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-dc-text">Show me on the member list</span>
              <span className="block text-xs text-dc-text-muted">Other members can see you joined this group.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-dc-border p-3">
            <input
              type="radio"
              name={`${baseId}-visibility`}
              checked={memberListVisibility === 'hidden'}
              onChange={() => setMemberListVisibility('hidden')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-dc-text">Hide me from the member list</span>
              <span className="block text-xs text-dc-text-muted">
                You stay off the public list. Group staff can still see you for moderation and safety.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-2 border-t border-dc-border pt-3">
          <legend className="text-sm font-medium text-dc-text">Profile and feed</legend>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={showGroupOnProfile}
              onChange={(e) => setShowGroupOnProfile(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-dc-text-muted">
              <span className="block font-medium text-dc-text">Show this group on my profile</span>
              <span className="block text-xs">When off, the group stays off your public profile.</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={announceGroupJoinInFeed}
              onChange={(e) => setAnnounceGroupJoinInFeed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-dc-text-muted">
              <span className="block font-medium text-dc-text">Announce my join in feed activity</span>
              <span className="block text-xs">When off, your join does not appear in others’ feeds.</span>
            </span>
          </label>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-2 border-t border-dc-border pt-3">
          <input
            type="checkbox"
            checked={rememberAsDefault}
            onChange={(e) => setRememberAsDefault(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-dc-text-muted">Remember these choices as my default for future groups</span>
        </label>
      </div>
    </Dialog>
  )
}
