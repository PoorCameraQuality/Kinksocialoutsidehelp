import PlaceholderAvatar from '@/components/PlaceholderAvatar'

const sizeClasses = {
  sm: 'h-8 w-8 min-h-8 min-w-8',
  md: 'h-12 w-12 min-h-12 min-w-12',
  lg: 'h-16 w-16 min-h-16 min-w-16',
  xl: 'h-full w-full min-h-[3rem] min-w-[3rem]',
} as const

type Props = {
  avatarUrl?: string | null
  alt?: string
  size?: keyof typeof sizeClasses
  className?: string
}

export default function UserAvatar({ avatarUrl, alt = '', size = 'md', className = '' }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={alt}
        className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
      />
    )
  }
  return <PlaceholderAvatar size={size} className={className} />
}
