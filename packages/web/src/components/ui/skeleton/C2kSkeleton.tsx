import { DancecardPanelSkeleton } from '@/components/dancecard/organizer/ui/DancecardSkeleton'

function FeedCardSkeletonItem() {
  return (
    <div className="rounded-2xl border border-dc-border/80 bg-dc-elevated-solid p-3 shadow-[var(--dc-shadow-soft)] lg:p-4">
      <div className="flex gap-3">
        <div className="dc-skeleton-bone h-11 w-11 flex-shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="dc-skeleton-bone h-3.5 w-32 rounded-lg" />
          <div className="dc-skeleton-bone h-3 w-full rounded-lg" />
          <div className="dc-skeleton-bone h-3 w-11/12 rounded-lg" />
          <div className="dc-skeleton-bone h-3 w-2/3 rounded-lg" />
        </div>
      </div>
      <div className="mt-3 flex gap-2 border-t border-dc-border/50 pt-3 lg:mt-2.5 lg:pt-2.5">
        <div className="dc-skeleton-bone h-11 w-24 rounded-xl" />
        <div className="dc-skeleton-bone h-11 w-20 rounded-xl" />
        <div className="dc-skeleton-bone h-11 w-16 rounded-xl" />
      </div>
    </div>
  )
}

/** Feed rail / activity card placeholder grid. */
export function FeedCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="dc-skeleton-stagger space-y-3 lg:space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeletonItem key={i} />
      ))}
    </div>
  )
}

/** Event card grid on home / discovery rails. */
export function HomeEventGridSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div
      className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 dc-skeleton-stagger"
      aria-busy="true"
      role="status"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid">
          <div className="dc-skeleton-bone aspect-[2/1] w-full" />
          <div className="space-y-2 p-4">
            <div className="dc-skeleton-bone h-4 w-3/4 rounded-lg" />
            <div className="dc-skeleton-bone h-3 w-1/2 rounded-lg" />
            <div className="dc-skeleton-bone h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Settings page first paint (two-column shell). */
export function PageSkeleton() {
  return (
    <div className="space-y-4 dc-skeleton-stagger" aria-busy="true" role="status">
      <div className="dc-skeleton-bone h-32 rounded-2xl border border-dc-border" />
      <div className="dc-skeleton-bone h-24 rounded-2xl border border-dc-border" />
      <div className="dc-skeleton-bone h-40 rounded-2xl border border-dc-border" />
    </div>
  )
}

export function CardSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 dc-skeleton-stagger" aria-busy="true" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dc-skeleton-bone h-36 rounded-2xl border border-dc-border" />
      ))}
    </div>
  )
}

export function ProfilePhotoGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 dc-skeleton-stagger"
      aria-busy="true"
      role="status"
      aria-label="Loading photos"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dc-skeleton-bone aspect-square rounded-xl border border-dc-border" />
      ))}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4 dc-skeleton-stagger" aria-busy="true" role="status">
      <div className="overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="dc-skeleton-bone h-40 w-40 shrink-0 rounded-2xl" />
          <div className="w-full flex-1 space-y-3">
            <div className="dc-skeleton-bone mx-auto h-7 w-48 rounded-lg sm:mx-0" />
            <div className="dc-skeleton-bone mx-auto h-4 w-28 rounded-lg sm:mx-0" />
            <div className="dc-skeleton-bone h-16 w-full max-w-md rounded-xl" />
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <div className="dc-skeleton-bone h-7 w-20 rounded-full" />
              <div className="dc-skeleton-bone h-7 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Profile hero first paint — reserves avatar + identity block height. */
export function ProfileHeroSkeleton() {
  return <ProfileSkeleton />
}

export function ConversationSkeleton() {
  return (
    <div className="space-y-3 dc-skeleton-stagger" aria-busy="true" role="status">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="dc-skeleton-bone h-10 w-10 rounded-full" />
          <div className="dc-skeleton-bone h-12 flex-1 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function ListRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2 dc-skeleton-stagger" aria-busy="true" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dc-skeleton-bone h-14 rounded-xl border border-dc-border" />
      ))}
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-4 dc-skeleton-stagger" aria-busy="true" role="status">
      <div className="overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid">
        <div className="dc-skeleton-bone aspect-[16/9] max-h-52 w-full sm:aspect-[2/1] sm:max-h-none" />
        <div className="space-y-2 p-4">
          <div className="dc-skeleton-bone h-6 w-2/3 rounded-lg" />
          <div className="dc-skeleton-bone h-4 w-1/2 rounded-lg" />
        </div>
      </div>
      <div className="dc-skeleton-bone h-4 w-full rounded-lg" />
      <ListRowSkeleton count={4} />
    </div>
  )
}

export const FeedSkeleton = FeedCardSkeleton
export const GroupSkeleton = ListRowSkeleton
export const EventSkeleton = HomeEventGridSkeleton
export const GroupDetailSkeleton = DetailPageSkeleton
export const EventDetailSkeleton = DetailPageSkeleton
export const ConventionSkeleton = ListRowSkeleton
export const ConventionDetailSkeleton = DetailPageSkeleton

export function SettingsPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 dc-panel-enter" aria-busy="true" role="status">
      <div className="dc-skeleton-bone mb-2 h-8 w-36 rounded-lg" />
      <div className="dc-skeleton-bone h-4 w-full max-w-md rounded-lg" />
      <div className="mt-6 flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 space-y-2 sm:w-52">
          <div className="dc-skeleton-bone h-9 w-full rounded-lg" />
          <div className="dc-skeleton-bone h-9 w-full rounded-lg" />
          <div className="dc-skeleton-bone h-9 w-4/5 rounded-lg" />
          <div className="dc-skeleton-bone h-9 w-full rounded-lg" />
        </div>
        <div className="min-w-0 flex-1 space-y-6">
          <DancecardPanelSkeleton lines={4} />
          <DancecardPanelSkeleton lines={3} />
        </div>
      </div>
    </div>
  )
}
