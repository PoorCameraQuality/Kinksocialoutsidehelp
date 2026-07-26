import type { Meta, StoryObj } from '@storybook/react'
import EmptyState from '@/components/ui/EmptyState'

const meta = {
  title: 'UI/Empty States',
  component: EmptyState,
  parameters: { providers: { maxWidth: '640px' } },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyFeed: Story = {
  args: {
    title: 'Your following feed is waiting for your people.',
    message: 'Follow members, connect with friends, join groups, or RSVP to events to start filling this space.',
    actions: [
      { label: 'Find people', href: '/people', primary: true },
      { label: 'Browse events', href: '/events' },
    ],
    variant: 'surface',
    align: 'center',
  },
}

export const EmptyPeopleDirectory: Story = {
  args: {
    title: 'No people match these filters',
    message: 'Try widening location or clearing active filters.',
    actionLabel: 'Reset filters',
    onAction: () => {},
    variant: 'card',
  },
}

export const EmptyGroups: Story = {
  args: {
    title: 'No groups found',
    message: 'Try widening your location or start a new community.',
    actionLabel: 'Create a group',
    onAction: () => {},
    secondaryCtaLabel: 'Organizations',
    secondaryCtaHref: '/orgs',
  },
}

export const EmptyVendors: Story = {
  args: {
    title: 'No vendors in this area yet',
    message: 'Vendor cards are discovery-only — checkout stays on external shops.',
    ctaLabel: 'Browse all vendors',
    ctaHref: '/vendors',
    variant: 'inline',
    inline: true,
  },
}

export const EmptyEvents: Story = {
  args: {
    title: 'No upcoming events',
    message: 'Check back soon or browse conventions and virtual classes.',
    ctaLabel: 'Browse events',
    ctaHref: '/events',
  },
}

export const EmptyProfileSection: Story = {
  args: {
    title: 'No published writing yet',
    message: 'Published articles and journal entries appear here.',
    variant: 'inline',
    inline: true,
    compact: true,
  },
}

export const NoSearchResults: Story = {
  args: {
    title: 'No results',
    message: 'Nothing matched your search. Try different keywords or fewer filters.',
    actionLabel: 'Clear search',
    onAction: () => {},
    variant: 'surface',
  },
}
