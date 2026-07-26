import type { Meta, StoryObj } from '@storybook/react'
import { cardSurfacePanelClass, cardSurfaceSolidClass } from '@/lib/card-surface'

const meta = {
  title: 'Foundations/Surfaces',
  parameters: { layout: 'fullscreen', providers: { maxWidth: '960px' } },
} satisfies Meta

export default meta
type Story = StoryObj

export const SurfaceLadder: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-dc-border bg-dc-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-dc-muted">App shell</p>
        <p className="mt-2 text-sm text-dc-text">Page background (`bg-dc-surface`)</p>
      </div>
      <div className={`rounded-2xl border border-dc-border p-6 ${cardSurfacePanelClass}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-dc-muted">Panel card</p>
        <p className="mt-2 text-sm text-dc-text">Directory / section panels</p>
      </div>
      <div className={`rounded-2xl border border-dc-border p-6 ${cardSurfaceSolidClass}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-dc-muted">Solid card</p>
        <p className="mt-2 text-sm text-dc-text">Interactive cards and feed posts</p>
      </div>
      <div className="rounded-2xl border border-dc-accent/40 bg-dc-accent-muted/20 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Accent surface</p>
        <p className="mt-2 text-sm text-dc-text">Highlights, badges, selected tabs</p>
      </div>
    </div>
  ),
}

export const TextHierarchy: Story = {
  render: () => (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-dc-text">Page title</h1>
      <h2 className="text-xl font-semibold text-dc-text">Section heading</h2>
      <p className="text-base text-dc-text">Primary body copy for member-facing content.</p>
      <p className="text-sm text-dc-text-muted">Secondary / supporting text on cards and rails.</p>
      <p className="text-xs uppercase tracking-wider text-dc-muted">Eyebrow / meta label</p>
    </div>
  ),
}

export const AccentUsage: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <span className="rounded-full border border-dc-accent/50 bg-dc-accent-muted px-3 py-1 text-xs font-semibold text-dc-accent">
        Primary accent pill
      </span>
      <span className="rounded-full border border-dc-border bg-dc-elevated-muted px-3 py-1 text-xs font-medium text-dc-text-muted">
        Neutral pill
      </span>
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
        Success / verified
      </span>
    </div>
  ),
}
