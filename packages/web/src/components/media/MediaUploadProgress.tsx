import { useEffect, useState } from 'react'

/** Shared upload in-flight UI for profile photos and gallery adds. */

export type MediaUploadStage = 'uploading' | 'processing' | 'saving'

/** Playful copy while the safety scanner runs — rotates in the upload overlay. */
export const MEDIA_UPLOAD_SCAN_MESSAGES = [
  'Looking for Waldo…',
  'Located! Oh yeah — the picture upload. I knew I was doing something.',
  'Checking the pixels are behaving themselves…',
  'Running the naughty-or-nice scan…',
  'Making sure it is not a bot in a gimp mask…',
  'Almost there — tying up the loose ends (not like that)…',
] as const

function isScanStage(stage: MediaUploadStage): boolean {
  return stage === 'processing' || stage === 'saving'
}

export function mediaUploadStageLabel(stage: MediaUploadStage, scanMessage?: string): string {
  if (stage === 'uploading') return 'Sending to server…'
  return scanMessage ?? MEDIA_UPLOAD_SCAN_MESSAGES[0]
}

function useRotatingScanMessage(active: boolean): string {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setIndex(0)
      return
    }
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % MEDIA_UPLOAD_SCAN_MESSAGES.length)
    }, 2800)
    return () => window.clearInterval(timer)
  }, [active])

  return MEDIA_UPLOAD_SCAN_MESSAGES[index] ?? MEDIA_UPLOAD_SCAN_MESSAGES[0]
}

export function MediaUploadSpinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-3.5 w-3.5 border-[1.5px]' : 'h-5 w-5 border-2'
  return (
    <span
      className={`inline-block shrink-0 rounded-full border-dc-accent-border border-t-dc-accent animate-spin motion-reduce:animate-none ${dim}`}
      aria-hidden
    />
  )
}

type StatusRowProps = {
  stage: MediaUploadStage
  onCancel?: () => void
  className?: string
}

/** Inline status row — spinner + stage copy + optional cancel. */
export function MediaUploadStatusRow({ stage, onCancel, className = '' }: StatusRowProps) {
  const scanMessage = useRotatingScanMessage(isScanStage(stage))
  const label = mediaUploadStageLabel(stage, scanMessage)

  return (
    <div
      className={`flex flex-wrap items-center gap-2 dc-panel-enter motion-reduce:animate-none ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <MediaUploadSpinner size="sm" />
      <p className="text-xs text-dc-muted">{label}</p>
      {onCancel ?
        <button type="button" onClick={onCancel} className="text-xs text-dc-accent hover:underline">
          Cancel
        </button>
      : null}
    </div>
  )
}

type OverlayProps = {
  stage: MediaUploadStage
  compact?: boolean
  className?: string
}

/** Dimmed overlay with spinner — sits on top of image previews during upload. */
export function MediaUploadProgressOverlay({ stage, compact = false, className = '' }: OverlayProps) {
  const scanning = isScanStage(stage)
  const scanMessage = useRotatingScanMessage(scanning)
  const label = mediaUploadStageLabel(stage, scanMessage)

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-dc-surface/88 backdrop-blur-[3px] dc-panel-enter motion-reduce:animate-none ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <MediaUploadSpinner size={compact ? 'sm' : 'md'} />
      {scanning ?
        <div className="max-w-[min(16rem,90%)] space-y-1 text-center px-3">
          <p
            key={scanMessage}
            className={`font-medium leading-snug text-dc-text motion-safe:animate-[media-upload-message-in_0.35s_ease-out] ${compact ? 'text-[10px]' : 'text-sm'}`}
          >
            {scanMessage}
          </p>
          <p className={`text-dc-muted ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
            Safety scan in progress — this usually takes a few seconds.
          </p>
        </div>
      : <p className={`font-medium text-dc-text text-center px-3 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {label}
        </p>
      }
      <div
        className="h-0.5 w-20 overflow-hidden rounded-full bg-dc-border/60 motion-reduce:hidden"
        aria-hidden
      >
        <div className="h-full w-full origin-left animate-[media-upload-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-dc-accent/80" />
      </div>
    </div>
  )
}
