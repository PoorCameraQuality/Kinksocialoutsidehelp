import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { createNotification } from './create-notification.js'

const MS_H = 60 * 60 * 1000

/**
 * Sends in-app reminders for upcoming virtual events (24h and ~1h before start).
 * Idempotent via `event_rsvps.reminder_virtual_*_sent_at`.
 */
export async function runVirtualEventReminderSweep(): Promise<void> {
  const now = Date.now()

  const rsvpRows = await db
    .select({
      rsvpId: schema.eventRsvps.id,
      userId: schema.eventRsvps.userId,
      eventId: schema.eventRsvps.eventId,
      status: schema.eventRsvps.status,
      reminder24: schema.eventRsvps.reminderVirtual24hSentAt,
      reminder1h: schema.eventRsvps.reminderVirtual1hSentAt,
      title: schema.events.title,
      startsAt: schema.events.startsAt,
      virtualStyle: schema.events.virtualSessionStyle,
    })
    .from(schema.eventRsvps)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventRsvps.eventId))
    .where(
      and(
        eq(schema.events.eventFormat, 'virtual'),
        inArray(schema.eventRsvps.status, ['going', 'maybe']),
        sql`${schema.events.startsAt} > NOW()`
      )
    )

  for (const row of rsvpRows) {
    const start = row.startsAt.getTime()
    const until = start - now

    // ~24h before (window 22h–26h to tolerate slow sweeps)
    if (
      until >= 22 * MS_H &&
      until <= 26 * MS_H &&
      row.reminder24 == null
    ) {
      await createNotification(row.userId, 'event_virtual_reminder_24h', {
        eventId: row.eventId,
        title: row.title,
        virtualSessionStyle: row.virtualStyle ?? 'social',
      })
      await db
        .update(schema.eventRsvps)
        .set({ reminderVirtual24hSentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.eventRsvps.id, row.rsvpId))
      continue
    }

    // ~1h before (40m–90m window)
    if (
      until >= 40 * 60 * 1000 &&
      until <= 90 * MS_H &&
      row.reminder1h == null
    ) {
      await createNotification(row.userId, 'event_virtual_reminder_1h', {
        eventId: row.eventId,
        title: row.title,
        virtualSessionStyle: row.virtualStyle ?? 'social',
      })
      await db
        .update(schema.eventRsvps)
        .set({ reminderVirtual1hSentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.eventRsvps.id, row.rsvpId))
    }
  }
}
