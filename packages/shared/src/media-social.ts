/**
 * Media library settings schemas: kinds, albums, comment policy, source surfaces.
 * Filename is old. This is not the social graph or connections domain.
 */
import { z } from 'zod'
import { mediaVisibilitySchema, type MediaVisibility } from './media-types.js'

/** User-facing media kind layered on media_assets. */
export const MEDIA_KINDS = ['image', 'video', 'audio'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]
export const mediaKindSchema = z.enum(MEDIA_KINDS)

export const MEDIA_COMMENT_POLICIES = [
  'everyone_allowed_by_visibility',
  'connections',
  'no_one',
] as const
export type MediaCommentPolicy = (typeof MEDIA_COMMENT_POLICIES)[number]
export const mediaCommentPolicySchema = z.enum(MEDIA_COMMENT_POLICIES)

export const MEDIA_SOURCE_SURFACES = [
  'profile_media',
  'profile_photo',
  'feed_upload',
  'group_media',
  'event_media',
  'convention_media',
] as const
export type MediaSourceSurface = (typeof MEDIA_SOURCE_SURFACES)[number]

export const MEDIA_ALBUM_KINDS = [
  'default_all',
  'profile_pictures',
  'uploaded_pictures',
  'tagged_pictures',
  'custom',
] as const
export type MediaAlbumKind = (typeof MEDIA_ALBUM_KINDS)[number]

export const MEDIA_PEOPLE_TAG_STATUSES = ['pending', 'approved', 'declined', 'removed'] as const
export type MediaPeopleTagStatus = (typeof MEDIA_PEOPLE_TAG_STATUSES)[number]

export const MEDIA_REACTION_KINDS = ['love', 'respect', 'sympathize', 'helpful'] as const
export type MediaReactionKind = (typeof MEDIA_REACTION_KINDS)[number]

export const DEFAULT_POST_UPLOADS_TO_FEED_OPTIONS = ['true', 'false', 'ask'] as const
export type DefaultPostUploadsToFeed = (typeof DEFAULT_POST_UPLOADS_TO_FEED_OPTIONS)[number]

export const ALLOW_PEOPLE_TO_TAG_ME_OPTIONS = ['yes', 'approval_required', 'no'] as const
export type AllowPeopleToTagMe = (typeof ALLOW_PEOPLE_TO_TAG_ME_OPTIONS)[number]

export const SHOW_TAGGED_MEDIA_OPTIONS = ['approved_only', 'no'] as const
export type ShowTaggedMediaOnProfile = (typeof SHOW_TAGGED_MEDIA_OPTIONS)[number]

export const mediaSettingsSchema = z.object({
  defaultMediaVisibility: mediaVisibilitySchema,
  defaultMediaCommentPolicy: mediaCommentPolicySchema,
  defaultPostUploadsToFeed: z.enum(DEFAULT_POST_UPLOADS_TO_FEED_OPTIONS),
  defaultMediaAlbumVisibility: mediaVisibilitySchema,
  allowPeopleToTagMe: z.enum(ALLOW_PEOPLE_TO_TAG_ME_OPTIONS),
  showTaggedMediaOnProfile: z.enum(SHOW_TAGGED_MEDIA_OPTIONS),
  showMediaTabOnProfile: z.boolean(),
  showAlbumsOnProfile: z.boolean(),
  includeMediaUploadsInActivityFeed: z.boolean(),
  includeMediaReactionsInActivityFeed: z.enum(['true', 'connections_only', 'false']),
  includeMediaCommentsInActivityFeed: z.enum(['true', 'connections_only', 'false']),
})

export type MediaSettings = z.infer<typeof mediaSettingsSchema>

export const defaultMediaSettings: MediaSettings = {
  defaultMediaVisibility: 'LOGGED_IN',
  defaultMediaCommentPolicy: 'connections',
  defaultPostUploadsToFeed: 'ask',
  defaultMediaAlbumVisibility: 'LOGGED_IN',
  allowPeopleToTagMe: 'approval_required',
  showTaggedMediaOnProfile: 'approved_only',
  showMediaTabOnProfile: true,
  showAlbumsOnProfile: true,
  includeMediaUploadsInActivityFeed: true,
  includeMediaReactionsInActivityFeed: 'connections_only',
  includeMediaCommentsInActivityFeed: 'connections_only',
}

export const MAX_MEDIA_ITEM_TAGS = 5
export const MAX_MEDIA_PEOPLE_TAGS = 8

/** Attestation payload for media upload composer. */
export const mediaUploadAttestationSchema = z.object({
  contentRating: z.string(),
  depictedPeople: z.string(),
  visibility: mediaVisibilitySchema,
  uploaderConfirmed18: z.literal(true),
  uploaderConfirmedDepictedAdults18: z.literal(true),
  uploaderConfirmedConsent: z.literal(true),
  uploaderConfirmedRightToUpload: z.literal(true),
  uploaderConfirmedNoNcii: z.literal(true),
  uploaderConfirmedNoMinors: z.literal(true),
  uploaderConfirmedNoHiddenCamera: z.literal(true),
  uploaderConfirmedNoAiDeepfakeWithoutConsent: z.literal(true),
})

export type MediaUploadAttestation = z.infer<typeof mediaUploadAttestationSchema>

export type MediaItemSummary = {
  id: string
  mediaKind: MediaKind
  caption: string | null
  visibility: MediaVisibility
  commentPolicy: MediaCommentPolicy
  pinnedToProfile: boolean
  previewUrl: string | null
  blurredPreviewUrl: string | null
  isBlurredByDefault: boolean
  contentRating: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  createdAt: string
  tags: string[]
}

export type MediaAlbumSummary = {
  id: string
  title: string
  slug: string
  description: string | null
  visibility: MediaVisibility
  albumKind: MediaAlbumKind
  coverPreviewUrl: string | null
  itemCount: number
  sortOrder: number
}
