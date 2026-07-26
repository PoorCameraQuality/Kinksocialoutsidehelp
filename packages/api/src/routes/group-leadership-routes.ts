import { and, count, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { db, schema } from '../db/index.js'
import { isPlatformModeratorUser } from '../lib/platform-staff.js'

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

async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const [m] = await db
    .select({ id: schema.groupMembers.id })
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
    .limit(1)
  return Boolean(m)
}

export async function registerGroupLeadershipRoutes(app: FastifyInstance) {
  app.get('/api/v1/groups/:groupId/leadership-election', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    if (!(await isGroupMember(groupId, user.userId))) {
      return reply.status(403).send({ error: 'Members only' })
    }
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (!g.leadershipVoteOpen) {
      return reply.send({
        open: false,
        ownerId: g.ownerId,
        tallies: [] as { candidateUserId: string; username: string; votes: number }[],
        myVote: null as { candidateUserId: string; username: string } | null,
        members: [] as { userId: string; username: string }[],
      })
    }

    const members = await db
      .select({
        userId: schema.groupMembers.userId,
        username: schema.users.username,
      })
      .from(schema.groupMembers)
      .innerJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id))
      .where(eq(schema.groupMembers.groupId, groupId))

    const tallyRows = await db
      .select({
        candidateUserId: schema.groupLeadershipVotes.candidateUserId,
        votes: count(),
      })
      .from(schema.groupLeadershipVotes)
      .where(eq(schema.groupLeadershipVotes.groupId, groupId))
      .groupBy(schema.groupLeadershipVotes.candidateUserId)

    const nameByUserId = new Map(members.map((m) => [m.userId, m.username]))
    const tallies = tallyRows.map((t) => ({
      candidateUserId: t.candidateUserId,
      username: nameByUserId.get(t.candidateUserId) ?? 'unknown',
      votes: Number(t.votes),
    }))

    const [mine] = await db
      .select({
        candidateUserId: schema.groupLeadershipVotes.candidateUserId,
      })
      .from(schema.groupLeadershipVotes)
      .where(
        and(eq(schema.groupLeadershipVotes.groupId, groupId), eq(schema.groupLeadershipVotes.voterId, user.userId))
      )
      .limit(1)

    let myVote: { candidateUserId: string; username: string } | null = null
    if (mine) {
      myVote = {
        candidateUserId: mine.candidateUserId,
        username: nameByUserId.get(mine.candidateUserId) ?? 'unknown',
      }
    }

    return reply.send({
      open: true,
      ownerId: g.ownerId,
      tallies,
      myVote,
      members,
    })
  })

  const voteBody = z.object({
    candidateUserId: z.string().uuid(),
  })

  app.post('/api/v1/groups/:groupId/leadership-election/vote', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    const parsed = voteBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (!g.leadershipVoteOpen) return reply.status(400).send({ error: 'Election is not open' })
    if (!(await isGroupMember(groupId, user.userId))) {
      return reply.status(403).send({ error: 'Members only' })
    }
    if (!(await isGroupMember(groupId, parsed.data.candidateUserId))) {
      return reply.status(400).send({ error: 'Candidate must be a group member' })
    }

    await db
      .insert(schema.groupLeadershipVotes)
      .values({
        groupId,
        voterId: user.userId,
        candidateUserId: parsed.data.candidateUserId,
      })
      .onConflictDoUpdate({
        target: [schema.groupLeadershipVotes.groupId, schema.groupLeadershipVotes.voterId],
        set: {
          candidateUserId: parsed.data.candidateUserId,
          updatedAt: new Date(),
        },
      })

    return reply.send({ ok: true })
  })

  const finalizeBody = z.object({
    winnerUserId: z.string().uuid(),
  })

  app.post('/api/v1/groups/:groupId/leadership-election/finalize', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await isPlatformModeratorUser(user.userId))) {
      return reply.status(403).send({ error: 'Platform moderator only' })
    }
    const { groupId } = req.params as { groupId: string }
    const parsed = finalizeBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (!g.leadershipVoteOpen) return reply.status(400).send({ error: 'Election is not open' })
    const winnerId = parsed.data.winnerUserId
    if (!(await isGroupMember(groupId, winnerId))) {
      return reply.status(400).send({ error: 'Winner must be a group member' })
    }

    const oldOwnerId = g.ownerId

    await db.transaction(async (tx) => {
      await tx
        .update(schema.groups)
        .set({ ownerId: winnerId, leadershipVoteOpen: false })
        .where(eq(schema.groups.id, groupId))

      if (oldOwnerId !== winnerId) {
        await tx
          .update(schema.groupMembers)
          .set({ role: 'admin' })
          .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, oldOwnerId)))

        await tx
          .update(schema.groupMembers)
          .set({ role: 'owner' })
          .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, winnerId)))
      }

      await tx.delete(schema.groupLeadershipVotes).where(eq(schema.groupLeadershipVotes.groupId, groupId))
    })

    return reply.send({ ok: true, ownerId: winnerId })
  })
}
