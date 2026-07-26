import { readSearchConfig } from './config.js'
import {
  SEARCH_INDEX_KEYS,
  SEARCH_INDEX_REGISTRY,
  isIndexIndexingActive,
  isIndexQueryActive,
} from './index-registry.js'
import { pingTypesenseHealth } from './typesense-client.js'

export type SearchHealthDiagnostic = {
  provider: string
  indexingEnabled: boolean
  queryEnabled: boolean
  typesense: { ok: boolean; message?: string }
  indexes: Array<{
    key: string
    rolloutEnabled: boolean
    indexingActive: boolean
    queryActive: boolean
    phase: number
  }>
}

export async function searchHealthDiagnostic(): Promise<SearchHealthDiagnostic> {
  const cfg = readSearchConfig()
  const typesense = await pingTypesenseHealth()
  return {
    provider: cfg.provider,
    indexingEnabled: cfg.indexingEnabled,
    queryEnabled: cfg.queryEnabled,
    typesense,
    indexes: SEARCH_INDEX_KEYS.map((key) => ({
      key,
      rolloutEnabled: SEARCH_INDEX_REGISTRY[key].enabled,
      indexingActive: isIndexIndexingActive(key),
      queryActive: isIndexQueryActive(key),
      phase: SEARCH_INDEX_REGISTRY[key].rolloutPhase,
    })),
  }
}
