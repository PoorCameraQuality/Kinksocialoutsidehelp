import type { Meta, StoryObj } from '@storybook/react'
import Card from '@/components/ui/Card'
import RailCard from '@/components/ui/RailCard'
import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'

const meta = {
  title: 'UI/Cards',
  parameters: { providers: { maxWidth: '640px' } },
} satisfies Meta

export default meta
type Story = StoryObj

export const BaseCard: Story = {
  render: () => (
    <Card padding="md">
      <p className="text-sm text-dc-text">Base panel card with medium padding.</p>
    </Card>
  ),
}

export const ElevatedInteractive: Story = {
  render: () => (
    <Card interactive padding="md" className="cursor-pointer">
      <p className="font-medium text-dc-text">Interactive card</p>
      <p className="mt-1 text-sm text-dc-text-muted">Hover/focus uses shared card surface tokens.</p>
    </Card>
  ),
}

export const NestedCard: Story = {
  render: () => (
    <Card padding="md">
      <p className="mb-3 text-sm font-semibold text-dc-text">Outer card</p>
      <Card padding="sm" className="bg-dc-elevated-muted/40">
        <p className="text-sm text-dc-text-muted">Nested inner card for grouped content.</p>
      </Card>
    </Card>
  ),
}

export const RailCardExample: Story = {
  render: () => (
    <RailCard title="Upcoming near you" footerHref="/events" footerLabel="Browse events →">
      <ul className="space-y-2 text-sm text-dc-text-muted">
        <li>Community Munch · Fri Jun 12</li>
        <li>Rope Lab · Sat Jun 20</li>
      </ul>
    </RailCard>
  ),
}

export const WarningInfoCard: Story = {
  render: () => (
    <Card padding="md" className="border-amber-500/30 bg-amber-500/10">
      <p className="text-sm font-semibold text-amber-100">Heads up</p>
      <p className="mt-1 text-sm text-amber-100/90">Use warning surfaces sparingly for moderation or safety notices.</p>
    </Card>
  ),
}

export const CardWithMenu: Story = {
  render: () => (
    <Card padding="md" className="relative">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-dc-text">Card with overflow menu</p>
          <p className="mt-1 text-sm text-dc-text-muted">Menu uses portal layering (`z-dc-dropdown`).</p>
        </div>
        <CopyLinkOverflowMenu path="/share/post/story-post-1" />
      </div>
    </Card>
  ),
}

export const EmptyCardShell: Story = {
  render: () => (
    <Card padding="lg" className="min-h-[160px] border-dashed border-dc-border/80">
      <p className="text-center text-sm text-dc-muted">Empty card shell — pair with EmptyState content.</p>
    </Card>
  ),
}
