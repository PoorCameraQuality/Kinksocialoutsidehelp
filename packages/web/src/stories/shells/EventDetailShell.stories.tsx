import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import EventSocialOrientation from '@/components/events/EventSocialOrientation'
import ContentSection from '@/components/ui/ContentSection'
import Button from '@/components/ui/Button'
import { RSVP_LABEL_INTERESTED } from '@c2k/shared'

const meta = {
  title: 'Shells/Event Detail',
  parameters: { providers: { maxWidth: '960px' } },
} satisfies Meta

export default meta
type Story = StoryObj

const mockEvent = {
  title: 'East Coast Rope Social',
  whenLine: 'Sat, Jul 12 · 7:00 PM – 10:00 PM EDT',
  location: 'Private venue · Baltimore, MD',
  rsvpCount: 24,
  consentPolicy: 'Negotiate before touch. Use safewords. No means no.',
  rules: 'No photography in play spaces. Dungeon monitors have final say.',
}

function EventHubOrientationDemo() {
  const [, setTab] = useState('Overview')
  return (
    <EventSocialOrientation
      hostUsername="RopeDreamer"
      hostName="Alex Morgan"
      orgSlug="mid-atlantic-rope"
      groupId="rope-social-baltimore"
      groupName="Baltimore Rope Social"
      apiBacked
      hasDiscussionTab
      timingStatus="upcoming"
      onSelectTab={setTab}
    />
  )
}

function OverviewPanelShellDemo() {
  return (
    <ContentSection className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">About</h3>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          Monthly social for rope enthusiasts — skill shares, open tying, and community hangout. All experience levels
          welcome; bring your own rope if you have it.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Consent &amp; boundaries</h3>
        <p className="text-sm text-dc-text-muted">{mockEvent.consentPolicy}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Venue rules</h3>
        <p className="text-sm text-dc-text-muted">{mockEvent.rules}</p>
      </div>
    </ContentSection>
  )
}

function RsvpSidebarShellDemo() {
  return (
    <div className="max-w-sm">
      <ContentSection padding="sidebar" className="dc-card-polish">
        <h2 className="text-lg font-semibold text-dc-text mb-2">{mockEvent.title}</h2>
        <p className="text-sm text-dc-text-muted">{mockEvent.whenLine}</p>
        <p className="text-sm text-dc-muted mt-1">{mockEvent.location}</p>
        <p className="text-sm text-dc-accent mt-2">{mockEvent.rsvpCount} going · cap 40</p>
        <div className="flex flex-col gap-2 mt-4">
          <Button className="w-full">Going</Button>
          <Button variant="secondary" className="w-full">
            {RSVP_LABEL_INTERESTED}
          </Button>
          <Button variant="ghost" className="w-full">
            Can&apos;t go
          </Button>
        </div>
        <p className="text-xs text-dc-muted mt-3">Sign in to RSVP on live events.</p>
      </ContentSection>
    </div>
  )
}

export const EventHubOrientation: Story = {
  render: () => <EventHubOrientationDemo />,
}

export const OverviewPanelShell: Story = {
  render: () => <OverviewPanelShellDemo />,
}

export const RsvpSidebarShell: Story = {
  parameters: { providers: { maxWidth: '420px' } },
  render: () => <RsvpSidebarShellDemo />,
}

export const CombinedLayout: Story = {
  render: () => (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-6">
        <EventHubOrientationDemo />
        <OverviewPanelShellDemo />
      </div>
      <RsvpSidebarShellDemo />
    </div>
  ),
}
