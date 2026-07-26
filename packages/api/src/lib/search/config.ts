export type SearchProvider = 'database' | 'typesense'

export type SearchConfig = {
  provider: SearchProvider
  indexingEnabled: boolean
  queryEnabled: boolean
  adminReindexEnabled: boolean
  indexPrefix: string
  host: string | null
  apiKey: string | null
  readApiKey: string | null
  syncBatchSize: number
  environment: string
}

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return defaultValue
  const v = raw.trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return defaultValue
}

function parseProvider(raw: string | undefined): SearchProvider {
  const v = (raw ?? 'database').trim().toLowerCase()
  return v === 'typesense' ? 'typesense' : 'database'
}

/** Read search env once per call — tests may mutate process.env between calls. */
export function readSearchConfig(): SearchConfig {
  const provider = parseProvider(process.env.SEARCH_PROVIDER)
  const typesenseConfigured = Boolean(process.env.SEARCH_HOST?.trim())
  const indexingEnabled =
    provider === 'typesense' &&
    typesenseConfigured &&
    parseBool(process.env.SEARCH_INDEXING_ENABLED, false)
  const queryEnabled =
    provider === 'typesense' &&
    typesenseConfigured &&
    parseBool(process.env.SEARCH_QUERY_ENABLED, false)

  return {
    provider,
    indexingEnabled,
    queryEnabled,
    adminReindexEnabled: parseBool(process.env.SEARCH_ADMIN_REINDEX_ENABLED, false),
    indexPrefix: (process.env.SEARCH_INDEX_PREFIX ?? 'c2k').trim() || 'c2k',
    host: process.env.SEARCH_HOST?.trim() || null,
    apiKey: process.env.SEARCH_API_KEY?.trim() || null,
    readApiKey: process.env.SEARCH_READ_API_KEY?.trim() || null,
    syncBatchSize: Math.min(500, Math.max(1, Number(process.env.SEARCH_SYNC_BATCH_SIZE ?? 100) || 100)),
    environment: (process.env.SEARCH_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development').trim(),
  }
}

export function isTypesenseProviderActive(): boolean {
  return readSearchConfig().provider === 'typesense' && Boolean(readSearchConfig().host)
}
