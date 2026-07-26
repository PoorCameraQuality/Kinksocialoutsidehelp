import { formatProfilePhotoCredit } from '@c2k/shared'

type Props = {
  caption?: string | null
  className?: string
}

export default function ProfilePhotoCredit({ caption, className = '' }: Props) {
  const text = formatProfilePhotoCredit(caption)
  if (!text) return null
  return (
    <p className={`text-[11px] leading-snug text-dc-muted ${className}`.trim()} role="note">
      {text}
    </p>
  )
}
