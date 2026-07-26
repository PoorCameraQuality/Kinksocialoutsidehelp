import type { Meta, StoryObj } from '@storybook/react'
import LocalPostCard from '@/components/cards/LocalPostCard'
import {
  storyFeedPostLong,
  storyFeedPostPhoto,
  storyFeedPostShort,
  storyFeedPostText,
  storyFeedPostWithReaction,
} from '@/stories/mocks/feed'

const meta = {
  title: 'Feed/Post Card',
  component: LocalPostCard,
  parameters: { providers: { maxWidth: '640px' } },
} satisfies Meta<typeof LocalPostCard>

export default meta
type Story = StoryObj<typeof meta>

export const TextOnly: Story = {
  args: { post: storyFeedPostText, layout: 'feed' },
}

export const VeryShort: Story = {
  args: { post: storyFeedPostShort, layout: 'feed' },
}

export const LongPost: Story = {
  args: { post: storyFeedPostLong, layout: 'feed' },
}

export const PhotoPost: Story = {
  args: { post: storyFeedPostPhoto, layout: 'feed' },
}

export const WithViewerReaction: Story = {
  args: { post: storyFeedPostWithReaction('love'), layout: 'feed' },
}

export const WithCommentsPreview: Story = {
  args: { post: storyFeedPostWithReaction('helpful'), layout: 'feed' },
}

export const Mobile390: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  args: { post: storyFeedPostPhoto, layout: 'feed' },
}
