import type { ReactNode } from 'react'
import EmptyState, { type EmptyStateAction, type EmptyStateProps } from '@/components/ui/EmptyState'
import {
  AlertEmptyIcon,
  BookmarkEmptyIcon,
  CalendarEmptyIcon,
  EducationEmptyIcon,
  FeedEmptyIcon,
  GroupEmptyIcon,
  MediaEmptyIcon,
  MessageEmptyIcon,
  NotificationEmptyIcon,
  ProfileEmptyIcon,
  SearchEmptyIcon,
  VendorEmptyIcon,
} from '@/components/ui/empty-state-icons'

export type EmptyPreset = {
  title: string
  message: string
  icon?: ReactNode
  ctaLabel?: string
  ctaHref?: string
  secondaryCtaLabel?: string
  secondaryCtaHref?: string
  actionLabel?: string
  actions?: EmptyStateAction[]
}

/** Canonical empty-state copy for Tier A and directory surfaces (Desktop UI Sprint 1, CP5). */
export const EMPTY_STATE_PRESETS = {
  noResults: {
    title: 'No results',
    message: 'Try different keywords or fewer filters.',
    actionLabel: 'Clear search',
    icon: <SearchEmptyIcon />,
  },
  noMessages: {
    title: 'No messages yet',
    message: 'Messages from people you connect with will appear here.',
    ctaLabel: 'Message settings',
    ctaHref: '/settings/privacy',
    secondaryCtaLabel: 'Find people',
    secondaryCtaHref: '/discovery',
    icon: <MessageEmptyIcon />,
  },
  noNotifications: {
    title: 'No notifications yet.',
    message:
      'When someone messages you, accepts a connection, replies, reacts, or sends something that needs your attention, it will appear here.',
    icon: <NotificationEmptyIcon />,
    actions: [
      { label: 'Find people', href: '/people', primary: true },
      { label: 'View connections', href: '/connections' },
      { label: 'Open messages', href: '/messaging' },
      { label: 'Explore groups', href: '/groups' },
    ],
  },
  noSavedItems: {
    title: 'Nothing saved yet',
    message: 'Save events, articles, media, vendors, and posts so you can come back to them later.',
    icon: <BookmarkEmptyIcon />,
    actions: [
      { label: 'Browse events', href: '/events', primary: true },
      { label: 'Explore education', href: '/education' },
    ],
  },
  noMedia: {
    title: 'No media yet',
    message: 'Photos and channels you follow will appear here.',
    ctaLabel: 'Browse media',
    ctaHref: '/media',
    icon: <MediaEmptyIcon />,
  },
  noEvents: {
    title: 'No upcoming events',
    message: 'Browse the calendar or widen your search to find gatherings near you.',
    ctaLabel: 'Browse events',
    ctaHref: '/events',
    icon: <CalendarEmptyIcon />,
  },
  noGroups: {
    title: 'No groups yet',
    message: 'Find communities that match your interests.',
    ctaLabel: 'Explore groups',
    ctaHref: '/groups',
    icon: <GroupEmptyIcon />,
  },
  noVendors: {
    title: 'No vendors found',
    message: 'Try a different search or browse the vendor directory.',
    ctaLabel: 'Browse vendors',
    ctaHref: '/vendors',
    icon: <VendorEmptyIcon />,
  },
  noEducationItems: {
    title: 'No education items yet',
    message: 'Articles and series from the community will appear here.',
    ctaLabel: 'Explore education',
    ctaHref: '/education',
    icon: <EducationEmptyIcon />,
  },
  incompleteProfile: {
    title: 'Complete your profile',
    message: 'Add a few details so people can find you and trust who they are connecting with.',
    ctaLabel: 'Edit profile',
    ctaHref: '/profile/edit',
    icon: <ProfileEmptyIcon />,
  },
  loadingFailed: {
    title: 'Could not load',
    message: 'Check your connection and try again.',
    actionLabel: 'Retry',
    icon: <AlertEmptyIcon />,
  },
  noActivity: {
    title: 'No activity yet.',
    message:
      'Follow members, join groups, RSVP to events, and post updates to start building a real activity stream.',
    actions: [
      { label: 'Find people', href: '/people', primary: true },
      { label: 'Explore groups', href: '/groups' },
      { label: 'Browse events', href: '/events' },
      { label: 'Write a post', href: '/home?mode=discover&tab=Local#home-feed-composer' },
    ],
  },
  noMyPosts: {
    title: 'You have not posted yet',
    message: 'Share an update, write an article, or create an event to start contributing to the community.',
    actions: [
      { label: 'Create post', href: '/home?mode=discover&tab=Local#home-feed-composer', primary: true },
      { label: 'Write article', href: '/education/write' },
    ],
  },
  noFeedPosts: {
    title: 'No posts yet',
    message: 'Posts from people and groups you follow will show up here.',
    ctaLabel: 'Explore groups',
    ctaHref: '/groups',
    icon: <FeedEmptyIcon />,
  },
  noGroupsJoined: {
    title: 'No groups yet',
    message: 'Find communities that match your interests.',
    ctaLabel: 'Explore groups',
    ctaHref: '/groups',
    icon: <GroupEmptyIcon />,
  },
  noGroupsFound: {
    title: 'No groups found',
    message: 'Try a different search or browse all groups.',
    ctaLabel: 'Browse groups',
    ctaHref: '/groups',
    icon: <GroupEmptyIcon />,
  },
  noOrgsFollowed: {
    title: 'No organizations followed',
    message: 'Follow organizers to see their events and updates.',
    ctaLabel: 'Browse organizations',
    ctaHref: '/orgs',
  },
  noEventsNearby: {
    title: 'No upcoming events nearby',
    message: 'There is nothing coming up nearby yet. Browse the calendar or widen your search.',
    ctaLabel: 'Browse events',
    ctaHref: '/events',
    icon: <CalendarEmptyIcon />,
  },
  noUploadedMedia: {
    title: 'No media yet',
    message: 'Photos you upload will appear here after review.',
    ctaLabel: 'Edit profile',
    ctaHref: '/profile/edit',
    icon: <MediaEmptyIcon />,
  },
  alphaUploadDisabled: {
    title: 'Upload disabled during beta',
    message:
      'This upload type is disabled during beta while we test safety and moderation. Profile photos are currently supported.',
    ctaLabel: 'Back to profile',
    ctaHref: '/profile/edit',
  },
  noSearchResults: {
    title: 'No results',
    message: 'Try different keywords or fewer filters.',
    actionLabel: 'Clear search',
    icon: <SearchEmptyIcon />,
  },
  noModerationReports: {
    title: 'Queue is clear',
    message: 'No open reports need review right now.',
    ctaLabel: 'Moderation home',
    ctaHref: '/moderation',
  },
} satisfies Record<string, EmptyPreset>

export type EmptyStatePresetKey = keyof typeof EMPTY_STATE_PRESETS

type PresetEmptyStateProps = {
  preset: EmptyStatePresetKey
  onAction?: () => void
  footer?: ReactNode
} & Pick<EmptyStateProps, 'inline' | 'variant' | 'compact' | 'className' | 'align' | 'titleAs'>

export function PresetEmptyState({
  preset,
  inline,
  variant,
  compact,
  className,
  align,
  titleAs,
  onAction,
  footer,
}: PresetEmptyStateProps) {
  const p = EMPTY_STATE_PRESETS[preset]
  return (
    <EmptyState
      inline={inline}
      variant={variant}
      compact={compact}
      className={className}
      align={align}
      titleAs={titleAs}
      title={p.title}
      message={p.message}
      icon={'icon' in p ? p.icon : undefined}
      ctaLabel={'ctaLabel' in p ? p.ctaLabel : undefined}
      ctaHref={'ctaHref' in p ? p.ctaHref : undefined}
      secondaryCtaLabel={'secondaryCtaLabel' in p ? p.secondaryCtaLabel : undefined}
      secondaryCtaHref={'secondaryCtaHref' in p ? p.secondaryCtaHref : undefined}
      actionLabel={'actionLabel' in p ? p.actionLabel : undefined}
      actions={'actions' in p ? p.actions : undefined}
      onAction={onAction}
      footer={footer}
    />
  )
}
