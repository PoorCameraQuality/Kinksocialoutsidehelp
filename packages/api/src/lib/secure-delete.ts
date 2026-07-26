import { eq, sql } from 'drizzle-orm'
import { SECURE_DELETE_PASS_COUNT } from '@c2k/shared'
import { db, schema } from '../db/index.js'

async function overwriteDirectMessageBody(messageId: string, passes: number): Promise<void> {
  for (let pass = 0; pass < passes; pass += 1) {
    await db.execute(sql`
      UPDATE messages
      SET body = encode(gen_random_bytes(greatest(octet_length(body), 16)), 'hex')
      WHERE id = ${messageId}::uuid
    `)
  }
}

async function overwriteHubMessageBody(messageId: string, passes: number): Promise<void> {
  for (let pass = 0; pass < passes; pass += 1) {
    await db.execute(sql`
      UPDATE convention_hub_channel_messages
      SET body = encode(gen_random_bytes(greatest(octet_length(body), 16)), 'hex')
      WHERE id = ${messageId}::uuid
    `)
  }
}

/** Multi-pass overwrite of message body, then row delete. */
export async function secureDeleteDirectMessage(
  messageId: string,
  passes: number = SECURE_DELETE_PASS_COUNT
): Promise<void> {
  await overwriteDirectMessageBody(messageId, passes)
  await db.delete(schema.messages).where(eq(schema.messages.id, messageId))
}

/** Multi-pass overwrite of hub chat body, then row delete. */
export async function secureDeleteHubMessage(
  messageId: string,
  passes: number = SECURE_DELETE_PASS_COUNT
): Promise<void> {
  await overwriteHubMessageBody(messageId, passes)
  await db
    .delete(schema.conventionHubChannelMessages)
    .where(eq(schema.conventionHubChannelMessages.id, messageId))
}
