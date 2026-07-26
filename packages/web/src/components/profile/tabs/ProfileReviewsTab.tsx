import ProfileReferencesPanel from '@/components/profile/ProfileReferencesPanel'
import EmptyState from '@/components/ui/EmptyState'

type ReferenceItem = {
  id: string
  referrerUsername: string
  category: string
  note: string | null
  createdAt: string
  referrerTrustScore: number
  referrerTrustAtAccept?: number | null
}

type IncomingRef = {
  id: string
  referrerUsername: string
  category: string
  note: string | null
  createdAt: string
}

type Props = {
  viewerIsOwner: boolean
  username: string
  viewerUsername: string | null
  isAuthenticated: boolean
  references: ReferenceItem[]
  incoming: IncomingRef[]
  loading: boolean
  viewerHasPendingOrAccepted: boolean
  refCategory: 'character' | 'play' | 'community' | 'technique' | 'general'
  refNote: string
  refNoteId: string
  onRefCategoryChange: (v: Props['refCategory']) => void
  onRefNoteChange: (v: string) => void
  onOfferReference: () => void
  onRespondIncoming: (id: string, action: 'accept' | 'decline') => void
}

export default function ProfileReviewsTab(props: Props) {
  const hasReferences = props.references.length > 0 || props.loading

  if (!hasReferences && !props.viewerIsOwner) {
    return (
      <EmptyState
        title="No reviews yet"
        message="Reviews, references, and reputation feedback will appear here when available."
        inline
      />
    )
  }

  if (!hasReferences && props.viewerIsOwner) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No reviews yet"
          message="Build reviews by attending events, contributing reliably, and receiving references from trusted members."
          ctaLabel="Browse events"
          ctaHref="/events"
          secondaryCtaLabel="Learn how trust works"
          secondaryCtaHref="/guidelines"
          inline
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-dc-muted leading-relaxed">
        References and peer feedback contribute to community trust alongside event participation and endorsements.
      </p>
      <ProfileReferencesPanel
        username={props.username}
        viewerUsername={props.viewerUsername}
        isAuthenticated={props.isAuthenticated}
        references={props.references}
        incoming={props.incoming}
        loading={props.loading}
        viewerHasPendingOrAccepted={props.viewerHasPendingOrAccepted}
        refCategory={props.refCategory}
        refNote={props.refNote}
        refNoteId={props.refNoteId}
        onRefCategoryChange={props.onRefCategoryChange}
        onRefNoteChange={props.onRefNoteChange}
        onOfferReference={props.onOfferReference}
        onRespondIncoming={props.onRespondIncoming}
      />
    </div>
  )
}
