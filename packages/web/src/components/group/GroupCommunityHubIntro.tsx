import type { MockGroup } from '@/data/types'
import MarkdownContent from '@/components/ui/MarkdownContent'

type Props = {
  group: Pick<MockGroup, 'description' | 'visibility' | 'descriptionSnippet'>
  isMember: boolean
  apiBacked: boolean
  upcomingEventCount: number
  canModerate: boolean
  onGoToTab: (tab: string) => void
}

function visibilityLabel(visibility: MockGroup['visibility'] | undefined): string {
  if (visibility === 'private') return 'Private group'
  if (visibility === 'invite-only') return 'Invite-only group'
  return 'Public group'
}

export default function GroupCommunityHubIntro({
  group,
  isMember,
  apiBacked,
  upcomingEventCount,
  canModerate,
  onGoToTab,
}: Props) {
  const description = group.description?.trim() || group.descriptionSnippet?.trim() || null

  return (
    <section
      className="mb-6 rounded-2xl border border-dc-border bg-dc-elevated/50 p-4 sm:p-5 shadow-[var(--dc-shadow-soft)]"
      aria-label="About this group"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Community hub</p>
          {description ?
            <MarkdownContent markdown={description} className="c2k-rich-html text-sm leading-relaxed text-dc-text" />
          : <p className="text-sm text-dc-text-muted">
              {apiBacked ?
                'A place for members to discuss, meet, and show up together.'
              : 'Explore what this community is about.'}
            </p>
          }
          <ul className="space-y-1 text-sm text-dc-text-muted">
            <li>
              <span className="font-medium text-dc-text">You:</span>{' '}
              {isMember ? 'Member — join discussions and group events.' : 'Not a member yet — join to participate.'}
            </li>
            {apiBacked && !isMember ?
              <li>
                Joining may ask how you appear on the member list and whether your join is announced in feed or on
                your profile.
              </li>
            : null}
            <li>
              <span className="font-medium text-dc-text">Visibility:</span> {visibilityLabel(group.visibility)}
            </li>
            {canModerate ?
              <li>
                <span className="font-medium text-dc-text">Your role:</span> You can moderate discussions and help
                keep this space safe.
              </li>
            : null}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {apiBacked ?
            <>
              <button
                type="button"
                onClick={() => onGoToTab('Forums')}
                className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                {isMember ? 'Start a discussion' : 'Read discussions'}
              </button>
              <button
                type="button"
                onClick={() => onGoToTab('Events')}
                className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              >
                {upcomingEventCount > 0 ?
                  `Upcoming events (${upcomingEventCount})`
                : 'Group events'}
              </button>
              <button
                type="button"
                onClick={() => onGoToTab('Members')}
                className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              >
                Members & moderation
              </button>
            </>
          : null}
        </div>
      </div>
    </section>
  )
}
