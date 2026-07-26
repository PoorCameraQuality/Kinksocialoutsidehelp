/** Public beta activation checklist items for new Home users. */

export type HomeActivationItem = {
  id: string
  label: string
  href: string
  done?: boolean
}

export function buildHomeActivationItems(input: {
  profileBasicsDone: boolean
  joinedGroup: boolean
  hasEventRsvp: boolean
  privacyConfigured: boolean
}): HomeActivationItem[] {
  return [
    {
      id: 'profile',
      label: 'Complete your profile',
      href: '/profile/edit?redirect=%2Fhome',
      done: input.profileBasicsDone,
    },
    {
      id: 'people',
      label: 'Find people to follow',
      href: '/people',
    },
    {
      id: 'groups',
      label: 'Join a group',
      href: '/groups',
      done: input.joinedGroup,
    },
    {
      id: 'events',
      label: 'Browse upcoming events',
      href: '/events',
      done: input.hasEventRsvp,
    },
    {
      id: 'intro',
      label: 'Post a short intro',
      href: '/home?mode=discover',
    },
    {
      id: 'privacy',
      label: 'Review privacy settings',
      href: '/settings/privacy',
      done: input.privacyConfigured,
    },
  ]
}
