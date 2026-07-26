import { S3Client } from '@aws-sdk/client-s3'
import { putObject } from '../../lib/s3-upload.js'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import { parseIcsBusyBlocks } from '../../lib/convention-organizer/icalBusyPreview.js'
import { mapDbLocationToDto } from '../../lib/convention-organizer/organizerLocationDto.js'
import {
  conventionSettings,
  iso,
  loadLocations,
  loadPersonIdsForConvention,
  loadSlotOr404,
  mapPersonRow,
  mapRegistrant,
  requireDb,
  requireOrganizer,
  requireUser,
  slotPersonIds,
  UUID_RE,
  type RouteRegistrar,
} from './shared.js'
import {
  alphaUploadDisabledResponse,
  isAlphaUploadDisabled,
} from '../../lib/alpha-upload-policy.js'

function s3(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) return null
  return new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

function publicUrlForPath(path: string): string | null {
  const bucket = process.env.S3_BUCKET ?? 'c2k-uploads'
  const publicBase = process.env.S3_PUBLIC_BASE_URL ?? `${process.env.S3_ENDPOINT}/${bucket}`
  if (!publicBase) return null
  return `${publicBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function loadProgramSlotsForConvention(conventionId: string) {
  const rows = await db
    .select()
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conventionId))
    .orderBy(asc(schema.scheduleSlots.startsAt))
  const trackIds = [...new Set(rows.map((r) => r.trackId).filter(Boolean))] as string[]
  const locationIds = [...new Set(rows.map((r) => r.locationId).filter(Boolean))] as string[]
  const tracks =
    trackIds.length > 0
      ? await db.select().from(schema.conventionTracks).where(eq(schema.conventionTracks.conventionId, conventionId))
      : []
  const locations =
    locationIds.length > 0
      ? await db.select().from(schema.conventionLocations).where(eq(schema.conventionLocations.conventionId, conventionId))
      : []
  const trackById = new Map(tracks.map((t) => [t.id, t]))
  const locById = new Map(locations.map((l) => [l.id, l]))
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    locationId: r.locationId,
    locationName: r.locationId ? locById.get(r.locationId)?.name : r.roomLabel ?? r.location,
    trackName: r.trackId ? trackById.get(r.trackId)?.name : r.trackLabel,
    isPublished: r.isPublished,
  }))
}

export function registerProgramExtRoutes(reg: RouteRegistrar) {
  const bulkHandler: Parameters<RouteRegistrar>[2] = async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const raw = (req.body ?? {}) as Record<string, unknown>
    const normalized = {
      action: (raw.action ?? raw.op) as string | undefined,
      slotIds: (Array.isArray(raw.slotIds) ? raw.slotIds : raw.ids) as string[] | undefined,
    }
    const parsed = z
      .object({
        action: z.enum(['publish', 'unpublish', 'delete', 'duplicate']),
        slotIds: z.array(z.string().uuid()).min(1),
      })
      .safeParse(normalized)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const ids = parsed.data.slotIds
    if (parsed.data.action === 'delete') {
      for (const id of ids) {
        await db
          .delete(schema.scheduleSlots)
          .where(and(eq(schema.scheduleSlots.conventionId, ctx.conv.id), eq(schema.scheduleSlots.id, id)))
      }
      return reply.send({ ok: true, affected: ids.length })
    }
    const patch =
      parsed.data.action === 'publish'
        ? { isPublished: true, updatedAt: new Date() }
        : parsed.data.action === 'unpublish'
          ? { isPublished: false, updatedAt: new Date() }
          : null
    if (patch) {
      for (const id of ids) {
        await db
          .update(schema.scheduleSlots)
          .set(patch)
          .where(and(eq(schema.scheduleSlots.conventionId, ctx.conv.id), eq(schema.scheduleSlots.id, id)))
      }
      return reply.send({ ok: true, affected: ids.length })
    }
    if (parsed.data.action === 'duplicate') {
      const rows = await db
        .select()
        .from(schema.scheduleSlots)
        .where(
          and(eq(schema.scheduleSlots.conventionId, ctx.conv.id), inArray(schema.scheduleSlots.id, ids)),
        )
      let created = 0
      for (const r of rows) {
        const copyTitle = r.title.endsWith(' (copy)') ? r.title : `${r.title} (copy)`
        await db.insert(schema.scheduleSlots).values({
          conventionId: ctx.conv.id,
          title: copyTitle,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
          description: r.description,
          location: r.location,
          linkUrl: r.linkUrl,
          imageGallery: r.imageGallery,
          blockId: r.blockId,
          sortOrder: r.sortOrder,
          trackLabel: r.trackLabel,
          roomLabel: r.roomLabel,
          locationId: r.locationId,
          trackId: r.trackId,
          isPublished: false,
          visibility: r.visibility,
          isFrozen: r.isFrozen,
          organizerNotes: r.organizerNotes,
          isUnscheduled: r.isUnscheduled,
          presenterOfferingId: r.presenterOfferingId,
        })
        created++
      }
      return reply.send({ ok: true, affected: created })
    }
    return reply.send({ ok: true, affected: 0 })
  }

  reg('POST', '/api/v1/conventions/:key/program-slots/bulk', bulkHandler)
  reg('PATCH', '/api/v1/conventions/:key/program-slots/bulk', bulkHandler)

  reg('GET', '/api/v1/conventions/:key/program-slots/:slotId/people', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const slot = await loadSlotOr404(ctx.conv.id, slotId)
    if (!slot) return reply.status(404).send({ error: 'Not found' })
    const links = await slotPersonIds(slotId)
    const people = links.length
      ? await loadPersonIdsForConvention(
          ctx.conv.id,
          links.map((l) => l.personId),
        )
      : []
    const peopleById = new Map(people.map((p) => [p.id, p]))
    return reply.send({
      assignments: links.map((l) => {
        const person = peopleById.get(l.personId)
        return {
          id: `${l.personId}:${l.roleLabel}`,
          personId: l.personId,
          sceneName: person?.displayName ?? '',
          role: l.roleLabel,
          sortOrder: l.sortOrder,
          isPublicOnSchedule: true,
        }
      }),
    })
  })

  reg('PUT', '/api/v1/conventions/:key/program-slots/:slotId/people', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const raw = (req.body ?? {}) as Record<string, unknown>
    const rows = Array.isArray(raw.people)
      ? raw.people
      : Array.isArray(raw.assignments)
        ? raw.assignments
        : null
    const parsed = z
      .array(
        z.object({
          personId: z.string().uuid(),
          roleLabel: z.string().max(128).optional(),
          role: z.string().max(128).optional(),
          sortOrder: z.number().int().optional(),
          isPublicOnSchedule: z.boolean().optional(),
        }),
      )
      .safeParse(rows)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const slot = await loadSlotOr404(ctx.conv.id, slotId)
    if (!slot) return reply.status(404).send({ error: 'Not found' })
    await db.delete(schema.scheduleSlotPersons).where(eq(schema.scheduleSlotPersons.slotId, slotId))
    if (parsed.data.length) {
      await db.insert(schema.scheduleSlotPersons).values(
        parsed.data.map((p, i) => ({
          slotId,
          personId: p.personId,
          roleLabel: p.roleLabel ?? p.role ?? 'presenter',
          sortOrder: p.sortOrder ?? i,
        })),
      )
    }
    return reply.send({ ok: true })
  })

  reg('GET', '/api/v1/conventions/:key/program-slots/:slotId/change-log', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.scheduleSlotAudit)
      .where(and(eq(schema.scheduleSlotAudit.conventionId, ctx.conv.id), eq(schema.scheduleSlotAudit.slotId, slotId)))
      .orderBy(desc(schema.scheduleSlotAudit.createdAt))
      .limit(50)
    return reply.send({
      entries: rows.map((r) => ({
        id: r.id,
        createdAt: iso(r.createdAt),
        summary: r.action,
        status: 'audit',
      })),
    })
  })

  reg('GET', '/api/v1/conventions/:key/program-slots/:slotId/audit', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.scheduleSlotAudit)
      .where(and(eq(schema.scheduleSlotAudit.conventionId, ctx.conv.id), eq(schema.scheduleSlotAudit.slotId, slotId)))
      .orderBy(desc(schema.scheduleSlotAudit.createdAt))
      .limit(50)
    return reply.send({
      entries: rows.map((r) => ({
        id: r.id,
        action: r.action,
        createdAt: iso(r.createdAt),
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/ical-busy-preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z.object({ icsText: z.string().min(10) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const blocks = parseIcsBusyBlocks(parsed.data.icsText)
    return reply.send({ blocks, count: blocks.length })
  })

  reg('GET', '/api/v1/conventions/:key/badges/print-data', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const statusFilter = (req.query as { status?: string }).status
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const rows = await db
      .select({
        reg: schema.conventionRegistrants,
        categoryName: schema.conventionRegistrationCategories.name,
        profileDisplayName: schema.profiles.displayName,
      })
      .from(schema.conventionRegistrants)
      .leftJoin(
        schema.conventionRegistrationCategories,
        eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
      )
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(eq(schema.conventionRegistrants.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionRegistrants.displayName))
    let filtered = rows
    if (statusFilter === 'checked_in') {
      filtered = rows.filter((r) => r.reg.checkedInAt != null)
    } else if (statusFilter === 'confirmed') {
      filtered = rows.filter((r) => r.reg.checkedInAt == null)
    } else if (statusFilter === 'ready') {
      filtered = rows.filter((r) => r.reg.registrationStatus === 'confirmed' || r.reg.checkedInAt != null)
    }
    const es = conventionSettings(ctx.conv).eventSystems ?? {}
    const badgeLogoUrl = es.badgeLogoUrl ?? es.logoUrl ?? null
    const categoryCounts = new Map<string, { id: string; name: string; count: number }>()
    for (const r of filtered) {
      const id = r.reg.categoryId ?? '__none__'
      const name = r.categoryName ?? 'Uncategorized'
      const existing = categoryCounts.get(id)
      if (existing) existing.count += 1
      else categoryCounts.set(id, { id, name, count: 1 })
    }
    return reply.send({
      eventTitle: es.eventTitle ?? ctx.conv.name,
      logoUrl: badgeLogoUrl,
      hasBadgeLogo: Boolean(es.badgeLogoUrl),
      badgeLayoutJson: es.badgeLayoutJson ?? {},
      categories: Array.from(categoryCounts.values()).sort((a, b) => a.name.localeCompare(b.name)),
      registrants: filtered.map((r, i) => {
        const m = mapRegistrant(r.reg, r.categoryName, r.profileDisplayName)
        return {
          id: m.id,
          registrationNumber: String(i + 1).padStart(4, '0'),
          sceneDisplayName: m.sceneDisplayName,
          categoryId: r.reg.categoryId ?? null,
          categoryName: m.categoryName,
          packageName: m.categoryName,
          pronouns: m.pronouns,
          badgeName: r.reg.badgeName,
          badgeTagline: null,
          shifts: [],
        }
      }),
    })
  })

  reg('POST', '/api/v1/conventions/:key/badges/logo/upload', async (req, reply) => {
    if (!requireDb(reply)) return
    if (isAlphaUploadDisabled('convention_badges_logo')) {
      return alphaUploadDisabledResponse(reply, 'convention_badges_logo')
    }
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const client = s3()
    if (!client) return reply.status(503).send({ error: 'S3 not configured' })
    const buf = await data.toBuffer()
    const ext = (data.filename?.split('.').pop() ?? 'png').toLowerCase()
    // Cache-bust by including a timestamp so organizers see the new logo immediately.
    const objectKey = `conventions/${ctx.conv.id}/badges/logo-${Date.now()}.${ext}`
    try {
      await putObject(client, {
        Bucket: process.env.S3_BUCKET ?? 'c2k-uploads',
        Key: objectKey,
        Body: buf,
        ContentType: data.mimetype,
      })
    } catch (e) {
      const err = e as { name?: string; message?: string }
      req.log?.error({ err }, 'badges/logo/upload PutObject failed')
      return reply.status(502).send({
        error: `Upload storage error (${err.name ?? 'Unknown'}): ${err.message ?? 'failed to write file'}`,
      })
    }
    const url = publicUrlForPath(objectKey)
    if (!url) return reply.status(502).send({ error: 'Upload succeeded but no public URL is configured' })
    const settings = conventionSettings(ctx.conv)
    const nextSettings = {
      ...settings,
      eventSystems: {
        ...(settings.eventSystems ?? {}),
        badgeLogoUrl: url,
      },
    }
    await db
      .update(schema.conventions)
      .set({ settings: nextSettings })
      .where(eq(schema.conventions.id, ctx.conv.id))
    return reply.send({ badgeLogoUrl: url, hasBadgeLogo: true })
  })

  reg('POST', '/api/v1/conventions/:key/hero/upload', async (req, reply) => {
    if (!requireDb(reply)) return
    if (isAlphaUploadDisabled('convention_hero')) {
      return alphaUploadDisabledResponse(reply, 'convention_hero')
    }
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    if (!ctx.conv.anchorEventId) {
      return reply.status(400).send({ error: 'Link an anchor calendar event before uploading a hero photo.' })
    }
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const client = s3()
    if (!client) return reply.status(503).send({ error: 'S3 not configured' })
    const buf = await data.toBuffer()
    const ext = (data.filename?.split('.').pop() ?? 'jpg').toLowerCase()
    const objectKey = `conventions/${ctx.conv.id}/hero-${Date.now()}.${ext}`
    try {
      await putObject(client, {
        Bucket: process.env.S3_BUCKET ?? 'c2k-uploads',
        Key: objectKey,
        Body: buf,
        ContentType: data.mimetype,
      })
    } catch (e) {
      const err = e as { name?: string; message?: string }
      req.log?.error({ err }, 'hero/upload PutObject failed')
      return reply.status(502).send({
        error: `Upload storage error (${err.name ?? 'Unknown'}): ${err.message ?? 'failed to write file'}`,
      })
    }
    const url = publicUrlForPath(objectKey)
    if (!url) return reply.status(502).send({ error: 'Upload succeeded but no public URL is configured' })
    await db
      .update(schema.events)
      .set({ imageUrl: url })
      .where(eq(schema.events.id, ctx.conv.anchorEventId))
    return reply.send({ imageUrl: url, eventId: ctx.conv.anchorEventId })
  })

  reg('DELETE', '/api/v1/conventions/:key/hero', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    if (!ctx.conv.anchorEventId) {
      return reply.status(400).send({ error: 'No anchor event linked.' })
    }
    await db
      .update(schema.events)
      .set({ imageUrl: null })
      .where(eq(schema.events.id, ctx.conv.anchorEventId))
    return reply.send({ imageUrl: null, eventId: ctx.conv.anchorEventId })
  })
}

export function registerExportsExtRoutes(reg: RouteRegistrar) {
  reg('GET', '/api/v1/conventions/:key/exports/event-pack', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const slots = await loadProgramSlotsForConvention(ctx.conv.id)
    const locations = await loadLocations(ctx.conv.id)
    const payload = {
      convention: ctx.conv.slug,
      generatedAt: new Date().toISOString(),
      slots,
      locations: locations.map((l) => mapDbLocationToDto({
        id: l.id,
        name: l.name,
        short_name: l.shortName,
        capacity: l.capacity,
        notes: l.notes,
        sort_order: l.sortOrder,
        parent_id: l.parentId,
        kind: l.kind,
        accessibility_notes: l.accessibilityNotes,
        directions_public: l.directionsPublic,
        internal_notes: l.internalNotes,
      })),
    }
    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="event-pack-${ctx.conv.slug}.json"`)
      .send(JSON.stringify(payload, null, 2))
  })
}
