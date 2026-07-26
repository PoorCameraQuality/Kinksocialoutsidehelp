import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import {
  profilePhotoImageStyle,
  type ProfilePhotoDisplaySettings,
} from '@c2k/shared'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type Props = {
  src: string
  alt?: string
  displaySettings?: ProfilePhotoDisplaySettings | null
  className?: string
  style?: CSSProperties
}

export default function ProfilePhotoImage({
  src,
  alt = '',
  displaySettings,
  className = 'h-full w-full',
  style,
}: Props) {
  const [failed, setFailed] = useState(false)
  const resolvedSrc = mediaDisplayUrl(src)

  useEffect(() => {
    setFailed(false)
  }, [resolvedSrc])

  if (!resolvedSrc || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid ${className}`}>
        <svg className="h-10 w-10 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={{ ...profilePhotoImageStyle(displaySettings), ...style }}
      onError={() => setFailed(true)}
    />
  )
}
