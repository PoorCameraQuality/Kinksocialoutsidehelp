import type { ReactNode } from 'react'

import ProfileCard from '@/components/profile/story/ProfileCard'

import { profileStudioSectionCardClass } from './profile-studio-classes'



type Props = {

  title: string

  description: string

  icon?: ReactNode

  children: ReactNode

  id?: string

}



/** Wrapper matching public profile story cards for edit sections. */

export default function ProfileStudioSectionCard({ title, description, icon, children, id }: Props) {

  return (

    <ProfileCard id={id} className={profileStudioSectionCardClass}>

      <div className="mb-4 flex gap-3 border-b border-dc-border/60 pb-3 sm:mb-5 sm:gap-3 sm:pb-4">

        {icon ?

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/10 text-dc-accent">

            {icon}

          </span>

        : null}

        <div className="min-w-0">

          <h2 className="text-lg font-semibold text-dc-text sm:text-xl">{title}</h2>

          <p className="mt-1 text-sm leading-relaxed text-dc-text-muted">{description}</p>

        </div>

      </div>

      {children}

    </ProfileCard>

  )

}


