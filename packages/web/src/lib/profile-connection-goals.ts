/** Connection goals (formerly "Looking for") - grouped for edit UI. */

export type ConnectionGoalGroup = {
  id: string
  title: string
  options: readonly string[]
}

export const CONNECTION_GOAL_GROUPS: readonly ConnectionGoalGroup[] = [
  {
    id: 'community',
    title: 'Community',
    options: [
      'Friends',
      'Event companions',
      'Mentorship',
      'Education / classes',
      'Collaborators',
      'Chat / pen pals',
    ],
  },
  {
    id: 'relationship',
    title: 'Relationship / personal',
    options: [
      'Relationship',
      'Long-term relationship',
      'Poly / ENM connections',
      'Casual dating',
    ],
  },
  {
    id: 'play',
    title: 'Play',
    options: ['Play partners', 'Scene buddies', 'Rope partners'],
  },
] as const

export const ALL_CONNECTION_GOAL_OPTIONS = CONNECTION_GOAL_GROUPS.flatMap((g) => g.options)
