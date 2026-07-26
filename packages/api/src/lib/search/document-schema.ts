/**
 * Shared Typesense document conventions for all C2K indexes.
 * Every indexed document should include `entity_type`, `entity_id`, and `updated_at`.
 */

export type SearchDocumentBase = {
  /** Typesense document id — stable, prefixed: `education:{uuid}` */
  id: string
  entity_type: string
  entity_id: string
  /** Unix epoch seconds — sort + stale detection */
  updated_at: number
}

export function buildSearchDocumentId(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`
}

export function parseSearchDocumentId(docId: string): { entityType: string; entityId: string } | null {
  const i = docId.indexOf(':')
  if (i <= 0) return null
  return { entityType: docId.slice(0, i), entityId: docId.slice(i + 1) }
}
