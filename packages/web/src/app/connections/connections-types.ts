export type ConnectionRow = {
  id: string
  requesterId: string
  recipientId: string
  status: string
  createdAt: string
  requesterUsername: string | null
  recipientUsername: string | null
  otherPartyUsername?: string | null
  otherPartyDisplayName?: string | null
  otherPartyAvatarUrl?: string | null
  isOutgoing: boolean
}

export type FollowRow = {
  id: string
  username: string
  displayName: string | null
  avatarUrl?: string | null
}

export type SuggestedPerson = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  location?: string | null
  sharedCount?: number
}
