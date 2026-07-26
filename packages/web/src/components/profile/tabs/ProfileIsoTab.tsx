import ProfileIsoEditor from '@/components/profile/ProfileIsoEditor'
import ProfileIsoView, { type ProfileIsoPayload } from '@/components/profile/ProfileIsoView'
import EmptyState from '@/components/ui/EmptyState'
import Card from '@/components/ui/Card'

type Props = {
  viewerIsOwner: boolean
  isAuthenticated: boolean
  iso: ProfileIsoPayload | null | undefined
  username: string
  userId: string
}

export default function ProfileIsoTab({ viewerIsOwner, isAuthenticated, iso, username, userId }: Props) {
  if (viewerIsOwner && isAuthenticated) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-dc-text">Your ISO</h2>
            <p className="mt-1 text-xs text-dc-muted leading-relaxed">
              Share what you are seeking. You can also list on individual convention ISO boards from each convention
              page.
            </p>
          </div>
          <ProfileIsoEditor />
        </Card>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted mb-2">What others see</p>
          {iso?.body?.trim() ?
            <ProfileIsoView
              iso={iso}
              targetUsername={username}
              targetUserId={userId}
              viewerIsSelf
              isAuthenticated={isAuthenticated}
            />
          : <EmptyState title="No ISO listed" message="Save your ISO to preview how it appears publicly." inline />}
        </div>
      </div>
    )
  }

  if (!iso?.body?.trim()) {
    return (
      <EmptyState
        title="No ISO listed"
        message="What this member is seeking, if they have chosen to share it."
        inline
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-dc-muted">What this member is seeking, if they have chosen to share it.</p>
      <ProfileIsoView
        iso={iso}
        targetUsername={username}
        targetUserId={userId}
        viewerIsSelf={false}
        isAuthenticated={isAuthenticated}
      />
    </div>
  )
}
