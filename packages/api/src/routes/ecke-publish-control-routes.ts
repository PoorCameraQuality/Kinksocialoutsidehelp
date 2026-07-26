import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import {
  getConventionEckePublishOverview,
  getEckePublishPreview,
  getEckePublishRegistryForViewer,
  getEckePublishStatus,
  getGroupEckePublishOverview,
  getOrgEckePublishOverview,
  isValidEckeSourceKind,
  publishEckeSource,
  resolveGroupPublishAccess,
  resolveOrgPublishAccess,
  syncEckeSource,
  unpublishEckeSource,
  type EckePublishViewer,
} from '../lib/ecke-publish-service.js'
import { loadConventionEckeContext } from '../lib/ecke-publish-org-convention.js'
import { listAllRegistryEntries } from '../lib/ecke-publish-registry.js'
import { resolveConventionId } from './conventions-routes.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireViewer(req: FastifyRequest, reply: FastifyReply): EckePublishViewer | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
}

export async function registerEckePublishControlRoutes(app: FastifyInstance) {
  app.get('/api/v1/ecke-publish/registry', async (req, reply) => {
    const viewer = requireViewer(req, reply)
    if (!viewer) return

    const groupId = (req.query as { groupId?: string }).groupId?.trim()
    const entries =
      groupId ?
        getEckePublishRegistryForViewer(viewer, { kind: 'group', groupId })
      : listAllRegistryEntries()

    return reply.send({
      readOnlyPass: true,
      entries,
    })
  })

  app.get('/api/v1/ecke-publish/status', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return

    const { sourceKind, sourceId } = req.query as { sourceKind?: string; sourceId?: string }
    if (!sourceKind?.trim() || !sourceId?.trim()) {
      return reply.status(400).send({ error: 'sourceKind and sourceId are required' })
    }
    if (!isValidEckeSourceKind(sourceKind)) {
      return reply.status(400).send({ error: 'Unknown sourceKind' })
    }

    const result = await getEckePublishStatus(viewer, sourceKind, sourceId.trim())
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  app.get('/api/v1/ecke-publish/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return

    const { sourceKind, sourceId } = req.query as { sourceKind?: string; sourceId?: string }
    if (!sourceKind?.trim() || !sourceId?.trim()) {
      return reply.status(400).send({ error: 'sourceKind and sourceId are required' })
    }
    if (!isValidEckeSourceKind(sourceKind)) {
      return reply.status(400).send({ error: 'Unknown sourceKind' })
    }

    const result = await getEckePublishPreview(viewer, sourceKind, sourceId.trim())
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  app.get('/api/v1/groups/:groupId/ecke-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return
    const { groupId } = req.params as { groupId: string }

    const result = await getGroupEckePublishOverview(viewer, groupId)
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  app.get('/api/v1/groups/:groupId/ecke-publish/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return
    const { groupId } = req.params as { groupId: string }
    const sourceKind = (req.query as { sourceKind?: string }).sourceKind?.trim() || 'group_listing'
    const sourceId = (req.query as { sourceId?: string }).sourceId?.trim() || groupId

    if (!isValidEckeSourceKind(sourceKind)) {
      return reply.status(400).send({ error: 'Unknown sourceKind' })
    }

    let result
    if (sourceKind === 'education_article') {
      const groupAccess = await resolveGroupPublishAccess(groupId, viewer.userId)
      if (!groupAccess?.canManage) {
        return reply.status(403).send({ error: 'Group moderator access required to preview ECKE publish' })
      }
      result = await getEckePublishPreview(viewer, sourceKind, sourceId, {
        groupOrganizationId: groupAccess.group.organizationId ?? undefined,
        groupModerator: groupAccess.canManage,
      })
    } else {
      result = await getEckePublishPreview(viewer, sourceKind, sourceId)
    }

    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  app.get('/api/v1/organizations/:orgKey/ecke-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return
    const { orgKey } = req.params as { orgKey: string }

    const result = await getOrgEckePublishOverview(viewer, orgKey)
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  app.get('/api/v1/organizations/:orgKey/ecke-publish/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return
    const { orgKey } = req.params as { orgKey: string }
    const sourceKind = (req.query as { sourceKind?: string }).sourceKind?.trim()
    const sourceId = (req.query as { sourceId?: string }).sourceId?.trim()

    if (!sourceKind || !sourceId) {
      return reply.status(400).send({ error: 'sourceKind and sourceId are required' })
    }
    if (!isValidEckeSourceKind(sourceKind)) {
      return reply.status(400).send({ error: 'Unknown sourceKind' })
    }

    const orgAccess = await resolveOrgPublishAccess(orgKey, viewer.userId)
    if (!orgAccess?.canManage) {
      return reply.status(403).send({ error: 'Organization moderator access required to preview ECKE publish' })
    }

    const result = await getEckePublishPreview(
      viewer,
      sourceKind,
      sourceId,
      sourceKind === 'education_article' ? { organizationId: orgAccess.organization.id } : undefined,
      sourceKind === 'vendor_profile' ? { organizationId: orgAccess.organization.id } : undefined,
    )
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  async function handleWriteAction(
    req: FastifyRequest,
    reply: FastifyReply,
    action: 'publish' | 'sync' | 'unpublish',
    sourceKind: string,
    sourceId: string,
    options?: { expectedGroupId?: string; expectedOrgKey?: string },
  ) {
    if (!requireDb(reply)) return null
    const viewer = requireViewer(req, reply)
    if (!viewer) return null
    if (!isValidEckeSourceKind(sourceKind)) {
      reply.status(400).send({ error: 'Unknown sourceKind' })
      return null
    }
    const runner =
      action === 'publish' ? publishEckeSource
      : action === 'sync' ? syncEckeSource
      : unpublishEckeSource
    const result = await runner(viewer, {
      sourceKind: sourceKind as import('../lib/ecke-publish-registry.js').EckeSourceKind,
      sourceId: sourceId.trim(),
      expectedGroupId: options?.expectedGroupId,
      expectedOrgKey: options?.expectedOrgKey,
    })
    if (!result.ok) {
      reply.status(result.status).send({ error: result.error, errorCode: result.errorCode })
      return null
    }
    return result.result
  }

  function resolveGroupScopedWrite(
    groupId: string,
    body: { sourceKind?: string; sourceId?: string },
  ): { sourceKind: string; sourceId: string } | { error: string } {
    const sourceKind = body.sourceKind?.trim() || 'group_listing'
    if (sourceKind === 'group_listing') {
      return { sourceKind, sourceId: groupId }
    }
    if (sourceKind === 'event_listing' || sourceKind === 'education_article') {
      const sourceId = body.sourceId?.trim()
      if (!sourceId) return { error: `sourceId is required for ${sourceKind}` }
      return { sourceKind, sourceId }
    }
    return { error: 'Unsupported sourceKind for group-scoped ECKE publish' }
  }

  function resolveOrgScopedWrite(
    body: { sourceKind?: string; sourceId?: string },
  ): { sourceKind: string; sourceId: string } | { error: string } {
    const sourceKind = body.sourceKind?.trim()
    const sourceId = body.sourceId?.trim()
    if (!sourceKind || !sourceId) {
      return { error: 'sourceKind and sourceId are required' }
    }
    const allowed = ['education_article', 'vendor_profile', 'organization_listing', 'dungeon_profile'] as const
    if (!allowed.includes(sourceKind as (typeof allowed)[number])) {
      return { error: 'Unsupported sourceKind for org-scoped ECKE publish' }
    }
    return { sourceKind, sourceId }
  }

  async function resolveConventionScopedWrite(
    conventionKey: string,
    body: { sourceKind?: string; sourceId?: string },
  ): Promise<{ sourceKind: string; sourceId: string } | { error: string }> {
    const sourceKind = body.sourceKind?.trim()
    const sourceId = body.sourceId?.trim()
    if (!sourceKind || !sourceId) {
      return { error: 'sourceKind and sourceId are required' }
    }
    const allowed = [
      'convention_listing',
      'convention_event_anchor',
      'dancecard_event',
      'dancecard_location',
      'dancecard_program_slot',
      'dancecard_staff_shift',
    ] as const
    if (!allowed.includes(sourceKind as (typeof allowed)[number])) {
      return { error: 'Unsupported sourceKind for convention-scoped ECKE publish' }
    }
    const conventionId = await resolveConventionId(conventionKey)
    if (!conventionId) return { error: 'Convention not found' }
    if (conventionId !== sourceId) {
      return { error: 'sourceId does not match this convention' }
    }
    return { sourceKind, sourceId }
  }

  app.get('/api/v1/conventions/:conventionKey/ecke-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return
    const { conventionKey } = req.params as { conventionKey: string }

    const result = await getConventionEckePublishOverview(viewer, conventionKey)
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  app.get('/api/v1/conventions/:conventionKey/ecke-publish/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireViewer(req, reply)
    if (!viewer) return
    const { conventionKey } = req.params as { conventionKey: string }
    const sourceKind = (req.query as { sourceKind?: string }).sourceKind?.trim()
    const sourceId = (req.query as { sourceId?: string }).sourceId?.trim()

    if (!sourceKind || !sourceId) {
      return reply.status(400).send({ error: 'sourceKind and sourceId are required' })
    }
    if (!isValidEckeSourceKind(sourceKind)) {
      return reply.status(400).send({ error: 'Unknown sourceKind' })
    }

    const conventionId = await resolveConventionId(conventionKey)
    if (!conventionId) {
      return reply.status(404).send({ error: 'Convention not found' })
    }
    if (conventionId !== sourceId) {
      return reply.status(400).send({ error: 'sourceId does not match this convention' })
    }

    const ctx = await loadConventionEckeContext(conventionKey, viewer.userId)
    if (!ctx?.canManage) {
      return reply.status(403).send({ error: 'Convention full admin access required to preview ECKE publish' })
    }

    const result = await getEckePublishPreview(viewer, sourceKind, sourceId)
    if (!result.ok) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send(result.result)
  })

  async function handleConventionWrite(
    req: FastifyRequest,
    reply: FastifyReply,
    conventionKey: string,
    action: 'publish' | 'sync' | 'unpublish',
  ) {
    const body = (req.body ?? {}) as { sourceKind?: string; sourceId?: string }
    const resolved = await resolveConventionScopedWrite(conventionKey, body)
    if ('error' in resolved) return reply.status(400).send({ error: resolved.error })
    const result = await handleWriteAction(req, reply, action, resolved.sourceKind, resolved.sourceId)
    if (result) return reply.send(result)
  }

  app.post('/api/v1/conventions/:conventionKey/ecke-publish/publish', async (req, reply) => {
    const { conventionKey } = req.params as { conventionKey: string }
    await handleConventionWrite(req, reply, conventionKey, 'publish')
  })

  app.post('/api/v1/conventions/:conventionKey/ecke-publish/sync', async (req, reply) => {
    const { conventionKey } = req.params as { conventionKey: string }
    await handleConventionWrite(req, reply, conventionKey, 'sync')
  })

  app.post('/api/v1/conventions/:conventionKey/ecke-publish/unpublish', async (req, reply) => {
    const { conventionKey } = req.params as { conventionKey: string }
    await handleConventionWrite(req, reply, conventionKey, 'unpublish')
  })

  app.post('/api/v1/ecke-publish/publish', async (req, reply) => {
    const body = req.body as { sourceKind?: string; sourceId?: string }
    if (!body.sourceKind?.trim() || !body.sourceId?.trim()) {
      return reply.status(400).send({ error: 'sourceKind and sourceId are required' })
    }
    const result = await handleWriteAction(req, reply, 'publish', body.sourceKind, body.sourceId)
    if (result) return reply.send(result)
  })

  app.post('/api/v1/ecke-publish/sync', async (req, reply) => {
    const body = req.body as { sourceKind?: string; sourceId?: string }
    if (!body.sourceKind?.trim() || !body.sourceId?.trim()) {
      return reply.status(400).send({ error: 'sourceKind and sourceId are required' })
    }
    const result = await handleWriteAction(req, reply, 'sync', body.sourceKind, body.sourceId)
    if (result) return reply.send(result)
  })

  app.post('/api/v1/ecke-publish/unpublish', async (req, reply) => {
    const body = req.body as { sourceKind?: string; sourceId?: string }
    if (!body.sourceKind?.trim() || !body.sourceId?.trim()) {
      return reply.status(400).send({ error: 'sourceKind and sourceId are required' })
    }
    const result = await handleWriteAction(req, reply, 'unpublish', body.sourceKind, body.sourceId)
    if (result) return reply.send(result)
  })

  app.post('/api/v1/groups/:groupId/ecke-publish/publish', async (req, reply) => {
    const { groupId } = req.params as { groupId: string }
    const body = (req.body ?? {}) as { sourceKind?: string; sourceId?: string }
    const resolved = resolveGroupScopedWrite(groupId, body)
    if ('error' in resolved) return reply.status(400).send({ error: resolved.error })
    const result = await handleWriteAction(req, reply, 'publish', resolved.sourceKind, resolved.sourceId, {
      expectedGroupId: groupId,
    })
    if (result) return reply.send(result)
  })

  app.post('/api/v1/groups/:groupId/ecke-publish/sync', async (req, reply) => {
    const { groupId } = req.params as { groupId: string }
    const body = (req.body ?? {}) as { sourceKind?: string; sourceId?: string }
    const resolved = resolveGroupScopedWrite(groupId, body)
    if ('error' in resolved) return reply.status(400).send({ error: resolved.error })
    const result = await handleWriteAction(req, reply, 'sync', resolved.sourceKind, resolved.sourceId, {
      expectedGroupId: groupId,
    })
    if (result) return reply.send(result)
  })

  app.post('/api/v1/groups/:groupId/ecke-publish/unpublish', async (req, reply) => {
    const { groupId } = req.params as { groupId: string }
    const body = (req.body ?? {}) as { sourceKind?: string; sourceId?: string }
    const resolved = resolveGroupScopedWrite(groupId, body)
    if ('error' in resolved) return reply.status(400).send({ error: resolved.error })
    const result = await handleWriteAction(req, reply, 'unpublish', resolved.sourceKind, resolved.sourceId, {
      expectedGroupId: groupId,
    })
    if (result) return reply.send(result)
  })

  app.post('/api/v1/organizations/:orgKey/ecke-publish/publish', async (req, reply) => {
    const { orgKey } = req.params as { orgKey: string }
    const body = (req.body ?? {}) as { sourceKind?: string; sourceId?: string }
    const resolved = resolveOrgScopedWrite(body)
    if ('error' in resolved) return reply.status(400).send({ error: resolved.error })
    const result = await handleWriteAction(req, reply, 'publish', resolved.sourceKind, resolved.sourceId, {
      expectedOrgKey: orgKey,
    })
    if (result) return reply.send(result)
  })

  app.post('/api/v1/organizations/:orgKey/ecke-publish/sync', async (req, reply) => {
    const { orgKey } = req.params as { orgKey: string }
    const body = (req.body ?? {}) as { sourceKind?: string; sourceId?: string }
    const resolved = resolveOrgScopedWrite(body)
    if ('error' in resolved) return reply.status(400).send({ error: resolved.error })
    const result = await handleWriteAction(req, reply, 'sync', resolved.sourceKind, resolved.sourceId, {
      expectedOrgKey: orgKey,
    })
    if (result) return reply.send(result)
  })

  app.post('/api/v1/organizations/:orgKey/ecke-publish/unpublish', async (req, reply) => {
    const { orgKey } = req.params as { orgKey: string }
    const body = (req.body ?? {}) as { sourceKind?: string; sourceId?: string }
    const resolved = resolveOrgScopedWrite(body)
    if ('error' in resolved) return reply.status(400).send({ error: resolved.error })
    const result = await handleWriteAction(req, reply, 'unpublish', resolved.sourceKind, resolved.sourceId, {
      expectedOrgKey: orgKey,
    })
    if (result) return reply.send(result)
  })
}
