import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import IsoShareActions from '@/components/profile/IsoShareActions'
import ProfileIsoView, { type ProfileIsoPayload } from '@/components/profile/ProfileIsoView'
import type { IsoBoardViewItem } from '@/lib/iso-board-view'

export type IsoBoardFullSource = {
  item: IsoBoardViewItem
  body: string
  structured?: unknown
  acceptDmsViaIso?: boolean
}

/** Full ISO card sheet — never navigates to /profile (Dancecard stay-path safe). */
export default function IsoBoardFullSheet({
  source,
  onClose,
  onEditIso,
  onMessage,
  messagingBusy,
}: {
  source: IsoBoardFullSource | null
  onClose: () => void
  onEditIso?: () => void
  onMessage?: () => void
  messagingBusy?: boolean
}) {
  if (!source) return null

  const { item, body, structured, acceptDmsViaIso } = source
  const iso: ProfileIsoPayload = {
    body: body.trim() || item.legacyExcerpt || 'Listed on this ISO board.',
    visibility: 'public',
    acceptDmsViaIso: Boolean(acceptDmsViaIso ?? item.acceptsIsoMessages),
    updatedAt: new Date().toISOString(),
    images: [],
    structured,
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item.isSelf ? 'Your ISO card' : `${item.displayName} ISO`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative mt-auto flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-dc-border bg-dc-elevated shadow-[var(--dc-shadow-panel)] sm:mx-auto sm:mt-8 sm:mb-8 sm:max-h-[min(88dvh,52rem)] sm:max-w-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-2 border-b border-dc-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:rounded-t-2xl">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-2 text-sm font-medium text-dc-text-muted"
          >
            ‹ Back
          </button>
          <p className="text-sm font-semibold text-dc-text">
            {item.isSelf ? 'Your ISO card' : 'Full ISO'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-2 text-sm font-medium text-dc-accent"
          >
            Done
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center gap-3">
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover border border-dc-border"
              />
            ) : (
              <PlaceholderAvatar size="sm" className="h-12 w-12 rounded-full" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold text-dc-text">{item.displayName}</p>
              <p className="text-[13px] text-dc-muted">@{item.username}</p>
            </div>
          </div>

          <ProfileIsoView
            iso={iso}
            targetUsername={item.username}
            targetUserId={item.userId}
            viewerIsSelf={item.isSelf}
            isAuthenticated={false}
            hideOwnerChrome
            onEditIso={
              onEditIso
                ? () => {
                    onClose()
                    onEditIso()
                  }
                : undefined
            }
          />

          {item.isSelf ? (
            <div className="mt-4 space-y-3">
              <IsoShareActions username={item.username} canSharePublicly={false} />
              {onEditIso ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onEditIso()
                  }}
                  className="min-h-11 w-full rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
                >
                  Edit my ISO
                </button>
              ) : null}
            </div>
          ) : item.acceptsIsoMessages && onMessage ? (
            <button
              type="button"
              disabled={messagingBusy}
              onClick={onMessage}
              className="mt-4 min-h-11 w-full rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
            >
              {messagingBusy ? 'Opening…' : 'Message about a scene'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
