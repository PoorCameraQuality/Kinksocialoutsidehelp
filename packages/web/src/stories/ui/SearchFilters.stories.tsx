import type { Meta, StoryObj } from '@storybook/react'
import TextInput from '@/components/ui/TextInput'
import ExploreHubHeader from '@/components/explore/ExploreHubHeader'
import GroupsFiltersPanel from '@/components/groups/GroupsFiltersPanel'
import { EMPTY_EXPLORE_FILTERS } from '@/lib/explore-hub'
import { GROUP_PURPOSE_FILTERS } from '@/lib/groups-page-utils'
import { useState } from 'react'

const meta = {
  title: 'UI/Search & Filters',
  parameters: { providers: { maxWidth: '720px' } },
} satisfies Meta

export default meta
type Story = StoryObj

export const ExploreSearchDefault: Story = {
  render: function Render() {
    const [q, setQ] = useState('')
    const [filters] = useState(EMPTY_EXPLORE_FILTERS)
    return (
      <ExploreHubHeader
        searchQuery={q}
        onSearchChange={setQ}
        filters={filters}
        onDiscoveryChipToggle={() => {}}
        onRemoveFilterPill={() => {}}
        onOpenFilters={() => {}}
      />
    )
  },
}

export const ExploreSearchActive: Story = {
  render: function Render() {
    const [q, setQ] = useState('rope education')
    const [filters] = useState({ ...EMPTY_EXPLORE_FILTERS, topics: ['rope'] })
    return (
      <ExploreHubHeader
        searchQuery={q}
        onSearchChange={setQ}
        filters={filters}
        onDiscoveryChipToggle={() => {}}
        onRemoveFilterPill={() => {}}
        onOpenFilters={() => {}}
        activeFilterCount={1}
      />
    )
  },
}

export const GroupsFilterPanel: Story = {
  render: function Render() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPurposes, setSelectedPurposes] = useState<string[]>(['Rope'])
    const [distance, setDistance] = useState(50)
    const [country, setCountry] = useState('US')
    const [city, setCity] = useState('Philadelphia')
    const purposeCounts = new Map(GROUP_PURPOSE_FILTERS.map((p) => [p, 12]))
    return (
      <GroupsFiltersPanel
        idPrefix="story"
        searchId="story-groups-search"
        f={{
          searchQuery,
          setSearchQuery,
          selectedPurposes: selectedPurposes as never[],
          togglePurpose: (label) =>
            setSelectedPurposes((prev) => (prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label])),
          distance,
          setDistance,
          country,
          setCountry,
          city,
          setCity,
          hasActiveFilters: true,
          clearFilters: () => {
            setSearchQuery('')
            setSelectedPurposes([])
          },
        }}
        purposeCounts={purposeCounts}
      />
    )
  },
}

export const SimpleSearchInput: Story = {
  render: () => (
    <div className="relative max-w-md">
      <label htmlFor="story-search" className="sr-only">
        Search
      </label>
      <TextInput id="story-search" type="search" placeholder="Search people…" className="w-full" />
    </div>
  ),
}

export const MobileFilterTrigger: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  render: function Render() {
    const [q, setQ] = useState('')
    const [filters] = useState(EMPTY_EXPLORE_FILTERS)
    return (
      <ExploreHubHeader
        searchQuery={q}
        onSearchChange={setQ}
        filters={filters}
        onDiscoveryChipToggle={() => {}}
        onRemoveFilterPill={() => {}}
        onOpenFilters={() => {}}
      />
    )
  },
}
