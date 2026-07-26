import { siteConfig } from '@/config/site.config'

type Props = {
  className?: string
}

export default function SiteWordmark({ className = '' }: Props) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`.trim()}>
      {siteConfig.brandWordmark}
    </span>
  )
}
