import { and, desc, eq } from 'drizzle-orm'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { z } from 'zod'

import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'

import { getViewerUserId } from '../auth/viewer-user-id.js'

import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'

import { db, schema } from '../db/index.js'

import { touchGroupActivity } from '../lib/group-activity.js'

import { summarizeGroupReviewDimensions } from '../lib/group-review-dimensions.js'



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



async function requireGroupMember(groupId: string, userId: string): Promise<boolean> {

  const [m] = await db

    .select()

    .from(schema.groupMembers)

    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))

    .limit(1)

  return Boolean(m)

}



const dimensionRating = z.number().int().min(1).max(5).optional()



const reviewBody = z.object({

  sentiment: z.enum(['POSITIVE', 'NEGATIVE']),

  body: z.string().max(4000).optional(),

  cultureRating: dimensionRating,

  newMemberFriendlinessRating: dimensionRating,

  moderationQualityRating: dimensionRating,

  safetyResponsivenessRating: dimensionRating,

  eventUsefulnessRating: dimensionRating,

  communicationClarityRating: dimensionRating,

})



export async function registerGroupReputationRoutes(app: FastifyInstance) {

  app.get('/api/v1/groups/:groupId/reviews', async (req, reply) => {

    if (!requireDb(reply)) return

    const { groupId } = req.params as { groupId: string }

    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)

    if (!g) return reply.status(404).send({ error: 'Not found' })



    const viewer = resolveViewerFromRequest(req)

    const viewerId = getViewerUserId(viewer.payload)

    if (!viewerId || !(await requireGroupMember(groupId, viewerId))) {

      return reply.status(403).send({ error: 'Members only' })

    }



    const rows = await db

      .select({

        id: schema.groupReviews.id,

        sentiment: schema.groupReviews.sentiment,

        body: schema.groupReviews.body,

        cultureRating: schema.groupReviews.cultureRating,

        newMemberFriendlinessRating: schema.groupReviews.newMemberFriendlinessRating,

        moderationQualityRating: schema.groupReviews.moderationQualityRating,

        safetyResponsivenessRating: schema.groupReviews.safetyResponsivenessRating,

        eventUsefulnessRating: schema.groupReviews.eventUsefulnessRating,

        communicationClarityRating: schema.groupReviews.communicationClarityRating,

        createdAt: schema.groupReviews.createdAt,

        authorId: schema.groupReviews.authorId,

        username: schema.users.username,

      })

      .from(schema.groupReviews)

      .innerJoin(schema.users, eq(schema.groupReviews.authorId, schema.users.id))

      .where(eq(schema.groupReviews.groupId, groupId))

      .orderBy(desc(schema.groupReviews.createdAt))

      .limit(50)



    const summary = summarizeGroupReviewDimensions(rows)



    return reply.send({

      items: rows.map((r) => ({

        id: r.id,

        sentiment: r.sentiment,

        body: r.body,

        cultureRating: r.cultureRating,

        newMemberFriendlinessRating: r.newMemberFriendlinessRating,

        moderationQualityRating: r.moderationQualityRating,

        safetyResponsivenessRating: r.safetyResponsivenessRating,

        eventUsefulnessRating: r.eventUsefulnessRating,

        communicationClarityRating: r.communicationClarityRating,

        createdAt: r.createdAt.toISOString(),

        authorId: r.authorId,

        username: r.username,

      })),

      summary,

    })

  })



  app.post('/api/v1/groups/:groupId/reviews', async (req, reply) => {

    if (!requireDb(reply)) return

    const user = requireUser(req, reply)

    if (!user) return

    const { groupId } = req.params as { groupId: string }

    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)

    if (!g) return reply.status(404).send({ error: 'Not found' })

    if (!(await requireGroupMember(groupId, user.userId))) {

      return reply.status(403).send({ error: 'Members only' })

    }

    const parsed = reviewBody.safeParse(req.body)

    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    try {

      const [row] = await db

        .insert(schema.groupReviews)

        .values({

          groupId,

          authorId: user.userId,

          sentiment: parsed.data.sentiment,

          body: parsed.data.body,

          cultureRating: parsed.data.cultureRating,

          newMemberFriendlinessRating: parsed.data.newMemberFriendlinessRating,

          moderationQualityRating: parsed.data.moderationQualityRating,

          safetyResponsivenessRating: parsed.data.safetyResponsivenessRating,

          eventUsefulnessRating: parsed.data.eventUsefulnessRating,

          communicationClarityRating: parsed.data.communicationClarityRating,

        })

        .returning()

      await touchGroupActivity(groupId)

      return reply.send({ review: row })

    } catch {

      return reply.status(409).send({ error: 'You already left feedback for this group' })

    }

  })

}


