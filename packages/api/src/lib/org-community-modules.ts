import { z } from 'zod'
import { sanitizeFeedHtml } from './sanitize-feed-body.js'
import { zLooseHttpUrl, zLooseHttpUrlNullable } from './loose-http-url.js'

const moduleIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/)

export const communityPageModuleSchema = z.discriminatedUnion('type', [
  z.object({
    id: moduleIdSchema,
    type: z.literal('richtext'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    html: z.string().max(50_000),
    variant: z.enum(['default', 'callout', 'muted']).optional(),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('checklist'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    items: z
      .array(
        z.object({
          label: z.string().max(400),
          href: zLooseHttpUrlNullable,
          note: z.string().max(500).nullable().optional(),
        })
      )
      .max(30),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('contacts'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    rows: z
      .array(
        z.object({
          role: z.string().max(120),
          detail: z.string().max(800),
          href: zLooseHttpUrlNullable,
        })
      )
      .max(20),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('announcements'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    items: z
      .array(
        z.object({
          title: z.string().max(200),
          body: z.string().max(4000),
          dateLabel: z.string().max(80).nullable().optional(),
          link: zLooseHttpUrlNullable,
        })
      )
      .max(15),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('documents'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    items: z
      .array(
        z.object({
          label: z.string().max(200),
          url: zLooseHttpUrl,
          kind: z.enum(['pdf', 'doc', 'sheet', 'link', 'other']).optional(),
        })
      )
      .max(30),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('volunteer'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    bodyHtml: z.string().max(20_000).nullable().optional(),
    signupUrl: zLooseHttpUrlNullable,
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('featured_vendors'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    maxItems: z.number().int().min(1).max(24).optional(),
    emptyMessage: z.string().max(200).optional(),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('featured_articles'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    maxItems: z.number().int().min(1).max(24).optional(),
    emptyMessage: z.string().max(200).optional(),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('event_picks'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    maxItems: z.number().int().min(1).max(12).optional(),
    filter: z.enum(['upcoming', 'beginner_friendly']).optional(),
    noteHtml: z.string().max(10_000).nullable().optional(),
  }),
  z.object({
    id: moduleIdSchema,
    type: z.literal('reporting'),
    enabled: z.boolean().optional(),
    title: z.string().max(120).nullable().optional(),
    introHtml: z.string().max(20_000),
    reportUrl: zLooseHttpUrlNullable,
    policyHtml: z.string().max(20_000).nullable().optional(),
  }),
])

export type CommunityPageModule = z.infer<typeof communityPageModuleSchema>

export const communityModulesArraySchema = z.array(communityPageModuleSchema).max(40)

export function sanitizeCommunityModule(m: CommunityPageModule): CommunityPageModule {
  switch (m.type) {
    case 'richtext':
      return { ...m, html: sanitizeFeedHtml(m.html).slice(0, 50_000) }
    case 'volunteer':
      return {
        ...m,
        bodyHtml:
          m.bodyHtml === null || m.bodyHtml === undefined ? m.bodyHtml : sanitizeFeedHtml(m.bodyHtml).slice(0, 20_000),
      }
    case 'reporting':
      return {
        ...m,
        introHtml: sanitizeFeedHtml(m.introHtml).slice(0, 20_000),
        policyHtml:
          m.policyHtml === null || m.policyHtml === undefined
            ? m.policyHtml
            : sanitizeFeedHtml(m.policyHtml).slice(0, 20_000),
      }
    case 'event_picks':
      return {
        ...m,
        noteHtml:
          m.noteHtml === null || m.noteHtml === undefined ? m.noteHtml : sanitizeFeedHtml(m.noteHtml).slice(0, 10_000),
      }
    default:
      return m
  }
}

export function sanitizeCommunityModulesList(mods: CommunityPageModule[]): CommunityPageModule[] {
  return mods.map(sanitizeCommunityModule)
}
