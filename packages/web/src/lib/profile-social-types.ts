export type SocialPersonPreview = {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export type ProfileConnectionsSummary = {
  totalCount: number
  mutualCount: number | null
  listVisible: boolean
  preview?: SocialPersonPreview[]
}

export type ProfileFollowsSummary = {
  followerCount: number
  followingCount: number
  listsVisible: boolean
  followersPreview?: SocialPersonPreview[]
  followingPreview?: SocialPersonPreview[]
}

export type ProfileMutualConnections = {
  count: number | null
  preview?: SocialPersonPreview[]
}
