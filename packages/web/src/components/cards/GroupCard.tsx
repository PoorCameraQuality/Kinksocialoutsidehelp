import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import TagLink from '@/components/TagLink'
import MediaCard from '@/components/ui/MediaCard'

export type GroupMemberAvatar = {
  userId: string
  avatarUrl?: string | null
  displayName?: string | null
}

export type GroupCardProps = {
  group: {
    id: string
    name: string
    members: number
    category?: string | null
    description?: string
    descriptionSnippet?: string | null
    location?: string
    distanceMi?: number
    tags?: string[]
    joinMode?: 'open' | 'apply'
    coverImageUrl?: string | null
    memberAvatars?: GroupMemberAvatar[]
  }
}

function MemberAvatarStack({ avatars, total }: { avatars: GroupMemberAvatar[]; total: number }) {
  if (avatars.length === 0 && total === 0) return null
  const shown = avatars.slice(0, 3)
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex -space-x-2" aria-hidden={shown.length > 0}>
        {shown.map((m) => (
          <span
            key={m.userId}
            className="inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-dc-surface-card"
          >
            {m.avatarUrl ?
              <img src={m.avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            : <PlaceholderAvatar size="sm" className="h-7 w-7" />}
          </span>
        ))}
      </div>
      <p className="text-sm text-dc-muted">
        {total.toLocaleString()} member{total === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export default function GroupCard({ group }: GroupCardProps) {
  const {
    id,
    name,
    members,
    category,
    description,
    descriptionSnippet,
    location,
    tags,
    joinMode,
    coverImageUrl,
    memberAvatars,
  } = group
  const snippet = descriptionSnippet ?? description

  return (
    <MediaCard
      to={`/groups/${id}`}
      mediaClassName="aspect-[2/1] bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid flex items-center justify-center overflow-hidden"
      media={
        <>
          {category ?
            <span className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-lg bg-dc-elevated/95 px-2 py-1 text-xs font-medium text-dc-text backdrop-blur-sm pointer-events-none">
              {category}
            </span>
          : null}
          {coverImageUrl ?
            <img
              src={coverImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          : <svg className="w-12 h-12 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
        </>
      }
    >
      <h3 className="font-medium text-dc-text truncate">{name}</h3>
      {memberAvatars && memberAvatars.length > 0 ?
        <MemberAvatarStack avatars={memberAvatars} total={members} />
      : <p className="text-sm text-dc-muted mt-1">{members} members</p>}
      {snippet ?
        <p className="text-sm text-dc-text-muted mt-2 line-clamp-2">{snippet}</p>
      : null}
      {location ?
        <p className="text-xs text-dc-muted mt-1 truncate">
          {location}
          {group.distanceMi != null ? ` · ${group.distanceMi} mi` : null}
        </p>
      : null}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.slice(0, 3).map((t) => (
            <TagLink key={t} tag={t} />
          ))}
        </div>
      )}
      {joinMode ?
        <p className="mt-3 text-xs font-medium text-dc-text-muted">
          {joinMode === 'apply' ? 'Apply to join on group page' : 'Open group to join'}
        </p>
      : null}
    </MediaCard>
  )
}
