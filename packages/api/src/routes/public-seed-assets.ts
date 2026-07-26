import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename, extname, join, normalize, resolve } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { getWebPublicSeedPafDir, getWebPublicSeedEckeDir } from '../lib/public-seed-paths.js'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

function sendSeedFile(root: string, relPath: string, reply: import('fastify').FastifyReply) {
  const name = basename(relPath)
  if (!/^[a-zA-Z0-9._/-]+$/.test(relPath.replace(/\\/g, '/'))) {
    return reply.status(400).send({ error: 'Invalid path' })
  }
  const abs = normalize(resolve(root, relPath))
  if (!abs.startsWith(normalize(resolve(root)))) {
    return reply.status(400).send({ error: 'Invalid path' })
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    return reply.status(404).send({ error: 'Not found' })
  }
  const ext = extname(name).toLowerCase()
  const mime = MIME[ext] ?? 'application/octet-stream'
  reply.header('Cache-Control', 'public, max-age=3600')
  return reply.type(mime).send(createReadStream(abs))
}

export async function registerPublicSeedAssetRoutes(app: FastifyInstance) {
  app.get('/api/public-seed/paf/:filename', async (req, reply) => {
    const raw = (req.params as { filename?: string }).filename ?? ''
    const name = basename(raw)
    return sendSeedFile(getWebPublicSeedPafDir(), name, reply)
  })

  app.get('/api/public-seed/ecke/*', async (req, reply) => {
    const rel = (req.params as { '*': string })['*'] ?? ''
    return sendSeedFile(getWebPublicSeedEckeDir(), rel, reply)
  })
}
