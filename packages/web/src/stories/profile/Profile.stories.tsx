import type { Meta, StoryObj } from '@storybook/react'
import Button from '@/components/ui/Button'
import ProfileHero from '@/components/profile/layout/ProfileHero'
import ProfileCard from '@/components/profile/story/ProfileCard'
import ProfileAboutCard from '@/components/profile/story/ProfileAboutCard'
import SocialAvatarGrid from '@/components/profile/social/SocialAvatarGrid'
import { storyProfileHero, storyPerson } from '@/stories/mocks/directory'

const meta = {
  title: 'Profile/Surfaces',
  parameters: { providers: { maxWidth: '880px' } },
} satisfies Meta

export default meta
type Story = StoryObj

const heroActions = (
  <>
    <Button size="sm">Message</Button>
    <Button size="sm" variant="secondary">
      View connections
    </Button>
  </>
)

export const HeroWithPhoto: Story = {
  render: () => <ProfileHero {...storyProfileHero} actions={heroActions} />,
}

export const HeroWithoutPhoto: Story = {
  render: () => (
    <ProfileHero
      {...storyProfileHero}
      photoUrl={null}
      photoCount={0}
      actions={heroActions}
    />
  ),
}

export const OwnProfileActions: Story = {
  render: () => (
    <ProfileHero
      {...storyProfileHero}
      actions={
        <>
          <Button size="sm">Edit profile</Button>
          <Button size="sm" variant="secondary">
            Manage photos
          </Button>
        </>
      }
      managePhotosHref="/profile/edit/photos"
    />
  ),
}

export const PublicProfileActions: Story = {
  render: () => (
    <ProfileHero
      displayName="Alex"
      username="AlexScene"
      ageLabel="32"
      pronouns="she/they"
      location="Philadelphia, PA"
      roles={['Educator', 'Switch']}
      photoUrl={storyPerson.avatarUrl}
      actions={
        <>
          <Button size="sm" variant="secondary">
            View profile
          </Button>
          <Button size="sm" variant="ghost">
            Follow
          </Button>
        </>
      }
    />
  ),
}

export const SectionCard: Story = {
  render: () => (
    <ProfileAboutCard
      displayName="Rope Dreamer"
      bio="Community educator focused on negotiation, consent culture, and beginner-friendly rope labs."
      interests={['Rope', 'Education', 'Community organizing']}
      viewerIsOwner
    />
  ),
}

export const EmptySection: Story = {
  render: () => (
    <ProfileCard title="Organizations">
      <p className="text-sm text-dc-text-muted">No public organizations listed yet.</p>
    </ProfileCard>
  ),
}

export const GalleryStrip: Story = {
  render: () => (
    <SocialAvatarGrid
      people={[
        { username: 'AlexScene', displayName: 'Alex', avatarUrl: storyPerson.avatarUrl },
        { username: 'JordanK', displayName: 'Jordan', avatarUrl: null },
        { username: 'RileyQ', displayName: 'Riley', avatarUrl: null },
      ]}
      columns={5}
    />
  ),
}

export const MobileHero: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  render: () => <ProfileHero {...storyProfileHero} actions={heroActions} />,
}
