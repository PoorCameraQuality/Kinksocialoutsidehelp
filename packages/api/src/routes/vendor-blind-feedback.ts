import { and, desc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { db, schema } from '../db/index.js'
import { recalculateVendorBlindRating } from '../lib/vendor-blind-rollup.js'
import { isVendorShopManager } from '../lib/vendor-shop-people.js'
import { defaultBucket, getObjectBuffer, getS3Client } from '../lib/s3-upload.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Set USE_DATABASE=true' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  return requireAuthenticatedDbUser(req, reply)
}

async function resolveVendorProfileId(vendorKey: string): Promise<string | null> {
  if (UUID_RE.test(vendorKey)) {
    const [v] = await db.select({ id: schema.vendorProfiles.id }).from(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendorKey)).limit(1)
    return v?.id ?? null
  }
  const [v] = await db
    .select({ id: schema.vendorProfiles.id })
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.slug, vendorKey))
    .limit(1)
  return v?.id ?? null
}

async function isVendorOwner(vendorProfileId: string, userId: string): Promise<boolean> {
  return isVendorShopManager(vendorProfileId, userId)
}

function isValidPurchaseProofKey(key: string, userId: string): boolean {
  const prefix = `uploads/${userId}/`
  if (!key.startsWith(prefix)) return false
  if (key.includes('..')) return false
  return key.length > prefix.length
}

const postBody = z.object({
  rating: z.number().int().min(1).max(10),
  body: z.string().max(4000).optional(),
  purchaseProofKey: z.string().min(1).max(512),
})

async function loadFeedbackForVendor(vendorProfileId: string, feedbackId: string) {
  const [row] = await db
    .select()
    .from(schema.vendorBlindFeedback)
    .where(
      and(
        eq(schema.vendorBlindFeedback.id, feedbackId),
        eq(schema.vendorBlindFeedback.vendorProfileId, vendorProfileId)
      )
    )
    .limit(1)
  return row ?? null
}

export async function registerVendorBlindFeedbackRoutes(app: FastifyInstance) {
  app.post('/api/v1/vendors/:vendorId/blind-feedback', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { vendorId } = req.params as { vendorId: string }
    const vid = await resolveVendorProfileId(vendorId)
    if (!vid) return reply.status(404).send({ error: 'Vendor not found' })
    const parsed = postBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    if (!isValidPurchaseProofKey(parsed.data.purchaseProofKey, user.userId)) {
      return reply.status(400).send({ error: 'Invalid purchase proof upload' })
    }
    try {
      const [row] = await db
        .insert(schema.vendorBlindFeedback)
        .values({
          vendorProfileId: vid,
          authorUserId: user.userId,
          rating: parsed.data.rating,
          body: parsed.data.body,
          purchaseProofKey: parsed.data.purchaseProofKey,
          status: 'PENDING',
        })
        .returning()
      return reply.send({ feedback: { id: row.id, status: row.status } })
    } catch {
      return reply.status(409).send({ error: 'You already submitted feedback for this vendor' })
    }
  })

  /** Owner-only: pending rows without rating/body; includes purchase proof for verification. */
  app.get('/api/v1/vendors/:vendorId/blind-feedback/pending', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { vendorId } = req.params as { vendorId: string }
    const vid = await resolveVendorProfileId(vendorId)
    if (!vid) return reply.status(404).send({ error: 'Vendor not found' })
    if (!(await isVendorOwner(vid, user.userId))) return reply.status(403).send({ error: 'Forbidden' })
    const rows = await db
      .select({
        id: schema.vendorBlindFeedback.id,
        status: schema.vendorBlindFeedback.status,
        createdAt: schema.vendorBlindFeedback.createdAt,
        hasPurchaseProof: schema.vendorBlindFeedback.purchaseProofKey,
      })
      .from(schema.vendorBlindFeedback)
      .where(and(eq(schema.vendorBlindFeedback.vendorProfileId, vid), eq(schema.vendorBlindFeedback.status, 'PENDING')))
      .orderBy(desc(schema.vendorBlindFeedback.createdAt))
    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        hasPurchaseProof: Boolean(r.hasPurchaseProof),
      })),
    })
  })

  /** Owner or author - streams purchase proof image without exposing rating/body. */
  app.get('/api/v1/vendors/:vendorId/blind-feedback/:feedbackId/proof', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { vendorId, feedbackId } = req.params as { vendorId: string; feedbackId: string }
    if (!UUID_RE.test(feedbackId)) return reply.status(400).send({ error: 'Invalid feedback id' })
    const vid = await resolveVendorProfileId(vendorId)
    if (!vid) return reply.status(404).send({ error: 'Vendor not found' })
    const row = await loadFeedbackForVendor(vid, feedbackId)
    if (!row?.purchaseProofKey) return reply.status(404).send({ error: 'Not found' })
    const owner = await isVendorOwner(vid, user.userId)
    if (!owner && row.authorUserId !== user.userId) return reply.status(403).send({ error: 'Forbidden' })

    const client = getS3Client()
    if (!client) return reply.status(503).send({ error: 'Storage not configured' })
    const obj = await getObjectBuffer(client, row.purchaseProofKey, defaultBucket())
    if (!obj) return reply.status(404).send({ error: 'Proof file not found' })
    return reply
      .header('Content-Type', obj.contentType ?? 'application/octet-stream')
      .header('Cache-Control', 'private, no-store')
      .send(obj.body)
  })

  app.post('/api/v1/vendors/:vendorId/blind-feedback/:feedbackId/verify', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { vendorId, feedbackId } = req.params as { vendorId: string; feedbackId: string }
    if (!UUID_RE.test(feedbackId)) return reply.status(400).send({ error: 'Invalid feedback id' })
    const vid = await resolveVendorProfileId(vendorId)
    if (!vid) return reply.status(404).send({ error: 'Vendor not found' })
    if (!(await isVendorOwner(vid, user.userId))) return reply.status(403).send({ error: 'Forbidden' })
    const row = await loadFeedbackForVendor(vid, feedbackId)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    if (row.status !== 'PENDING') return reply.status(400).send({ error: 'Already processed' })
    if (!row.purchaseProofKey) {
      return reply.status(400).send({ error: 'Purchase proof required before verification' })
    }
    await db
      .update(schema.vendorBlindFeedback)
      .set({ status: 'VERIFIED', verifiedAt: new Date() })
      .where(eq(schema.vendorBlindFeedback.id, feedbackId))
    await recalculateVendorBlindRating(vid)
    return reply.send({ ok: true })
  })

  app.post('/api/v1/vendors/:vendorId/blind-feedback/:feedbackId/dismiss', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { vendorId, feedbackId } = req.params as { vendorId: string; feedbackId: string }
    if (!UUID_RE.test(feedbackId)) return reply.status(400).send({ error: 'Invalid feedback id' })
    const vid = await resolveVendorProfileId(vendorId)
    if (!vid) return reply.status(404).send({ error: 'Vendor not found' })
    if (!(await isVendorOwner(vid, user.userId))) return reply.status(403).send({ error: 'Forbidden' })
    const row = await loadFeedbackForVendor(vid, feedbackId)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    if (row.status !== 'PENDING') return reply.status(400).send({ error: 'Already processed' })
    await db.delete(schema.vendorBlindFeedback).where(eq(schema.vendorBlindFeedback.id, feedbackId))
    return reply.send({ ok: true })
  })
}
