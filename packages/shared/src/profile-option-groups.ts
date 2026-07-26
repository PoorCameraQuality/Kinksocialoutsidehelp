const TAG_OTHER = 'Other (describe below)'

/** Strip legacy "Other" rows before showing grouped tag pickers in the UI. */
export function profileOptionGroupsForTags(
  groups: ReadonlyArray<{ label: string; options: readonly string[] }>,
): ReadonlyArray<{ label: string; options: readonly string[] }> {
  return groups
    .filter((g) => g.label !== 'Custom')
    .map((g) => ({
      label: g.label,
      options: g.options.filter((o) => o !== TAG_OTHER),
    }))
    .filter((g) => g.options.length > 0)
}
