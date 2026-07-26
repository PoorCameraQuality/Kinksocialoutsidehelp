import { Link } from 'react-router-dom'

import MarkdownContent from '@/components/ui/MarkdownContent'
import { cn } from '@/lib/cn'

import ProfileCard from './ProfileCard'
import { profileStoryBodyText } from './profile-story-classes'
import { IconUser } from './ProfileStoryIcons'

type Props = {
  bio: string | null
  viewerIsOwner: boolean
}

/** Bio-only "About" card. Interests now live in their own tiered card. */
export default function ProfileAboutBlock({ bio, viewerIsOwner }: Props) {
  const hasBio = Boolean(bio?.trim())

  if (!hasBio && !viewerIsOwner) return null

  return (
    <ProfileCard title="About" icon={<IconUser />}>
      {hasBio ?
        <div className={cn(profileStoryBodyText, '[&_p]:mb-3 [&_p:last-child]:mb-0')}>
          <MarkdownContent markdown={bio!} />
        </div>
      : <>
          <p className={profileStoryBodyText}>
            Add a short intro so people understand who you are and what kind of connections you welcome.
          </p>
          <Link
            to="/profile/edit/about"
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Add about
          </Link>
        </>
      }
    </ProfileCard>
  )
}
