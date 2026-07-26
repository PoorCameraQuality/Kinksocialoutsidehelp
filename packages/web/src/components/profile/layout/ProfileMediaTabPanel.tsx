import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ADULT_CONTENT_PREFERENCES, type MediaContentRating, type MediaItemSummary } from '@c2k/shared'
import MediaGrid from '@/components/media/MediaGrid'
import TaggedMediaReviewPanel from '@/components/media/TaggedMediaReviewPanel'
import { ProfilePhotoGridSkeleton } from '@/components/ui/skeleton/C2kSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { useApiUserAlbums, useApiUserMedia } from '@/hooks/useApiMedia'
import { useAdultContentPreference } from '@/hooks/useAdultContentPreference'
import { cardSurfaceSolidClass } from '@/lib/card-surface'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { shouldBlurMediaForViewer, type MediaViewerContext } from '@/lib/media-visibility'

type MediaSubTab = 'pictures' | 'videos' | 'albums' | 'tagged'

type Props = {
  username: string
  apiBacked: boolean
  viewerIsOwner: boolean
  writing: ReactNode
  /** Optional profile-photo manager shown above pictures grid for owners. */
  profilePhotosSlot?: ReactNode
  mediaViewer?: MediaViewerContext
  id?: string
}

const SUB_TABS: { id: MediaSubTab; label: string }[] = [
  { id: 'pictures', label: 'Pictures' },
  { id: 'videos', label: 'Videos' },
  { id: 'albums', label: 'Albums' },
  { id: 'tagged', label: 'Tagged' },
]

function blurChecker(viewer: MediaViewerContext) {
  return (item: MediaItemSummary) =>
    shouldBlurMediaForViewer(viewer, {
      contentRating: (item.contentRating as MediaContentRating | null) ?? null,
      visibility: item.visibility,
      uploadStatus: null,
      isBlurredByDefault: item.isBlurredByDefault,
    })
}

/** Media gallery with sub-tabs plus writing column. */
export default function ProfileMediaTabPanel({
  username,
  apiBacked,
  viewerIsOwner,
  writing,
  profilePhotosSlot,
  mediaViewer: mediaViewerProp,
  id,
}: Props) {
  const [subTab, setSubTab] = useState<MediaSubTab>('pictures')
  const adultPref = useAdultContentPreference(apiBacked)
  const mediaViewer: MediaViewerContext = mediaViewerProp ?? {
    authenticated: apiBacked,
    adultContentPref: adultPref.preference ?? ADULT_CONTENT_PREFERENCES.blur,
  }

  const pictures = useApiUserMedia(username, {
    enabled: apiBacked && subTab === 'pictures',
    kind: 'image',
  })
  const videos = useApiUserMedia(username, {
    enabled: apiBacked && subTab === 'videos',
    kind: 'video',
  })
  const tagged = useApiUserMedia(username, {
    enabled: apiBacked && subTab === 'tagged',
    kind: 'all',
    tagged: true,
  })
  const albums = useApiUserAlbums(username, apiBacked && subTab === 'albums')

  const blurItem = blurChecker(mediaViewer)

  return (
    <div id={id} className="scroll-mt-24">
      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-2 xl:items-start xl:gap-10">
        <section className="min-w-0 space-y-4">
          <header className="border-b border-dc-border/70 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-dc-text">Media</h3>
                <p className="mt-1 text-sm text-dc-text-muted">Pictures, video, albums, and tags.</p>
              </div>
              {viewerIsOwner && apiBacked ?
                <Link
                  to="/create"
                  className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-accent-foreground"
                >
                  Upload
                </Link>
              : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUB_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    subTab === tab.id ?
                      'bg-dc-accent/15 text-dc-accent'
                    : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          {!apiBacked ?
            profilePhotosSlot ?? (
              <EmptyState title="Media unavailable" message="Sign in with a full account to browse media." inline compact className="text-left" />
            )
          : subTab === 'pictures' ?
            <>
              {profilePhotosSlot ?
                <div className="space-y-4">{profilePhotosSlot}</div>
              : null}
              <MediaGrid
                items={pictures.items}
                status={pictures.status}
                error={pictures.error}
                blurItem={blurItem}
                emptyTitle="No pictures"
                emptyMessage={
                  viewerIsOwner ? 'Upload pictures from Create.' : 'This member has not shared pictures yet.'
                }
              />
            </>
          : subTab === 'videos' ?
            <MediaGrid
              items={videos.items}
              status={videos.status}
              error={videos.error}
              blurItem={blurItem}
              emptyTitle="No videos"
              emptyMessage={viewerIsOwner ? 'Upload video from Create.' : 'No videos shared yet.'}
            />
          : subTab === 'tagged' ?
            <div className="space-y-4">
              {viewerIsOwner ?
                <TaggedMediaReviewPanel enabled={apiBacked} />
              : null}
              <MediaGrid
                items={tagged.items}
                status={tagged.status}
                error={tagged.error}
                blurItem={blurItem}
                emptyTitle="No tagged media"
                emptyMessage="Photos and videos where this member is tagged will appear here."
              />
            </div>
          : albums.status === 'loading' ?
            <ProfilePhotoGridSkeleton count={4} />
          : albums.status === 'error' ?
            <LoadErrorBanner message={albums.error ?? 'Could not load albums'} />
          : albums.albums.length === 0 ?
            <EmptyState title="No albums" message="Albums group related uploads." inline compact className="text-left" />
          : <div className="grid gap-3 sm:grid-cols-2">
              {albums.albums.map((album) => (
                <div key={album.id} className={`${cardSurfaceSolidClass} overflow-hidden`}>
                  <div className="relative aspect-[4/3] bg-dc-elevated-solid">
                    {album.coverPreviewUrl ?
                      <img
                        src={mediaDisplayUrl(album.coverPreviewUrl)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    : <div className="flex h-full items-center justify-center text-xs text-dc-muted">Album</div>}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-dc-text">{album.title}</p>
                    {album.description ?
                      <p className="mt-1 line-clamp-2 text-xs text-dc-text-muted">{album.description}</p>
                    : null}
                    <p className="mt-1 text-xs text-dc-muted">{album.itemCount} items</p>
                  </div>
                </div>
              ))}
            </div>}
        </section>

        <section className="min-w-0 space-y-4">
          <header className="border-b border-dc-border/70 pb-3">
            <h3 className="text-base font-semibold text-dc-text">Writing & education</h3>
            <p className="mt-1 text-sm text-dc-text-muted">Articles, journal entries, and teaching credits.</p>
          </header>
          {writing}
        </section>
      </div>
    </div>
  )
}
