import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import type { SocialPersonPreview } from '@/lib/profile-social-types'

type Props = {
  people: SocialPersonPreview[]
  columns?: 4 | 5
}

export default function SocialAvatarGrid({ people, columns = 5 }: Props) {
  if (people.length === 0) return null

  const gridClass = columns === 4 ? 'grid-cols-4' : 'grid-cols-5'

  return (
    <ul className={`grid ${gridClass} gap-1.5`} aria-label="Member avatars">
      {people.map((person) => {
        const label = person.displayName?.trim() || person.username
        return (
          <li key={person.username}>
            <Link
              to={`/profile/${encodeURIComponent(person.username)}`}
              className="block aspect-square overflow-hidden rounded-lg ring-1 ring-dc-border/80 transition hover:ring-dc-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
              aria-label={label}
            >
              {person.avatarUrl ?
                <img
                  src={person.avatarUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              : <PlaceholderAvatar size="sm" className="h-full w-full rounded-none" />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
