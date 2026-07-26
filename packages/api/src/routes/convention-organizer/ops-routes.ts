import { buildLiveOpsPayload } from '../../lib/convention-organizer/liveOps.js'
import { createRegistrar, requireDb, requireOrganizer, requireUser, type RouteRegistrar } from './shared.js'

export function registerOpsRoutes(reg: RouteRegistrar) {
  reg('GET', '/api/v1/conventions/:key/ops/live', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'any')
    if (!ctx) return
    const payload = await buildLiveOpsPayload(ctx.conv.id, ctx.conv.timezone)
    return reply.send(payload)
  })
}

export function registerOpsRoutesOnApp(app: import('fastify').FastifyInstance, registered: string[]) {
  registerOpsRoutes(createRegistrar(app, registered))
}
