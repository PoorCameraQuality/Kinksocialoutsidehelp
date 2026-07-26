import Button from '@/components/ui/Button'
import StatusBanner from '@/components/ui/StatusBanner'

type Props = {
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export default function LoadErrorBanner({ message, onRetry, retryLabel = 'Retry', className }: Props) {
  return (
    <StatusBanner tone="error" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </StatusBanner>
  )
}
