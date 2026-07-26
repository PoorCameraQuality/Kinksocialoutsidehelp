/** Summarize import row actions before publish (MVP diff counts). */

export type ImportRowAction = 'add' | 'update' | 'delete' | 'unchanged' | string

export type ImportDiffSummary = {
  newCount: number
  updatedCount: number
  removedCount: number
  unchangedCount: number
  invalidCount: number
  conflictCount: number
  total: number
}

export function summarizeImportRows(
  rows: { action?: string; draft_status?: string; validation_errors?: string[] }[],
): ImportDiffSummary {
  let newCount = 0
  let updatedCount = 0
  let removedCount = 0
  let unchangedCount = 0
  let invalidCount = 0
  let conflictCount = 0

  for (const row of rows) {
    const action = String(row.action ?? '')
    if (row.draft_status === 'invalid' || (row.validation_errors?.length ?? 0) > 0) {
      invalidCount += 1
      if ((row.validation_errors ?? []).some((e) => /conflict|overlap|double/i.test(e))) conflictCount += 1
      continue
    }
    if (action === 'add') newCount += 1
    else if (action === 'update') updatedCount += 1
    else if (action === 'delete') removedCount += 1
    else if (action === 'unchanged') unchangedCount += 1
  }

  return {
    newCount,
    updatedCount,
    removedCount,
    unchangedCount,
    invalidCount,
    conflictCount,
    total: rows.length,
  }
}

export function importDiffHeadline(summary: ImportDiffSummary): string {
  const parts: string[] = []
  if (summary.newCount) parts.push(`${summary.newCount} new`)
  if (summary.updatedCount) parts.push(`${summary.updatedCount} updated`)
  if (summary.removedCount) parts.push(`${summary.removedCount} removed`)
  if (summary.invalidCount) parts.push(`${summary.invalidCount} need fixes`)
  if (parts.length === 0) return 'No changes detected in this draft.'
  return parts.join(', ')
}
