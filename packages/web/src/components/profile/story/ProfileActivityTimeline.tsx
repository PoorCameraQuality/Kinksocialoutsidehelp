import { Link } from 'react-router-dom'

import type { ProfileStoryActivityItem } from '@/lib/profile-story/types'

import ProfileCard from './ProfileCard'

import { profileStoryBodyText } from './profile-story-classes'

import { activityIcon, IconActivity } from './ProfileStoryIcons'



type Props = {

  items: ProfileStoryActivityItem[]

  viewerIsOwner: boolean

}



export default function ProfileActivityTimeline({ items, viewerIsOwner }: Props) {

  if (items.length === 0) {

    return (

      <ProfileCard title="Recent Activity" icon={<IconActivity />}>

        <p className={profileStoryBodyText}>

          {viewerIsOwner ?

            'Activity will appear here when you join groups, host events, publish posts, or update your profile.'

          : 'No public activity yet.'}

        </p>

        {viewerIsOwner ?

          <Link to="/events" className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">

            Browse events

          </Link>

        : null}

      </ProfileCard>

    )

  }



  return (

    <ProfileCard title="Recent Activity" icon={<IconActivity />}>

      <ul className="relative space-y-0">

        {items.map((item, i) => (

          <li key={item.id} className="relative flex gap-3.5 pb-6 last:pb-0">

            {i < items.length - 1 ?

              <span className="absolute left-[17px] top-9 bottom-0 w-px bg-white/[0.08]" aria-hidden />

            : null}

            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dc-accent/[0.08] text-dc-accent ring-1 ring-inset ring-white/[0.06]">

              {activityIcon(item.icon)}

            </span>

            <div className="min-w-0 flex-1 pt-1">

              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">

                <div>

                  {item.href ?

                    <Link to={item.href} className="font-medium text-dc-text hover:text-dc-accent">

                      {item.title}

                    </Link>

                  : <p className="font-medium text-dc-text">{item.title}</p>}

                  {item.subtitle ?

                    <p className="mt-0.5 text-sm leading-relaxed text-dc-text-muted/90">{item.subtitle}</p>

                  : null}

                </div>

                {item.when ?

                  <time className="shrink-0 text-xs text-dc-muted/80">{item.when}</time>

                : null}

              </div>

            </div>

          </li>

        ))}

      </ul>

    </ProfileCard>

  )

}


