/** Mock/demo slug groups - full tab set including mock-only sections. */
export const MOCK_GROUP_TABS = ['Channels', 'Events', 'Members', 'Resources', 'Photos'] as const
/** API-backed UUID groups - mock Channels/Resources/Photos hidden until API exists. */
export const API_GROUP_TABS = ['Forums', 'Feedback', 'Events', 'Members'] as const
export const MOCK_ONLY_GROUP_TABS = ['Channels', 'Resources', 'Photos'] as const

export function groupCommunityTabs(apiBacked: boolean): readonly string[] {
  return apiBacked ? API_GROUP_TABS : MOCK_GROUP_TABS
}
