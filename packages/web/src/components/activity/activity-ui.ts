export type ActivityTab = 'all' | 'messages' | 'notifications' | 'requests'

export const ACTIVITY_TABS: { id: ActivityTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'requests', label: 'Requests' },
]
