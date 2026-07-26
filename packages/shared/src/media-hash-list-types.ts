import { z } from 'zod'

/** Internal deny/review registry - not a CSAM hash database. */
export const MEDIA_HASH_LIST_SOURCES = {
  internal: 'INTERNAL',
  moderatorReport: 'MODERATOR_REPORT',
  legalHold: 'LEGAL_HOLD',
  partnerFeed: 'PARTNER_FEED',
} as const

export type MediaHashListSource =
  (typeof MEDIA_HASH_LIST_SOURCES)[keyof typeof MEDIA_HASH_LIST_SOURCES]

export const mediaHashListSourceSchema = z.enum([
  MEDIA_HASH_LIST_SOURCES.internal,
  MEDIA_HASH_LIST_SOURCES.moderatorReport,
  MEDIA_HASH_LIST_SOURCES.legalHold,
  MEDIA_HASH_LIST_SOURCES.partnerFeed,
])
