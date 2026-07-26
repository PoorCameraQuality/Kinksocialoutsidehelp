import { useEffect, useId, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { uploadEventCoverFile } from '@/lib/event-cover-upload'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type Props = {
  imageUrl: string | null
  onChange: (url: string | null) => void
  /** Staged upload key when cover is chosen before an event id exists (create flow). */
  onQuarantineKeyChange?: (key: string | null) => void
  /** When set, upload promotes and attaches to this event immediately. */
  eventId?: string
  disabled?: boolean
  /** When false, show login hint instead of upload controls. */
  canUpload?: boolean
  compact?: boolean
}

const ACCEPT = 'image/png,image/jpeg,image/webp'

export default function EventCoverPhotoControl({
  imageUrl,
  onChange,
  onQuarantineKeyChange,
  eventId,
  disabled = false,
  canUpload = true,
  compact = false,
}: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const display = mediaDisplayUrl(imageUrl) ?? localPreview
  const blocked = disabled || uploading

  const clearCover = () => {
    setError(null)
    onChange(null)
    onQuarantineKeyChange?.(null)
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setUploading(true)
    const objectPreview = URL.createObjectURL(file)
    try {
      const result = await uploadEventCoverFile(file, eventId)
      if (result.url) {
        URL.revokeObjectURL(objectPreview)
        onChange(result.url)
        onQuarantineKeyChange?.(null)
        setLocalPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      } else if (result.quarantineKey) {
        onQuarantineKeyChange?.(result.quarantineKey)
        onChange(null)
        setLocalPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return objectPreview
        })
      }
    } catch (err) {
      URL.revokeObjectURL(objectPreview)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-dc-text">Cover photo</p>
        <p className="mt-1 text-dc-micro text-dc-text-muted">
          Used on the event page, calendar cards, and discovery. Wide landscape (16:9 or 3:1) works best.
          {!compact ?
            <span className="block mt-1">Optional. You can add or change it later from organizer tools.</span>
          : null}
        </p>
      </div>

      {display ?
        <div className="overflow-hidden rounded-xl border border-dc-border">
          <img src={display} alt="" className="aspect-[16/9] w-full object-cover" />
        </div>
      : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border-2 border-dashed border-dc-border bg-dc-surface text-sm text-dc-text-muted">
          No cover photo yet
        </div>
      )}

      {!canUpload ?
        <p className="text-sm text-dc-text-muted">Log in to upload a cover photo.</p>
      : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={blocked}
            onChange={(e) => void onFileChange(e)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={blocked}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : display ? 'Replace photo' : 'Upload photo'}
          </Button>
          {display ?
            <Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={clearCover}>
              Remove
            </Button>
          : null}
        </div>
      )}

      {error ?
        <p className="text-sm text-dc-danger" role="alert">
          {error}
        </p>
      : null}
    </div>
  )
}
