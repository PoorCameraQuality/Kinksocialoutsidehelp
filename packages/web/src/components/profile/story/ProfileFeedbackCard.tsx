import ProfileCard from './ProfileCard'

import { profileStoryBodyText } from './profile-story-classes'

import { IconStar } from './ProfileStoryIcons'



type Props = {

  displayName: string

  referencesCount: number

  viewerIsOwner: boolean

  onAddReference?: () => void

  canOfferReference?: boolean

}



export default function ProfileFeedbackCard({

  displayName,

  referencesCount,

  viewerIsOwner,

  onAddReference,

  canOfferReference,

}: Props) {

  return (

    <ProfileCard title="Community Feedback" icon={<IconStar />}>

      {referencesCount > 0 ?

        <>

          <p className="text-3xl font-bold tabular-nums tracking-tight text-dc-text">{referencesCount}</p>

          <p className="mt-1 text-sm text-dc-muted/80">

            Reference{referencesCount === 1 ? '' : 's'} for community participation

          </p>

        </>

      : (

        <>

          <p className="text-sm font-medium text-dc-text">No references yet</p>

          <p className={`mt-2 ${profileStoryBodyText}`}>

            {viewerIsOwner ?

              'When community members vouch for your participation, references appear here.'

            : `Be the first to vouch for ${displayName}'s community participation.`}

          </p>

          {!viewerIsOwner && canOfferReference && onAddReference ?

            <button

              type="button"

              onClick={onAddReference}

              className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-dc-accent/10 px-4 text-sm font-medium text-dc-accent ring-1 ring-inset ring-dc-accent/25 hover:bg-dc-accent/15"

            >

              Add reference

            </button>

          : null}

        </>

      )}

    </ProfileCard>

  )

}


