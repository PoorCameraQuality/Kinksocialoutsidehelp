import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import type { GroupMemberListVisibility } from '@c2k/shared'

type ViewerMembership = {
  memberListVisibility?: GroupMemberListVisibility
  showGroupOnProfile?: boolean
  announceGroupJoinInFeed?: boolean
  role?: string
}

type Props = {
  groupId: string
  groupName: string
  viewerMembership: ViewerMembership | null
  onUpdated?: () => void
  onLeave?: () => void
}

export default function GroupMembershipSettingsPanel({
  groupId,
  groupName,
  viewerMembership,
  onUpdated,
  onLeave,
}: Props) {
  const [memberListVisibility, setMemberListVisibility] = useState<GroupMemberListVisibility>('visible')
  const [showGroupOnProfile, setShowGroupOnProfile] = useState(false)
  const [announceGroupJoinInFeed, setAnnounceGroupJoinInFeed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const isStaff = ['owner', 'admin', 'moderator'].includes((viewerMembership?.role ?? '').toLowerCase())

  useEffect(() => {
    if (!viewerMembership) return
    setMemberListVisibility(viewerMembership.memberListVisibility ?? 'visible')
    setShowGroupOnProfile(viewerMembership.showGroupOnProfile ?? false)
    setAnnounceGroupJoinInFeed(viewerMembership.announceGroupJoinInFeed ?? false)
  }, [viewerMembership])

  if (!viewerMembership) return null

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/membership`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberListVisibility: isStaff ? 'visible' : memberListVisibility,
          showGroupOnProfile,
          announceGroupJoinInFeed,
        }),
      })
      if (!r.ok) {
        setMessage('Could not save membership settings.')
        return
      }
      setMessage('Membership settings saved.')
      onUpdated?.()
    } catch {
      setMessage('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="mt-6">
      <SectionHeader
        eyebrow="Membership"
        title="Your membership settings"
        description={`Privacy choices for ${groupName}.`}
      />
      <div className="mt-4 space-y-4">
        {isStaff ?
          <p className="rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text-muted">
            Staff roles are visible in the member list for accountability.
          </p>
        : null}

        <fieldset className="space-y-2" disabled={isStaff}>
          <legend className="text-sm font-medium text-dc-text">Member list visibility</legend>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              checked={memberListVisibility === 'visible'}
              onChange={() => setMemberListVisibility('visible')}
              disabled={isStaff}
            />
            <span className="text-sm text-dc-text-muted">Show me in the member list</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              checked={memberListVisibility === 'hidden'}
              onChange={() => setMemberListVisibility('hidden')}
              disabled={isStaff}
            />
            <span className="text-sm text-dc-text-muted">Keep me hidden from the member list</span>
          </label>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={showGroupOnProfile}
            onChange={(e) => setShowGroupOnProfile(e.target.checked)}
          />
          <span className="text-sm text-dc-text-muted">Show this group on my profile</span>
        </label>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={announceGroupJoinInFeed}
            onChange={(e) => setAnnounceGroupJoinInFeed(e.target.checked)}
          />
          <span className="text-sm text-dc-text-muted">Allow group activity to appear in my feed activity</span>
        </label>

        {message ?
          <p className="text-sm text-dc-text-muted">{message}</p>
        : null}

        <div className="flex flex-wrap gap-2 border-t border-dc-border pt-4">
          <Button type="button" variant="primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          {onLeave ?
            <Button type="button" variant="ghost" onClick={onLeave}>
              Leave group
            </Button>
          : null}
        </div>
      </div>
    </Panel>
  )
}
