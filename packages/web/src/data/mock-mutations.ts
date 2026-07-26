/**
 * Mock mutation functions.
 * Mutate in-memory data from mock-seeds.
 */

import {
  mockGroupPhotos,
  mockGroupPosts,
  mockLocalPosts,
  mockResources,
  mockGroups,
  mockEvents,
  mockPeople,
  mockArticles,
  mockEndorsements,
  mockGroupMembers,
} from './mock-seeds'
import type {
  MockGroupPhoto,
  MockResource,
  MockEvent,
  MockGroup,
  MockArticle,
  MockGroupPost,
  MockLocalPost,
  MockEndorsement,
  MockGroupMember,
  GroupRole,
} from './types'
import type { MockContentByTag } from './types'

/**
 * Module-level sets for mock soft-delete.
 * IDs are not removed from arrays; getters filter them out.
 */
const _deletedLocalPostIds = new Set<string>()
const _deletedGroupPostIds = new Set<string>()

/** Approves a pending group photo. Returns false if not found or not pending. */
export function approveMockGroupPhoto(photoId: string): boolean {
  const photo = mockGroupPhotos.find((photoItem) => photoItem.id === photoId)
  if (!photo || photo.status !== 'pending') return false
  photo.status = 'approved'
  photo.approvedAt = new Date().toISOString()
  photo.deniedReason = undefined
  return true
}

/** Denies a group photo (optionally with reason). Returns false if not found. */
export function denyMockGroupPhoto(photoId: string, reason?: string): boolean {
  const photo = mockGroupPhotos.find((photoItem) => photoItem.id === photoId)
  if (!photo) return false
  photo.status = 'denied'
  photo.deniedReason = reason
  photo.approvedAt = undefined
  return true
}

/** Removes a group photo (denies with moderator reason). */
export function removeMockGroupPhoto(photoId: string): boolean {
  return denyMockGroupPhoto(photoId, 'Removed by moderator')
}

/** Adds a new group photo (status: pending). Returns the created photo. */
export function addMockGroupPhoto(photo: {
  groupId: string
  url?: string
  caption?: string
  authorUsername: string
  tags?: string[]
}): MockGroupPhoto {
  const newPhoto: MockGroupPhoto = {
    ...photo,
    id: `gph-${photo.groupId}-${Date.now()}`,
    status: 'pending',
    submittedAt: 'Just now',
  }
  mockGroupPhotos.push(newPhoto)
  return newPhoto
}

/** Withdraws a pending photo if the caller is the author. */
export function withdrawMockGroupPhoto(photoId: string, authorUsername: string): boolean {
  const photo = mockGroupPhotos.find((photoItem) => photoItem.id === photoId)
  if (!photo || photo.status !== 'pending' || photo.authorUsername !== authorUsername) return false
  return denyMockGroupPhoto(photoId, 'Withdrawn by author')
}

/** Updates a group post's title and/or content. Returns false if not found. */
export function editMockGroupPost(postId: string, updates: { title?: string; content?: string }): boolean {
  const post = mockGroupPosts.find((postItem) => postItem.id === postId)
  if (!post) return false
  if (updates.title != null) post.title = updates.title
  if (updates.content != null) post.content = updates.content
  return true
}

/** Soft-deletes a group post (adds to _deletedGroupPostIds). Returns false if not found. */
export function deleteMockGroupPost(postId: string): boolean {
  if (!mockGroupPosts.some((postItem) => postItem.id === postId)) return false
  _deletedGroupPostIds.add(postId)
  return true
}

/** Toggles pinned state of a group post. */
export function togglePinMockGroupPost(postId: string): boolean {
  const post = mockGroupPosts.find((postItem) => postItem.id === postId)
  if (!post) return false
  post.isPinned = !post.isPinned
  return true
}

/** Updates a local post's text. Returns false if not found. */
export function editMockLocalPost(postId: string, text: string): boolean {
  const post = mockLocalPosts.find((postItem) => postItem.id === postId)
  if (!post) return false
  post.text = text
  return true
}

/** Soft-deletes a local post (adds to _deletedLocalPostIds). Returns false if not found. */
export function deleteMockLocalPost(postId: string): boolean {
  if (!mockLocalPosts.some((postItem) => postItem.id === postId)) return false
  _deletedLocalPostIds.add(postId)
  return true
}

/** Prepends a new local feed post (in-memory mock). */
export function addMockLocalPost(input: {
  authorUsername: string
  authorTrustScore: number
  text: string
  kind?: 'status' | 'article'
  title?: string | null
  imageUrls?: string[]
  audioUrls?: string[]
}): MockLocalPost {
  const newPost: MockLocalPost = {
    id: `lp-${Date.now()}`,
    authorUsername: input.authorUsername,
    authorTrustScore: input.authorTrustScore,
    text: input.text,
    timeAgo: 'Just now',
    likes: 0,
    comments: 0,
    kind: input.kind ?? 'status',
    title: input.title ?? null,
    imageUrls: input.imageUrls?.length ? [...input.imageUrls] : undefined,
    audioUrls: input.audioUrls?.length ? [...input.audioUrls] : undefined,
  }
  mockLocalPosts.unshift(newPost)
  return newPost
}

/** Adds a public endorsement (in-memory). Returns null if invalid or duplicate. */
export function addMockEndorsement(input: {
  endorsedUsername: string
  endorserUsername: string
  note?: string
}): MockEndorsement | null {
  if (input.endorsedUsername === input.endorserUsername) return null
  const duplicate = mockEndorsements.some(
    (e) => e.endorsedUsername === input.endorsedUsername && e.endorserUsername === input.endorserUsername
  )
  if (duplicate) return null
  const person = mockPeople.find((p) => p.username === input.endorserUsername)
  if (!person) return null
  const row: MockEndorsement = {
    id: `end-${Date.now()}`,
    endorsedUsername: input.endorsedUsername,
    endorserUsername: input.endorserUsername,
    endorserTrustScore: person.trustScore,
    endorserBadges: person.badges,
    note: input.note,
    createdAt: 'Just now',
  }
  mockEndorsements.unshift(row)
  return row
}

/** Joins a group as a member (mock). Returns false if already a member. */
export function addMockGroupMember(input: { groupId: string; username: string; role?: GroupRole }): boolean {
  if (mockGroupMembers.some((m) => m.groupId === input.groupId && m.username === input.username)) {
    return false
  }
  const row: MockGroupMember = {
    groupId: input.groupId,
    userId: input.username,
    username: input.username,
    role: input.role ?? 'member',
    joinedAt: 'Just now',
  }
  mockGroupMembers.push(row)
  const g = mockGroups.find((x) => x.id === input.groupId)
  if (g) g.members = (g.members ?? 0) + 1
  return true
}

/** Removes a member from a group (mock). Owners cannot leave via this helper. */
export function removeMockGroupMember(groupId: string, username: string): boolean {
  const idx = mockGroupMembers.findIndex((m) => m.groupId === groupId && m.username === username)
  if (idx < 0) return false
  if (mockGroupMembers[idx].role === 'owner') return false
  mockGroupMembers.splice(idx, 1)
  const g = mockGroups.find((x) => x.id === groupId)
  if (g && g.members > 0) g.members -= 1
  return true
}

/** Adds a new resource to a group. Returns the created resource. */
export function addMockResource(resource: { groupId: string; name: string; link: string; type: string }): MockResource {
  const newRes: MockResource = {
    id: `res-${resource.groupId}-${Date.now()}`,
    ...resource,
  }
  mockResources.push(newRes)
  return newRes
}

/** Removes a resource by ID. Returns false if not found. */
export function removeMockResource(resourceId: string): boolean {
  const idx = mockResources.findIndex((resource) => resource.id === resourceId)
  if (idx < 0) return false
  mockResources.splice(idx, 1)
  return true
}

/** Sets a group's tags (normalized to lowercase, trimmed). Returns false if group not found. */
export function setMockGroupTags(groupId: string, tags: string[]): boolean {
  const group = mockGroups.find((groupItem) => groupItem.id === groupId)
  if (!group) return false
  group.tags = tags.map((tagItem) => tagItem.trim().toLowerCase()).filter(Boolean)
  return true
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

function hasTag(item: { tags?: string[] }, tag: string): boolean {
  const norm = normalizeTag(tag)
  return item.tags?.some((tagItem) => normalizeTag(tagItem) === norm) ?? false
}

/** Returns posts for a channel, excluding soft-deleted, pinned first. */
export function getMockPostsForChannel(channelId: string): MockGroupPost[] {
  return mockGroupPosts
    .filter((post) => post.channelId === channelId && !_deletedGroupPostIds.has(post.id))
    .sort((postA, postB) => (postA.isPinned === postB.isPinned ? 0 : postA.isPinned ? -1 : 1))
}

/** Returns local posts excluding soft-deleted. */
export function getMockLocalPostsVisible(): MockLocalPost[] {
  return mockLocalPosts.filter((post) => !_deletedLocalPostIds.has(post.id))
}

function getPhotosByTag(norm: string): MockContentByTag['photos'] {
  const groupPhotos = mockGroupPhotos.filter((photo) => photo.status === 'approved' && hasTag(photo, norm)).slice(0, 50)
  const profilePhotos = mockPeople
    .flatMap((person) =>
      (person.profilePhotos ?? [])
        .filter((profilePhoto) => hasTag(profilePhoto, norm))
        .map((profilePhoto) => ({ ...profilePhoto, authorUsername: person.username, groupId: undefined as string | undefined }))
    )
    .slice(0, 50 - groupPhotos.length)
  return [...groupPhotos, ...profilePhotos].slice(0, 50)
}

function getEventsByTag(norm: string): MockEvent[] {
  return mockEvents.filter((event) => hasTag(event, norm)).slice(0, 20)
}

function getGroupsByTag(norm: string): MockGroup[] {
  return mockGroups.filter((group) => hasTag(group, norm)).slice(0, 20)
}

function getArticlesByTag(norm: string): MockArticle[] {
  return mockArticles.filter((article) => hasTag(article, norm)).slice(0, 20)
}

function getDiscussionsByTag(norm: string): MockGroupPost[] {
  const visible = mockGroupPosts.filter((post) => !_deletedGroupPostIds.has(post.id))
  return visible.filter((post) => hasTag(post, norm)).slice(0, 20)
}

function getWritingsByTag(norm: string): MockLocalPost[] {
  const visible = mockLocalPosts.filter((post) => !_deletedLocalPostIds.has(post.id))
  return visible.filter((post) => hasTag(post, norm)).slice(0, 20)
}

/** Returns all mock content (photos, events, groups, etc.) matching the given tag. */
export function getMockContentByTag(tag: string): MockContentByTag {
  const norm = normalizeTag(tag)
  return {
    photos: getPhotosByTag(norm),
    events: getEventsByTag(norm),
    groups: getGroupsByTag(norm),
    articles: getArticlesByTag(norm),
    discussions: getDiscussionsByTag(norm),
    writings: getWritingsByTag(norm),
  }
}
