import { z } from 'zod'
import { ISO_BODY_MAX, ISO_FIELD_MAX, ISO_PITCH_MAX, ISO_TAG_MAX } from '@c2k/shared'

export const ISO_IMAGES_MAX = 3
export { ISO_BODY_MAX }

const stringArr = (max = ISO_TAG_MAX) => z.array(z.string().max(80)).max(max)

const isoPitchSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  description: z.string().max(ISO_FIELD_MAX),
  intensity: z.enum(['quick', 'planned', 'elaborate', 'oddball']),
  myRole: z.enum(['top', 'bottom', 'third', 'service', 'either']),
  sex: z.enum(['none', 'optional', 'yes']),
  tags: stringArr(12),
})

export const isoStructuredSchema = z.object({
  version: z.literal('iso_v2').optional(),
  roles: stringArr(16),
  playIntent: z.enum(['platonic', 'open', 'sexual']),
  seekingWho: stringArr(16),
  approach: z.enum(['dms_open', 'ask_first', 'in_person', 'visual_signal']),
  visualSignal: z.string().max(120),
  capacity: z.enum(['high', 'selective', 'social_first', 'no_prebook']),
  into: stringArr(),
  curious: stringArr(),
  hardNos: stringArr(),
  pitches: z.array(isoPitchSchema).max(ISO_PITCH_MAX),
  riskNotes: z.string().max(ISO_FIELD_MAX),
  gearBringing: z.string().max(ISO_FIELD_MAX),
  venues: stringArr(8),
  socialOffers: stringArr(12),
})

export const putMeIsoBodySchema = z
  .object({
    body: z.string().max(ISO_BODY_MAX),
    visibility: z.enum(['PUBLIC', 'MEMBERS', 'PRIVATE']),
    acceptDmsViaIso: z.boolean(),
    images: z.array(z.string().url().max(2000)).max(ISO_IMAGES_MAX),
    structured: isoStructuredSchema.optional(),
  })
  .strict()
