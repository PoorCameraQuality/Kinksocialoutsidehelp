import type { UserEcosystemPayload } from '@/lib/user-ecosystem'

export type ProfileStoryKink = {
  kinkTagId: string
  displayName: string
  interestStatus: string
  note: string | null
}

export type ProfileStoryHighlight = {
  id: string
  label: string
  icon: 'calendar' | 'users' | 'shield' | 'map' | 'heart' | 'star' | 'building'
}

export type ProfileStoryActivityItem = {
  id: string
  title: string
  subtitle?: string
  when?: string
  href?: string
  icon: 'calendar' | 'users' | 'building' | 'edit' | 'star' | 'book'
}

export type ProfileStoryInput = {
  displayName: string
  username: string
  bio: string | null
  location: string | null
  roles: string[]
  lookingFor: string[]
  kinks: ProfileStoryKink[]
  lifestyleActivity?: string | null
  memberSince?: string | null
  photoUrl?: string | null
  referencesCount: number
  ecosystem: UserEcosystemPayload | null
  viewerIsOwner: boolean
}
