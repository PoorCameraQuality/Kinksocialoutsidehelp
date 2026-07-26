export const PROFILE_ROLE_MAX = 10 as const

export const PROFILE_ROLE_OTHER = 'Other (describe below)' as const

export const PROFILE_ROLE_OPTIONS: ReadonlyArray<{
  label: string
  options: readonly string[]
}> = [
  {
    label: 'Power exchange',
    options: [
      'Dominant',
      'Submissive',
      'Switch',
      'Top',
      'Bottom',
      'Master',
      'Mistress',
      'Slave',
      'Owner',
      'Pet',
      'Handler',
      'Service top',
      'Service bottom',
      'Power switch',
      'D-type',
      's-type',
    ],
  },
  {
    label: 'Rope & bondage',
    options: [
      'Rigger',
      'Rope bunny',
      'Rope switch',
      'Bondage top',
      'Bondage bottom',
      'Suspension top',
      'Suspension bottom',
      'Shibari artist',
      'Floor work bottom',
    ],
  },
  {
    label: 'Impact & sensation',
    options: [
      'Sadist',
      'Masochist',
      'Impact top',
      'Impact bottom',
      'Sensualist',
      'Primal predator',
      'Primal prey',
      'Primal switch',
      'Wax top',
      'Wax bottom',
    ],
  },
  {
    label: 'Care & dynamics',
    options: [
      'Caregiver',
      'Little',
      'Middle',
      'Daddy',
      'Mommy',
      'Brat',
      'Brat tamer',
      'Degrader',
      'Degradee',
      'Disciplinarian',
    ],
  },
  {
    label: 'Community',
    options: [
      'Educator',
      'Mentor',
      'Organizer',
      'Facilitator',
      'Host',
      'Presenter',
      'Demo top',
      'Demo bottom',
      'Volunteer',
      'Moderator',
    ],
  },
  {
    label: 'Play styles',
    options: [
      'Primal',
      'Exhibitionist',
      'Voyeur',
      'Kinkster',
      'Fetishist',
      'Vanilla-curious',
      'Experimentalist',
      'Scene partner',
      'Play partner',
    ],
  },
  {
    label: 'Custom',
    options: [PROFILE_ROLE_OTHER],
  },
] as const

export const PROFILE_ROLE_VALUES: readonly string[] = PROFILE_ROLE_OPTIONS.flatMap((g) => g.options)
