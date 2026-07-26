import { z } from 'zod'

export const mediaFormatSchema = z.enum(['podcast', 'video', 'hybrid'])

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), { message: 'URL must use HTTPS' })

const optionalHttpsUrl = z.union([z.literal(''), z.null()]).optional().transform((v) => {
  if (v === '' || v === null || v === undefined) return null
  return v
})

export const mediaShowWriteBodySchema = z.object({
  title: z.string().min(1).max(512),
  slug: z.string().max(160).optional(),
  description: z.string().max(16000).optional().nullable(),
  coverImageUrl: optionalHttpsUrl,
  mediaFormat: mediaFormatSchema.optional(),
  rssFeedUrl: optionalHttpsUrl,
  youtubeChannelUrl: optionalHttpsUrl,
  youtubePlaylistUrl: optionalHttpsUrl,
  spotifyShowUrl: optionalHttpsUrl,
  applePodcastsUrl: optionalHttpsUrl,
  websiteUrl: optionalHttpsUrl,
  twitchUrl: optionalHttpsUrl,
  rumbleUrl: optionalHttpsUrl,
  tags: z.array(z.string().max(64)).max(30).optional(),
  contentWarnings: z.array(z.string().max(128)).max(20).optional(),
  organizationId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
})

export function slugifyMediaTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
}

export function validateListInMediaRequirements(contentWarnings: string[]): string | null {
  if (!contentWarnings.length) {
    return 'At least one content warning is required for directory listing.'
  }
  return null
}

export function parseOptionalHttpsUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const parsed = httpsUrl.safeParse(raw)
  return parsed.success ? parsed.data : null
}
