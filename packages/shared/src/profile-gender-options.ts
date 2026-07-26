export const PROFILE_GENDER_MAX = 3 as const

export const PROFILE_GENDER_OTHER = 'Other (describe below)' as const

export const PROFILE_GENDER_OPTIONS: ReadonlyArray<{
  label: string
  options: readonly string[]
}> = [
  {
    label: 'Common',
    options: [
      'Man',
      'Woman',
      'Non-binary',
      'Genderqueer',
      'Genderfluid',
      'Agender',
      'Two-Spirit',
      'Bigender',
      'Demigirl',
      'Demiboy',
      'Androgyne',
      'Neutrois',
    ],
  },
  {
    label: 'Trans & modality',
    options: [
      'Trans man',
      'Trans woman',
      'Trans non-binary',
      'Transfeminine',
      'Transmasculine',
      'Transgender',
      'Cis man',
      'Cis woman',
      'AMAB',
      'AFAB',
      'Intersex',
    ],
  },
  {
    label: 'Non-binary spectrum',
    options: [
      'Gender non-conforming',
      'Pangender',
      'Polygender',
      'Maverique',
      'Xenogender',
      'Third gender',
      'Multigender',
      'Genderflux',
      'Demigender',
    ],
  },
  {
    label: 'Expression',
    options: ['Butch', 'Femme', 'Masc', 'Fem', 'Androgynous', 'Soft masc', 'Soft femme'],
  },
  {
    label: 'Cultural & traditional',
    options: ['Hijra', "Fa'afafine", 'Mahu', 'Winkte', 'Bakla', 'Kathoey'],
  },
  {
    label: 'General',
    options: ['Queer', 'Questioning / exploring', 'Prefer not to say'],
  },
  {
    label: 'Custom',
    options: [PROFILE_GENDER_OTHER],
  },
] as const

export const PROFILE_GENDER_VALUES: readonly string[] = PROFILE_GENDER_OPTIONS.flatMap((g) => g.options)
