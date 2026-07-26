import { z } from 'zod'
import { mediaKindSchema } from './media-social.js'
import { mediaVisibilitySchema } from './media-types.js'

export const imageFeedAttachmentSchema = z.object({
  type: z.literal('image'),
  url: z.string().url(),
})

export const audioFeedAttachmentSchema = z.object({
  type: z.literal('audio'),
  url: z.string().url(),
})

/** First-class media reference for feed cards. */
export const mediaFeedAttachmentSchema = z.object({
  type: z.literal('media'),
  mediaKind: mediaKindSchema,
  mediaItemId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
  previewUrl: z.string().nullable().optional(),
  blurredPreviewUrl: z.string().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  durationSeconds: z.number().int().nullable().optional(),
  isBlurredByDefault: z.boolean().optional(),
  contentRating: z.string().nullable().optional(),
  visibility: mediaVisibilitySchema.optional(),
})

export const videoFeedAttachmentSchema = z.object({
  type: z.literal('video'),
  url: z.string(),
  posterUrl: z.string().nullable().optional(),
  durationSeconds: z.number().int().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
})

export const feedAttachmentSchema = z.union([
  imageFeedAttachmentSchema,
  audioFeedAttachmentSchema,
  mediaFeedAttachmentSchema,
  videoFeedAttachmentSchema,
])

export type FeedAttachment = z.infer<typeof feedAttachmentSchema>
export type MediaFeedAttachment = z.infer<typeof mediaFeedAttachmentSchema>
