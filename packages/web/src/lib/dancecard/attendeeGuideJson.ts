import { z } from 'zod'

const sectionSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  markdown: z.string().max(50000).optional().default(''),
  enabled: z.boolean().optional().default(true),
})

const conductCheckpointSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  body: z.string().max(10000).optional().default(''),
  requiredAck: z.boolean().optional().default(true),
})

export const attendeeGuideJsonSchema = z.object({
  ticketingUrl: z.string().url().max(2000).optional().or(z.literal('')),
  rabbitsignUrl: z.string().url().max(2000).optional().or(z.literal('')),
  checkInMarkdown: z.string().max(20000).optional().default(''),
  sections: z.array(sectionSchema).max(24).optional().default([]),
  conductCheckpoints: z.array(conductCheckpointSchema).max(12).optional().default([]),
})

export type AttendeeGuideJson = z.infer<typeof attendeeGuideJsonSchema>
export type AttendeeGuideSection = z.infer<typeof sectionSchema>

export function parseAttendeeGuideJson(raw: unknown): AttendeeGuideJson {
  const parsed = attendeeGuideJsonSchema.safeParse(raw ?? {})
  if (parsed.success) {
    const v = parsed.data
    return {
      ...v,
      ticketingUrl: v.ticketingUrl === '' ? undefined : v.ticketingUrl,
      rabbitsignUrl: v.rabbitsignUrl === '' ? undefined : v.rabbitsignUrl,
    }
  }
  return { sections: [], checkInMarkdown: '', conductCheckpoints: [] }
}

/** Safe subset for public dancecard APIs. */
export function publicAttendeeGuideJson(guide: AttendeeGuideJson) {
  return {
    ticketingUrl: guide.ticketingUrl ?? null,
    rabbitsignUrl: guide.rabbitsignUrl ?? null,
    checkInMarkdown: guide.checkInMarkdown ?? '',
    sections: (guide.sections ?? []).filter((s) => s.enabled !== false),
    conductCheckpoints: guide.conductCheckpoints ?? [],
  }
}

export type PublicAttendeeGuide = ReturnType<typeof publicAttendeeGuideJson>

/** True when weekend guide UI should be shown (accordion, landing blocks, etc.). */
export function publicAttendeeGuideHasContent(g: PublicAttendeeGuide): boolean {
  if (g.ticketingUrl) return true
  if (g.rabbitsignUrl) return true
  if (g.checkInMarkdown.trim().length > 0) return true
  return (g.sections ?? []).some((s) => (s.markdown ?? '').trim().length > 0 || (s.title ?? '').trim().length > 0)
}
