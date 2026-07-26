'use client'

import {
  FIELD_LABELS,
  formatDetectionLabel,
  type CanonicalField,
  type ColumnMapping,
  type DetectedImportFormat,
  type ImportKind,
  fieldsForKind,
  headerLabelsFromRow,
  parseSpreadsheetImport,
  type SpreadsheetParseResult,
} from '@c2k/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'

type MappingProfile = {
  id: string
  name: string
  kind: ImportKind
  importFormat: string
  spreadsheetId: string | null
  headerRowIndex: number
  columnMapping: ColumnMapping
}

export function ImportColumnMappingPanel({
  eventSlug,
  kind,
  rawRows,
  timezone,
  windowStartsAt,
  windowEndsAt,
  sheetName,
  sourceId,
  spreadsheetId,
  initialHeaderRowIndex,
  initialMapping,
  initialImportFormat,
  readOnly,
  onMappingChange,
}: {
  eventSlug: string
  kind: ImportKind
  rawRows: string[][]
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  sheetName?: string | null
  sourceId?: string
  spreadsheetId?: string | null
  initialHeaderRowIndex?: number
  initialMapping?: ColumnMapping
  initialImportFormat?: DetectedImportFormat | 'flat_rows' | 'program_grid'
  readOnly?: boolean
  onMappingChange?: (result: SpreadsheetParseResult) => void
}) {
  const [formatOverride, setFormatOverride] = useState<'auto' | 'flat_rows' | 'program_grid'>('auto')
  const [headerRowIndex, setHeaderRowIndex] = useState(initialHeaderRowIndex ?? 0)
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping ?? {})
  const [profiles, setProfiles] = useState<MappingProfile[]>([])
  const [profileName, setProfileName] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const profileAppliedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await organizerDancecardFetch<{ profiles: MappingProfile[] }>(
          eventSlug,
          `/imports/mapping-profiles?kind=${kind}`,
        )
        if (!cancelled) setProfiles(res.profiles ?? [])
      } catch {
        if (!cancelled) setProfiles([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventSlug, kind])

  const parsed = useMemo(() => {
    const importFormat = formatOverride === 'auto' ? initialImportFormat : formatOverride
    return parseSpreadsheetImport(rawRows, {
      kind,
      importFormat,
      headerRowIndex,
      columnMapping: mapping,
      timezone,
      windowStartsAt,
      windowEndsAt,
      sourceId: sourceId ?? (sheetName ? `sheet:${sheetName}` : 'upload'),
      sheetName: sheetName ?? undefined,
    })
  }, [
    rawRows,
    kind,
    formatOverride,
    initialImportFormat,
    headerRowIndex,
    mapping,
    timezone,
    windowStartsAt,
    windowEndsAt,
    sourceId,
    sheetName,
  ])

  useEffect(() => {
    onMappingChange?.(parsed)
  }, [parsed, onMappingChange])

  const isGrid = parsed.importFormat === 'program_grid'
  const headers = useMemo(
    () => (isGrid ? [] : headerLabelsFromRow(rawRows, headerRowIndex)),
    [rawRows, headerRowIndex, isGrid],
  )
  const fields = fieldsForKind(kind)
  const validCount = parsed.rows.filter((r) => !r.validationErrors.length).length
  const invalidRows = parsed.rows.filter((r) => r.validationErrors.length > 0)

  function updateField(field: CanonicalField, header: string) {
    const next = { ...mapping, [field]: header || undefined }
    if (!header) delete next[field]
    setMapping(next)
  }

  async function saveProfile() {
    const name = profileName.trim()
    if (!name || readOnly) return
    setProfileBusy(true)
    setProfileMessage(null)
    try {
      await organizerDancecardFetch(eventSlug, '/imports/mapping-profiles', {
        method: 'POST',
        body: JSON.stringify({
          name,
          kind,
          importFormat: parsed.importFormat,
          spreadsheetId: spreadsheetId ?? null,
          headerRowIndex,
          columnMapping: mapping,
        }),
      })
      setProfileMessage(`Saved mapping “${name}”.`)
      const res = await organizerDancecardFetch<{ profiles: MappingProfile[] }>(
        eventSlug,
        `/imports/mapping-profiles?kind=${kind}`,
      )
      setProfiles(res.profiles ?? [])
    } catch (e) {
      setProfileMessage(e instanceof Error ? e.message : 'Could not save profile')
    } finally {
      setProfileBusy(false)
    }
  }

  function applyProfile(profileId: string) {
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) return
    setHeaderRowIndex(profile.headerRowIndex)
    setMapping(profile.columnMapping ?? {})
    if (profile.importFormat === 'program_grid' || profile.importFormat === 'flat_rows') {
      setFormatOverride(profile.importFormat)
    }
  }

  const suggestedProfile = spreadsheetId
    ? profiles.find((p) => p.spreadsheetId === spreadsheetId) ?? profiles[0]
    : profiles[0]

  useEffect(() => {
    if (profileAppliedRef.current || !suggestedProfile) return
    if (initialMapping && Object.keys(initialMapping).length > 0) return
    profileAppliedRef.current = true
    setHeaderRowIndex(suggestedProfile.headerRowIndex)
    setMapping(suggestedProfile.columnMapping ?? {})
    if (suggestedProfile.importFormat === 'program_grid' || suggestedProfile.importFormat === 'flat_rows') {
      setFormatOverride(suggestedProfile.importFormat)
    }
  }, [suggestedProfile, initialMapping])

  return (
    <div className="space-y-4 rounded-2xl border border-dc-border bg-dc-elevated-muted p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dc-accent">Map your spreadsheet</p>
        <p className="mt-1 text-sm text-dc-muted">
          We detect flat tables and time × room grids automatically. Fix mapping below, then create your draft.
        </p>
      </div>

      <div className="rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm">
        <p className="font-medium text-dc-text">
          Detected: {formatDetectionLabel(parsed.importFormat, kind)}
        </p>
        <p className="mt-1 text-xs text-dc-muted">
          {parsed.rows.length} rows · {validCount} valid · {invalidRows.length} need attention
          {sheetName ? ` · sheet “${sheetName}”` : ''}
        </p>
      </div>

      {kind === 'program' ? (
        <label className="flex flex-wrap items-center gap-2 text-sm text-dc-muted">
          Layout override
          <select
            className="rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-dc-text"
            value={formatOverride}
            disabled={readOnly}
            onChange={(e) => setFormatOverride(e.target.value as 'auto' | 'flat_rows' | 'program_grid')}
          >
            <option value="auto">Auto-detect</option>
            <option value="flat_rows">Flat table</option>
            <option value="program_grid">Time × room grid</option>
          </select>
        </label>
      ) : null}

      {!isGrid ? (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm text-dc-muted">
            Header row
            <select
              className="rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-dc-text"
              value={headerRowIndex}
              disabled={readOnly}
              onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
            >
              {rawRows.slice(0, 12).map((_, i) => (
                <option key={i} value={i}>
                  Row {i + 1}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field} className="block text-xs font-semibold uppercase tracking-wide text-dc-muted">
                {FIELD_LABELS[field]}
                <select
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm font-normal normal-case text-dc-text"
                  value={mapping[field] ?? ''}
                  disabled={readOnly}
                  onChange={(e) => updateField(field, e.target.value)}
                >
                  <option value="">, skip -</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {parsed.unmappedHeaders.length ? (
            <p className="text-xs text-dc-muted">
              Unmapped columns (ignored): {parsed.unmappedHeaders.slice(0, 8).join(', ')}
              {parsed.unmappedHeaders.length > 8 ? '…' : ''}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-dc-muted">
          Grid layout. Sessions are read from room columns. No column mapping needed.
        </p>
      )}

      {profiles.length > 0 ? (
        <label className="flex flex-wrap items-center gap-2 text-sm text-dc-muted">
          Saved mapping
          <select
            className="rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-dc-text"
            defaultValue=""
            disabled={readOnly}
            onChange={(e) => {
              if (e.target.value) applyProfile(e.target.value)
            }}
          >
            <option value="">, load profile -</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.spreadsheetId ? ' (linked sheet)' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!isGrid ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-dc-muted">
            Save mapping as
            <input
              type="text"
              className="mt-1 block w-48 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm font-normal normal-case text-dc-text"
              placeholder="e.g. PAF program sheet"
              value={profileName}
              disabled={readOnly || profileBusy}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={readOnly || profileBusy || !profileName.trim()}
            className="rounded-lg border border-dc-accent-border px-3 py-1.5 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted disabled:opacity-50"
            onClick={() => void saveProfile()}
          >
            {profileBusy ? 'Saving…' : 'Save profile'}
          </button>
          {profileMessage ? <span className="text-xs text-dc-muted">{profileMessage}</span> : null}
        </div>
      ) : null}

      {invalidRows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-amber-400/35 bg-amber-50/50">
          <p className="border-b border-amber-400/25 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
            Rows needing fixes ({invalidRows.length})
          </p>
          <table className="min-w-full text-left text-xs text-dc-text">
            <thead className="border-b border-amber-400/25 bg-amber-100/50 text-[10px] uppercase text-amber-900/80">
              <tr>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Preview</th>
                <th className="px-2 py-1.5">Issues</th>
              </tr>
            </thead>
            <tbody>
              {invalidRows.slice(0, 12).map((row, idx) => (
                <tr key={row.rowKey} className="border-b border-amber-400/15">
                  <td className="px-2 py-1.5 text-dc-muted">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    {kind === 'staff'
                      ? `${row.personName ?? '-'} · ${row.role ?? 'duty'}`
                      : row.title ?? '-'}
                    {row.startsAt ? (
                      <span className="ml-1 text-dc-muted">
                        · {new Date(row.startsAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    ) : (
                      <span className="ml-1 text-dc-warning"> · unscheduled</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-dc-danger">{row.validationErrors.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {invalidRows.length > 12 ? (
            <p className="px-2 py-1 text-[10px] text-dc-muted">Showing 12 of {invalidRows.length} exceptions</p>
          ) : null}
        </div>
      ) : parsed.rows.length > 0 ? (
        <p className="text-sm text-dc-success">All parsed rows look valid for import.</p>
      ) : (
        <p className="text-sm text-dc-warning">No rows parsed. Check header row and column mapping.</p>
      )}
    </div>
  )
}

export function parsedRowsToApiPayload(parsed: SpreadsheetParseResult, kind: ImportKind) {
  return parsed.rows.map((r) => ({
    rowKey: r.rowKey,
    title: r.title,
    personName: r.personName,
    role: r.role,
    track: r.track,
    room: r.room,
    locationId: r.locationId,
    description: r.description,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    importKey: r.importKey,
    presenterUsernames: r.presenterUsernames,
    linkUrl: r.linkUrl,
    validationErrors: r.validationErrors,
    kind,
    raw: r.raw,
  }))
}
