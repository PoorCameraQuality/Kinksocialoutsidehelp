import Badge from '@/components/ui/Badge'

type Props = {
  showAuthor?: boolean
  showModerator?: boolean
}

export default function ForumPostRoleBadges({ showAuthor, showModerator }: Props) {
  if (!showAuthor && !showModerator) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showAuthor ?
        <Badge variant="accent" className="text-[10px]">
          Author
        </Badge>
      : null}
      {showModerator ?
        <Badge
          variant="neutral"
          className="border-blue-500/30 bg-blue-500/20 text-[10px] text-blue-300"
        >
          Moderator
        </Badge>
      : null}
    </span>
  )
}
