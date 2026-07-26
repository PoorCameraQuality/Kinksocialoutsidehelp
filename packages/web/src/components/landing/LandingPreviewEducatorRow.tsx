import { Link } from 'react-router-dom'



type PersonLike = {

  id: number | string

  username: string

  sceneName?: string

  location?: string

  avatarUrl?: string | null

  verified?: boolean

}



export default function LandingPreviewEducatorRow({ person }: { person: PersonLike }) {

  const display = person.sceneName ?? person.username

  const initial = display.charAt(0).toUpperCase()



  return (

    <div className="flex min-h-11 items-center gap-3 rounded-xl p-1.5">

      {person.avatarUrl ?

        <img

          src={person.avatarUrl}

          alt=""

          className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-[rgba(216,173,54,0.25)]"

        />

      : <span

          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(216,173,54,0.15)] text-sm font-semibold text-[var(--pub-gold-bright)] ring-2 ring-[rgba(216,173,54,0.25)]"

          aria-hidden

        >

          {initial}

        </span>

      }

      <div className="min-w-0 flex-1">

        <p className="truncate text-sm font-semibold text-[var(--pub-text)]">{display}</p>

        {person.location ?

          <p className="truncate text-xs text-[var(--pub-text-soft)]">{person.location}</p>

        : null}

        {person.verified ?

          <p className="text-[11px] font-medium text-[var(--pub-gold-bright)]">Educator</p>

        : null}

      </div>

      <Link

        to={`/profile/${encodeURIComponent(person.username)}`}

        className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[rgba(240,201,77,0.35)] px-3 text-xs font-semibold text-[var(--pub-gold-bright)] hover:bg-white/5"

      >

        Follow

      </Link>

    </div>

  )

}

