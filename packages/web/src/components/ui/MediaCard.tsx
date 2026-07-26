import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import { cn } from '@/lib/cn'

type Props = {
  to: string
  media: React.ReactNode
  children: React.ReactNode
  className?: string
  mediaClassName?: string
}

export default function MediaCard({ to, media, children, className, mediaClassName }: Props) {
  return (
    <Card interactive className={cn('overflow-hidden', className)}>
      <Link to={to} className={cn('relative block bg-dc-surface-muted', mediaClassName)}>
        {media}
      </Link>
      <div className="p-4">{children}</div>
    </Card>
  )
}
