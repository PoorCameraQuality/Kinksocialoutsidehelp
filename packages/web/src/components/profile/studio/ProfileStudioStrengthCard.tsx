import { Link } from 'react-router-dom'

import type { StudioCheckItem } from '@/lib/profile-studio/completion'

import ProfileCard from '@/components/profile/story/ProfileCard'

import { profileStudioSectionCardClass } from './profile-studio-classes'

import { IconStar } from '@/components/profile/story/ProfileStoryIcons'



type Props = {

  score: number

  essentials: StudioCheckItem[]

  boosters: StudioCheckItem[]

  nextSteps: string[]

  /** Compact card for mobile profile page — full checklist lives in Profile Studio. */

  compact?: boolean

}



function StrengthRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {

  const r = size === 'sm' ? 24 : 32

  const dim = size === 'sm' ? 56 : 80

  const c = 2 * Math.PI * r

  const offset = c - (score / 100) * c

  return (

    <div className="relative shrink-0" style={{ width: dim, height: dim }} aria-hidden>

      <svg className="-rotate-90" width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>

        <circle

          cx={dim / 2}

          cy={dim / 2}

          r={r}

          fill="none"

          stroke="currentColor"

          strokeWidth={size === 'sm' ? 5 : 6}

          className="text-dc-border"

        />

        <circle

          cx={dim / 2}

          cy={dim / 2}

          r={r}

          fill="none"

          stroke="currentColor"

          strokeWidth={size === 'sm' ? 5 : 6}

          strokeDasharray={c}

          strokeDashoffset={offset}

          strokeLinecap="round"

          className="text-dc-accent transition-all duration-500"

        />

      </svg>

      <span

        className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums text-dc-text ${

          size === 'sm' ? 'text-sm' : 'text-base'

        }`}

      >

        {score}%

      </span>

    </div>

  )

}



export default function ProfileStudioStrengthCard({

  score,

  essentials,

  boosters,

  nextSteps,

  compact = false,

}: Props) {

  const headline = score >= 80 ? 'Looking great' : score >= 55 ? 'Strong progress' : 'Getting started'

  const incompleteBoosters = boosters.filter((b) => !b.complete)

  const topSteps = nextSteps.slice(0, 2)



  if (compact) {

    return (

      <ProfileCard title="Your profile" icon={<IconStar />} className={profileStudioSectionCardClass}>

        <div className="flex items-center gap-3">

          <StrengthRing score={score} size="sm" />

          <div className="min-w-0 flex-1">

            <p className="text-sm font-medium text-dc-text">{headline}</p>

            <p className="text-xs text-dc-muted">{score}% complete</p>

          </div>

          <Link

            to="/profile/edit"

            className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-dc-accent px-3 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"

          >

            Improve profile

          </Link>

        </div>

        {topSteps.length > 0 ?

          <ul className="mt-3 space-y-1 border-t border-dc-border/60 pt-3 text-xs text-dc-text-muted">

            {topSteps.map((step) => (

              <li key={step}>· {step}</li>

            ))}

          </ul>

        : incompleteBoosters.length > 0 ?

          <ul className="mt-3 space-y-1 border-t border-dc-border/60 pt-3 text-xs text-dc-text-muted">

            {incompleteBoosters.slice(0, 2).map((item) => (

              <li key={item.key}>· {item.label}</li>

            ))}

          </ul>

        : null}

      </ProfileCard>

    )

  }



  return (

    <ProfileCard title="Your profile" icon={<IconStar />} className={profileStudioSectionCardClass} variant="hero">

      <div className="flex items-center gap-4">

        <StrengthRing score={score} />

        <div>

          <p className="text-sm font-medium text-dc-text">{headline}</p>

          <p className="mt-0.5 text-xs text-dc-muted">Private guide to help you feel at home — not a public score.</p>

        </div>

      </div>



      <div className="mt-4 hidden sm:block">

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc-muted">Profile essentials</p>

        <ul className="space-y-1.5 text-sm">

          {essentials.map((item) => (

            <li key={item.key} className="flex items-center gap-2 text-dc-text-muted">

              <span className={item.complete ? 'text-emerald-400' : 'text-dc-muted'} aria-hidden>

                {item.complete ? '✓' : '○'}

              </span>

              {item.label}

            </li>

          ))}

        </ul>

      </div>



      <div className="mt-4 hidden lg:block">

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc-muted">Connection boosters</p>

        <ul className="space-y-1.5 text-sm">

          {boosters.map((item) => (

            <li key={item.key} className="flex items-center gap-2 text-dc-text-muted">

              <span className={item.complete ? 'text-emerald-400' : 'text-dc-accent/70'} aria-hidden>

                {item.complete ? '✓' : '·'}

              </span>

              {item.label}

            </li>

          ))}

        </ul>

      </div>



      {nextSteps.length > 0 ?

        <div className="mt-4 hidden sm:block rounded-xl border border-dc-border/60 bg-dc-surface-muted/25 p-3">

          <p className="mb-2 text-xs font-semibold text-dc-text">Next best steps</p>

          <ul className="space-y-1 text-xs text-dc-text-muted">

            {nextSteps.map((step) => (

              <li key={step}>· {step}</li>

            ))}

          </ul>

        </div>

      : null}



      <Link to="/profile/edit" className="mt-4 inline-block text-xs font-medium text-dc-accent hover:underline">

        See how to improve

      </Link>

    </ProfileCard>

  )

}


