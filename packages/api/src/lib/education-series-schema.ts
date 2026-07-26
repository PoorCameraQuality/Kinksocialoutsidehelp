import { z } from 'zod'

import { slugifyEducationTitle } from './education-article-schema.js'

export const educationSeriesWriteBodySchema = z.object({
  title: z.string().min(1).max(512),
  slug: z.string().min(2).max(160).optional(),
  description: z.string().max(8000).optional().nullable(),
})

export const educationSeriesItemsBodySchema = z.object({
  articleIds: z.array(z.string().uuid()).max(48),
})

export { slugifyEducationTitle }

export type EducationSeriesContext = {
  seriesSlug: string
  seriesTitle: string
  partNumber: number
  totalParts: number
  prevSlug: string | null
  nextSlug: string | null
}
