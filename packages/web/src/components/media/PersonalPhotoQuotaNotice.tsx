import {
  personalPhotoQuotaInlineLabel,
  personalPhotoQuotaStatusMessage,
  type PersonalPhotoQuota,
} from '@c2k/shared'
import StatusBanner from '@/components/ui/StatusBanner'

type Props = {
  quota: PersonalPhotoQuota | null
  className?: string
  showCount?: boolean
}

export default function PersonalPhotoQuotaNotice({
  quota,
  className = '',
  showCount = true,
}: Props) {
  if (!quota) return null

  const statusMessage = personalPhotoQuotaStatusMessage(quota)
  const showBanner = Boolean(statusMessage)

  return (
    <div className={className}>
      {showCount ?
        <p className="mb-1 text-[11px] text-dc-muted">{personalPhotoQuotaInlineLabel(quota)}</p>
      : null}
      {showBanner ?
        <StatusBanner tone={quota.atLimit ? 'warning' : 'info'}>{statusMessage}</StatusBanner>
      : null}
    </div>
  )
}
