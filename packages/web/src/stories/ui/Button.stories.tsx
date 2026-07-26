import type { Meta, StoryObj } from '@storybook/react'
import Button from '@/components/ui/Button'

const meta = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { children: 'Primary action', variant: 'primary' } }
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } }
export const Ghost: Story = { args: { children: 'Ghost / subtle', variant: 'ghost' } }
export const Danger: Story = { args: { children: 'Delete', variant: 'danger' } }
export const Disabled: Story = { args: { children: 'Disabled', disabled: true } }
export const Small: Story = { args: { children: 'Small', size: 'sm', variant: 'secondary' } }

export const IconButton: Story = {
  render: () => (
    <Button variant="secondary" size="sm" aria-label="Create">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </Button>
  ),
}

export const MobileFullWidth: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  render: () => (
    <div className="w-full max-w-sm">
      <Button className="w-full">Full-width mobile CTA</Button>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
}
