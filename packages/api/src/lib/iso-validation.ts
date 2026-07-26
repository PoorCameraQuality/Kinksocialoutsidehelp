import { z } from 'zod'

export const ISO_BODY_MAX = 12_000
export const ISO_IMAGES_MAX = 3

export const putMeIsoBodySchema = z
  .object({
    body: z.string().max(ISO_BODY_MAX),
    visibility: z.enum(['PUBLIC', 'MEMBERS', 'PRIVATE']),
    acceptDmsViaIso: z.boolean(),
    images: z.array(z.string().url().max(2000)).max(ISO_IMAGES_MAX),
  })
  .strict()
