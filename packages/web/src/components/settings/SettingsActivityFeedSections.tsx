import type { FeedSettings } from '@c2k/shared'
import {
  FEED_STORY_CATALOG,
  isFeedStoryVisible,
  setAllFeedStoriesVisible,
  setFeedStoryVisible,
} from '@c2k/shared'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import { settingsCheckboxClass, settingsSelectClass } from '@/lib/settingsFormClasses'

type Props = {
  feed: FeedSettings
  onFeedChange: (next: FeedSettings) => void
}

function StoryCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
      <input
        type="checkbox"
        className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-dc-text-muted">{label}</span>
    </label>
  )
}

export function SettingsBubbleUpPanel({ feed, onFeedChange }: Props) {
  return (
    <Panel className="scroll-mt-24">
      <SectionHeader
        eyebrow="Feed"
        title="Bubble up new posts"
        description="Control how fresh content from people you follow appears in your Following feed."
      />
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
          checked={feed.bubbleUpUnseenFollowing}
          onChange={(e) => onFeedChange({ ...feed, bubbleUpUnseenFollowing: e.target.checked })}
        />
        <div>
          <span className="block text-sm text-dc-text-muted">
            Bubble up unseen posts from people you follow to the top of your feed
          </span>
          <span className="text-xs text-dc-muted">
            Changing this only affects new feed items going forward.
          </span>
        </div>
      </label>
    </Panel>
  )
}

export function SettingsEmphasizedReactionsPanel({ feed, onFeedChange }: Props) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Feed"
        title="Highlighted reactions"
        description="Strong reactions (high-trust endorsements and organizer picks) can appear as larger cards in your feed."
      />
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-dc-text-muted">
          Show emphasized reaction cards from
        </label>
        <select
          className={settingsSelectClass}
          value={feed.emphasizedReactionsFrom}
          onChange={(e) =>
            onFeedChange({
              ...feed,
              emphasizedReactionsFrom: e.target.value as FeedSettings['emphasizedReactionsFrom'],
            })
          }
        >
          <option value="everyone">Everyone on Kink Social</option>
          <option value="connections">Connections and people I follow</option>
          <option value="friends">Friends only</option>
        </select>
        <p className="mt-2 text-xs text-dc-muted">
          Emphasis styling is rolling out on Following feed; this preference is saved now.
        </p>
      </div>
    </Panel>
  )
}

export function SettingsHomeFeedPanel({ feed, onFeedChange }: Props) {
  return (
    <Panel>
      <SectionHeader eyebrow="Home" title="Default home tab" description="Which feed opens first when you visit home." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dc-border px-3 py-2">
          <input
            type="radio"
            name="homeMode"
            className={settingsCheckboxClass}
            checked={(feed.homeMode ?? 'discover') === 'discover'}
            onChange={() => onFeedChange({ ...feed, homeMode: 'discover' })}
          />
          <span className="text-sm text-dc-text-muted">Near you &amp; discover</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dc-border px-3 py-2">
          <input
            type="radio"
            name="homeMode"
            className={settingsCheckboxClass}
            checked={feed.homeMode === 'following'}
            onChange={() => onFeedChange({ ...feed, homeMode: 'following' })}
          />
          <span className="text-sm text-dc-text-muted">Following</span>
        </label>
      </div>
    </Panel>
  )
}

export function SettingsFeedStoriesPanel({ feed, onFeedChange }: Props) {
  const left = FEED_STORY_CATALOG.filter((_, i) => i % 2 === 0)
  const right = FEED_STORY_CATALOG.filter((_, i) => i % 2 === 1)

  return (
    <Panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          eyebrow="Feed"
          title="Hide / show feed stories"
          description="Choose which activity from people you follow appears in your Following feed. Uncheck to hide that story type."
        />
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            className="text-xs font-medium text-dc-accent hover:underline"
            onClick={() => onFeedChange(setAllFeedStoriesVisible(feed, true))}
          >
            Show all
          </button>
          <span className="text-dc-muted" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="text-xs font-medium text-dc-accent hover:underline"
            onClick={() => onFeedChange(setAllFeedStoriesVisible(feed, false))}
          >
            Hide all
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {[left, right].map((columns, colIdx) => (
          <div key={colIdx} className="space-y-6">
            {columns.map((category) => (
              <div key={category.id}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dc-muted mb-2">{category.title}</h3>
                <div className="space-y-0.5">
                  {category.stories.map((story) => (
                    <StoryCheckbox
                      key={story.key}
                      label={story.label}
                      checked={isFeedStoryVisible(feed, story.key)}
                      onChange={(visible) => onFeedChange(setFeedStoryVisible(feed, story.key, visible))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  )
}

export default function SettingsActivityFeedSections({ feed, onFeedChange }: Props) {
  return (
    <>
      <SettingsBubbleUpPanel feed={feed} onFeedChange={onFeedChange} />
      <SettingsEmphasizedReactionsPanel feed={feed} onFeedChange={onFeedChange} />
      <SettingsFeedStoriesPanel feed={feed} onFeedChange={onFeedChange} />
      <SettingsHomeFeedPanel feed={feed} onFeedChange={onFeedChange} />
    </>
  )
}
