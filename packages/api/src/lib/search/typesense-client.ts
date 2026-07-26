import { createRequire } from 'node:module'

import { readSearchConfig } from './config.js'

const require = createRequire(import.meta.url)

export type TypesenseNodeConfig = {
  host: string
  port: number
  protocol: 'http' | 'https'
}

type TypesenseClient = InstanceType<typeof import('typesense').Client>

let TypesenseModule: typeof import('typesense') | null | undefined

function loadTypesenseModule(): typeof import('typesense') | null {
  if (TypesenseModule !== undefined) return TypesenseModule
  try {
    TypesenseModule = require('typesense') as typeof import('typesense')
  } catch {
    TypesenseModule = null
  }
  return TypesenseModule
}

export function parseSearchHostUrl(raw: string): TypesenseNodeConfig {
  const url = new URL(raw.includes('://') ? raw : `http://${raw}`)
  const protocol = url.protocol === 'https:' ? 'https' : 'http'
  const port = url.port ? Number(url.port) : protocol === 'https' ? 443 : 8108
  return { host: url.hostname, port, protocol }
}

let adminClient: TypesenseClient | null | undefined
let readClient: TypesenseClient | null | undefined

function buildClient(apiKey: string | null): TypesenseClient | null {
  const Typesense = loadTypesenseModule()
  if (!Typesense?.Client) return null
  const cfg = readSearchConfig()
  if (!cfg.host || !apiKey) return null
  const node = parseSearchHostUrl(cfg.host)
  return new Typesense.Client({
    nodes: [node],
    apiKey,
    connectionTimeoutSeconds: 3,
    numRetries: 1,
  })
}

/** Admin client — indexing, collection management. Server/worker only. */
export function getTypesenseAdminClient(): TypesenseClient | null {
  if (adminClient !== undefined) return adminClient
  const cfg = readSearchConfig()
  adminClient = cfg.provider === 'typesense' ? buildClient(cfg.apiKey) : null
  return adminClient
}

/** Read client — search queries. Server only; never expose to web. */
export function getTypesenseReadClient(): TypesenseClient | null {
  if (readClient !== undefined) return readClient
  const cfg = readSearchConfig()
  const key = cfg.readApiKey ?? cfg.apiKey
  readClient = cfg.provider === 'typesense' ? buildClient(key) : null
  return readClient
}

/** Reset cached clients (tests). */
export function resetTypesenseClientsForTests(): void {
  adminClient = undefined
  readClient = undefined
  TypesenseModule = undefined
}

export async function pingTypesenseHealth(): Promise<{ ok: boolean; message?: string }> {
  const cfg = readSearchConfig()
  if (cfg.provider !== 'typesense' || !cfg.host) {
    return { ok: true, message: 'typesense_not_configured' }
  }
  const client = getTypesenseReadClient() ?? getTypesenseAdminClient()
  if (!client) return { ok: false, message: loadTypesenseModule() ? 'missing_api_key' : 'typesense_package_missing' }
  try {
    const health = await client.health.retrieve()
    return { ok: health.ok === true, message: health.ok ? 'ok' : 'unhealthy' }
  } catch (err) {
    const e = err as { message?: string }
    return { ok: false, message: e.message ?? 'unreachable' }
  }
}
