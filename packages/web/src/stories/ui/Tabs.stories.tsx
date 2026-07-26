import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import TabShell, { TabShellButton } from '@/components/ui/TabShell'

const meta = {
  title: 'UI/Tabs',
  parameters: { providers: { maxWidth: '640px' } },
} satisfies Meta

export default meta
type Story = StoryObj

export const FeedScopeTabs: Story = {
  render: function Render() {
    const [active, setActive] = useState('following')
    const tabs = [
      { id: 'following', label: 'Following' },
      { id: 'near', label: 'Near you' },
      { id: 'trending', label: 'Trending' },
    ]
    return (
      <TabShell aria-label="Home feed scope">
        {tabs.map((tab) => (
          <TabShellButton key={tab.id} selected={active === tab.id} onClick={() => setActive(tab.id)}>
            {tab.label}
          </TabShellButton>
        ))}
      </TabShell>
    )
  },
}

export const FilterTabs: Story = {
  render: function Render() {
    const [active, setActive] = useState('all')
    return (
      <TabShell aria-label="Following feed filters">
        {['All activity', 'Posts only', 'Photos', 'Articles'].map((label) => {
          const id = label.toLowerCase().replace(/\s+/g, '-')
          return (
            <TabShellButton key={id} selected={active === id} onClick={() => setActive(id)}>
              {label}
            </TabShellButton>
          )
        })}
      </TabShell>
    )
  },
}
