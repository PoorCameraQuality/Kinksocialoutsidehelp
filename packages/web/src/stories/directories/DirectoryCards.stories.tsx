import type { Meta, StoryObj } from '@storybook/react'
import PersonCard from '@/components/cards/PersonCard'
import FindPeopleProfileCard from '@/components/find-people/FindPeopleProfileCard'
import GroupCard from '@/components/cards/GroupCard'
import EventCard from '@/components/cards/EventCard'
import VendorCard from '@/components/cards/VendorCard'
import OrgDirectoryCard from '@/components/orgs/OrgDirectoryCard'
import EducationArticleCard from '@/components/education/EducationArticleCard'
import {
  storyArticle,
  storyEvent,
  storyEventNoImage,
  storyGroupApproval,
  storyGroupPublic,
  storyOrg,
  storyPerson,
  storyPersonNoImage,
  storyFindPeoplePerson,
  storyFindPeoplePersonNoImage,
  storyVendor,
} from '@/stories/mocks/directory'
import { toOrgDirectoryModel } from '@/lib/org-directory-utils'

const meta = {
  title: 'Directories/Cards',
  parameters: { providers: { maxWidth: '960px' } },
} satisfies Meta

export default meta
type Story = StoryObj

export const PeopleCard: Story = {
  render: () => (
    <div className="max-w-sm">
      <PersonCard person={storyPerson} />
    </div>
  ),
}

export const PeopleNoImage: Story = {
  render: () => (
    <div className="max-w-sm">
      <PersonCard person={storyPersonNoImage} />
    </div>
  ),
}

export const PeopleDirectoryCard: Story = {
  render: () => (
    <div className="max-w-md">
      <FindPeopleProfileCard person={storyFindPeoplePerson} recommended />
    </div>
  ),
}

export const PeopleDirectoryNoImage: Story = {
  render: () => (
    <div className="max-w-md">
      <FindPeopleProfileCard person={storyFindPeoplePersonNoImage} />
    </div>
  ),
}

export const GroupPublic: Story = {
  render: () => (
    <div className="max-w-sm">
      <GroupCard group={storyGroupPublic} />
    </div>
  ),
}

export const GroupApprovalRequired: Story = {
  render: () => (
    <div className="max-w-sm">
      <GroupCard group={storyGroupApproval} />
    </div>
  ),
}

export const EventWithImage: Story = {
  render: () => (
    <div className="max-w-sm">
      <EventCard event={storyEvent} />
    </div>
  ),
}

export const EventNoImage: Story = {
  render: () => (
    <div className="max-w-sm">
      <EventCard event={storyEventNoImage} />
    </div>
  ),
}

export const VendorDiscovery: Story = {
  render: () => (
    <div className="max-w-sm">
      <VendorCard vendor={storyVendor} />
    </div>
  ),
}

export const VendorCompact: Story = {
  render: () => (
    <div className="max-w-sm">
      <VendorCard vendor={storyVendor} compact />
    </div>
  ),
}

export const OrganizationCard: Story = {
  render: () => (
    <div className="max-w-md">
      <OrgDirectoryCard org={toOrgDirectoryModel(storyOrg)} canManage={false} />
    </div>
  ),
}

export const OrganizationOwner: Story = {
  render: () => (
    <div className="max-w-md">
      <OrgDirectoryCard org={toOrgDirectoryModel(storyOrg)} canManage />
    </div>
  ),
}

export const EducationArticle: Story = {
  render: () => (
    <div className="max-w-md">
      <EducationArticleCard article={storyArticle} />
    </div>
  ),
}

export const MobileGrid: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  render: () => (
    <div className="space-y-4">
      <PersonCard person={storyPerson} />
      <EventCard event={storyEventNoImage} />
      <VendorCard vendor={storyVendor} compact />
    </div>
  ),
}
