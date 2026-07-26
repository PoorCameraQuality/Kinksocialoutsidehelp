import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'
import FeedReactionPicker from '@/components/feed/FeedReactionPicker'

const meta = {
  title: 'UI/Dialogs & Menus',
  parameters: { providers: { maxWidth: '720px' } },
} satisfies Meta

export default meta
type Story = StoryObj

export const DialogCentered: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Confirm action"
          description="Dialogs use elevated surfaces above page content."
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          }
        >
          <p className="text-sm text-dc-text-muted">Body content stays readable on the dark shell.</p>
        </Dialog>
      </>
    )
  },
}

export const DialogSheetMobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open sheet</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Mobile sheet" variant="sheet">
          <p className="text-sm text-dc-text-muted">Bottom sheet variant for phone layouts.</p>
        </Dialog>
      </>
    )
  },
}

export const PostOverflowMenu: Story = {
  render: () => (
    <div className="relative rounded-2xl border border-dc-border bg-dc-elevated-solid p-4">
      <div className="flex justify-end">
        <CopyLinkOverflowMenu
          path="/share/post/story-post-1"
          bookmark={{ saved: false, onToggle: () => {} }}
          report={{ targetType: 'feed_post', targetId: 'story-post-1', targetLabel: 'Post' }}
        />
      </div>
      <p className="text-sm text-dc-text-muted">Overflow menu opens above card clipping boundaries.</p>
    </div>
  ),
}

export const CreateMenuStyle: Story = {
  render: () => (
    <div className="relative inline-block">
      <Button variant="secondary">Create</Button>
      <div className="z-dc-dropdown absolute left-0 top-full mt-2 w-56 rounded-xl border border-dc-border bg-dc-elevated-solid py-2 shadow-[var(--dc-shadow-panel)]">
        {['Post', 'Event', 'Group'].map((label) => (
          <button
            key={label}
            type="button"
            className="block w-full px-4 py-2 text-left text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  ),
}

export const AccountMenuStyle: Story = {
  render: () => (
    <div className="relative ml-auto w-72 rounded-xl border border-dc-border bg-dc-elevated-solid py-2 shadow-[var(--dc-shadow-panel)]">
      <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-dc-muted">Account</p>
      {['Profile', 'Settings', 'Sign out'].map((label) => (
        <button
          key={label}
          type="button"
          className="block w-full px-4 py-2 text-left text-sm text-dc-text hover:bg-dc-elevated-muted"
        >
          {label}
        </button>
      ))}
    </div>
  ),
}

export const ReactionPickerDesktop: Story = {
  render: function Render() {
    const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
    const [open, setOpen] = useState(true)
    return (
      <div className="relative rounded-2xl border border-dc-border bg-dc-elevated-solid p-6">
        <button
          ref={setAnchor}
          type="button"
          className="rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text"
          onClick={() => setOpen((v) => !v)}
        >
          React
        </button>
        <FeedReactionPicker
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={anchor}
          viewerReaction={null}
          onSelect={() => setOpen(false)}
        />
      </div>
    )
  },
}

export const ReactionPickerMobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open reaction sheet</Button>
        <FeedReactionPicker
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={null}
          viewerReaction="respect"
          onSelect={() => setOpen(false)}
        />
      </>
    )
  },
}
