import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'

export type PermissionDeniedPanelProps = {
  title?: string
  message: string
  detail?: string
  backLabel?: string
  backHref: string
  className?: string
}

/** Signed-in user lacks access - explain why and offer a clear exit. */
export default function PermissionDeniedPanel({
  title = 'Access not available',
  message,
  detail,
  backLabel = 'Go back',
  backHref,
  className = '',
}: PermissionDeniedPanelProps) {
  return (
    <div className={`flex flex-1 items-center justify-center p-4 ${className}`.trim()} role="alert">
      <Card className="max-w-md p-8 text-center">
        <p className="text-lg font-semibold text-dc-text">{title}</p>
        <p className="mt-2 text-sm text-dc-text-muted">{message}</p>
        {detail ? <p className="mt-2 text-sm text-dc-text-muted">{detail}</p> : null}
        <Link
          to={backHref}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          {backLabel}
        </Link>
      </Card>
    </div>
  )
}
