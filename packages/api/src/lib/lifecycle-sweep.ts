import { eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { createNotification } from './create-notification.js'

const idleDays = () => Number(process.env.C2K_GROUP_IDLE_WARN_DAYS ?? '180')
const warnToDisbandMs = 7 * 24 * 60 * 60 * 1000
const ownerAbsentMs = 180 * 24 * 60 * 60 * 1000

export async function runLifecycleSweep(): Promise<void> {
  const sixMoAgo = Date.now() - ownerAbsentMs
  const idleCut = Date.now() - idleDays() * 24 * 60 * 60 * 1000

  const allGroups = await db.select().from(schema.groups).where(isNull(schema.groups.disbandedAt))

  for (const g of allGroups) {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, g.ownerId)).limit(1)
    const ownerSeen = owner?.lastSeenAt ?? owner?.createdAt
    if (
      ownerSeen &&
      ownerSeen.getTime() < sixMoAgo &&
      !g.ownerAbsentMarkedAt &&
      g.visibility !== 'owner_absent'
    ) {
      await db
        .update(schema.groups)
        .set({
          visibility: 'owner_absent',
          leadershipVoteOpen: true,
          ownerAbsentMarkedAt: new Date(),
        })
        .where(eq(schema.groups.id, g.id))
      const members = await db
        .select({ userId: schema.groupMembers.userId })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.groupId, g.id))
      for (const m of members) {
        if (m.userId !== g.ownerId) {
          await createNotification(m.userId, 'group_owner_inactive', {
            groupId: g.id,
            groupName: g.name,
          })
        }
      }
    }

    if (g.lastActivityAt.getTime() < idleCut) {
      if (!g.idleWarningSentAt) {
        await db
          .update(schema.groups)
          .set({ idleWarningSentAt: new Date() })
          .where(eq(schema.groups.id, g.id))
        await createNotification(g.ownerId, 'group_idle_warning', {
          groupId: g.id,
          groupName: g.name,
        })
      } else if (Date.now() - g.idleWarningSentAt.getTime() > warnToDisbandMs) {
        const [fresh] = await db.select().from(schema.groups).where(eq(schema.groups.id, g.id)).limit(1)
        if (fresh && fresh.lastActivityAt.getTime() < idleCut) {
          await db
            .update(schema.groups)
            .set({ disbandedAt: new Date(), visibility: 'disbanded' })
            .where(eq(schema.groups.id, g.id))
          await createNotification(g.ownerId, 'group_disbanded_idle', {
            groupId: g.id,
            groupName: g.name,
          })
        }
      }
    }
  }
}
