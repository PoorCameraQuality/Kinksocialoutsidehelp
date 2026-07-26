import { z } from 'zod'

export const EDUCATION_CATEGORIES = [
  'Beginner',
  'Advanced',
  'Safety',
  'Psychology',
  'Gear',
  'Event Etiquette',
] as const

export const educationCategorySchema = z.enum(EDUCATION_CATEGORIES)

export const educationArticleVisibilitySchema = z.enum(['PUBLIC', 'MEMBERS', 'CONNECTIONS'])

export const educationArticlePublicationStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])

export const educationArticleWriteBodySchema = z.object({
  title: z.string().min(1).max(512),
  slug: z.string().min(2).max(160).optional(),
  excerpt: z.string().max(4000).optional().nullable(),
  bodyJson: z.record(z.unknown()).optional(),
  bodyHtml: z.string().max(500_000).optional(),
  heroImageUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  categories: z.array(educationCategorySchema).max(8).optional(),
  difficulty: z.string().max(32).optional().nullable(),
  contentWarnings: z.array(z.string().min(1).max(120)).max(16).optional(),
  readingMinutes: z.number().int().min(1).max(600).optional().nullable(),
  linkedOfferingIds: z.array(z.string().uuid()).max(12).optional(),
  visibility: educationArticleVisibilitySchema.optional(),
  listInEducation: z.boolean().optional(),
  publicationStatus: educationArticlePublicationStatusSchema.optional(),
  eckePublish: z.boolean().optional(),
  organizationId: z.string().uuid().optional().nullable(),
})

export function slugifyEducationTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  return base || 'article'
}

export function validateListInEducationRequirements(input: {
  listInEducation?: boolean
  categories?: string[]
  contentWarnings?: string[]
}): string | null {
  if (!input.listInEducation) return null
  if (!input.categories?.length) return 'At least one category is required to list in the Education hub'
  if (!input.contentWarnings?.length) return 'At least one content warning is required to list in the Education hub'
  return null
}
