'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { organizerConventionApiBase, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import {
  DEFAULT_GOOGLE_SHEET_RANGE,
  parseGoogleSpreadsheetId,
} from '@/lib/dancecard/parseGoogleSpreadsheetId'

type ImportKind = 'program' | 'staff'

type SheetConnection = {
  connected: boolean
  oauthConfigured?: boolean
  publicPullAvailable?: boolean
  spreadsheetId: string | null
  sheetTitle: string | null
  range: string
  updatedAt: string | null
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function GoogleSheetsImportSection({
  eventSlug,
  kind: _kind,
  readOnly,
  canConfigureGoogle,
  onRowsFetched,
  onClearFileUpload,
  onMessage,
  onError,
}: {
  eventSlug: string
  kind: ImportKind
  readOnly: boolean
  canConfigureGoogle: boolean
  onRowsFetched: (payload: {
    rawRows: string[][]
    spreadsheetId: string
    sheetName: string | null
    range: string
  }) => void
  onClearFileUpload?: () => void
  onMessage: (message: string | null) => void
  onError: (message: string | null) => void
}) {
  const integrationsHref = useOrganizerTabHref('integrations')
  const [connection, setConnection] = useState<SheetConnection | null>(null)
  const [sheetInput, setSheetInput] = useState('')
  const [range, setRange] = useState(DEFAULT_GOOGLE_SHEET_RANGE)
  const [preview, setPreview] = useState<{ preview: string[][]; rowCount: number; range: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [connectionLoaded, setConnectionLoaded] = useState(false)

  const parsedId = parseGoogleSpreadsheetId(sheetInput) ?? connection?.spreadsheetId ?? null

  const loadConnection = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<SheetConnection>(eventSlug, '/google-sheets/connection')
      setConnection(res)
      setRange(res.range || DEFAULT_GOOGLE_SHEET_RANGE)
      if (res.spreadsheetId) {
        setSheetInput(res.spreadsheetId)
      }
    } catch {
      setConnection(null)
    } finally {
      setConnectionLoaded(true)
    }
  }, [eventSlug])

  useEffect(() => {
    void loadConnection()
  }, [loadConnection])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const google = params.get('google')
    if (google === 'connected' && params.get('tab') === 'import') {
      onMessage('Google account connected. You can now pull private spreadsheets.')
      void loadConnection()
    } else if (google === 'error' && params.get('tab') === 'import') {
      onError('Google sign-in failed. Link-viewable sheets still work without connecting. Paste the URL below.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after OAuth redirect
  }, [])

  async function saveSpreadsheet() {
    const id = parseGoogleSpreadsheetId(sheetInput)
    if (!id) {
      onError('Paste a valid Google Sheets URL or spreadsheet ID.')
      return
    }
    setBusy(true)
    onError(null)
    try {
      await organizerDancecardFetch(eventSlug, '/google-sheets/connection', {
        method: 'PATCH',
        body: JSON.stringify({ spreadsheetId: id, range: range.trim() || DEFAULT_GOOGLE_SHEET_RANGE }),
      })
      await loadConnection()
      onMessage('Spreadsheet saved for this event.')
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save spreadsheet')
    } finally {
      setBusy(false)
    }
  }

  async function runPreview() {
    const id = parsedId
    if (!id) {
      onError('Save a spreadsheet link or ID first.')
      return
    }
    setBusy(true)
    onError(null)
    setPreview(null)
    try {
      const res = await organizerDancecardFetch<{
        preview: string[][]
        rowCount: number
        range: string
      }>(eventSlug, '/google-sheets/preview', {
        method: 'POST',
        body: JSON.stringify({
          spreadsheetId: id,
          range: range.trim() || DEFAULT_GOOGLE_SHEET_RANGE,
        }),
      })
      setPreview(res)
      setShowPreview(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function loadFromSheet() {
    const id = parsedId
    if (!id) {
      onError('Save a spreadsheet link or ID first.')
      return
    }
    setBusy(true)
    onError(null)
    onMessage(null)
    try {
      const res = await organizerDancecardFetch<{
        rows: string[][]
        rowCount: number
        range: string
        sheetName: string | null
        spreadsheetId: string
      }>(eventSlug, '/google-sheets/fetch-rows', {
        method: 'POST',
        body: JSON.stringify({
          spreadsheetId: id,
          range: range.trim() || DEFAULT_GOOGLE_SHEET_RANGE,
        }),
      })
      onClearFileUpload?.()
      onRowsFetched({
        rawRows: res.rows,
        spreadsheetId: res.spreadsheetId,
        sheetName: res.sheetName,
        range: res.range,
      })
      onMessage(
        `Fetched ${res.rowCount} rows from Google Sheets. Map columns below, then create your draft.`,
      )
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load from Google Sheets')
    } finally {
      setBusy(false)
    }
  }

  if (!canConfigureGoogle) {
    return (
      <div className="rounded-2xl border border-dashed border-dc-border bg-dc-elevated-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dc-muted">Google Sheets</p>
        <p className="mt-2 text-sm text-dc-muted">
          Connecting Google Sheets requires event owner or admin access. You can still upload a CSV or XLSX export
          below, or ask an owner to connect the live sheet on this tab.
        </p>
      </div>
    )
  }

  if (!connectionLoaded) {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dc-muted">Google Sheets</p>
        <p className="mt-2 text-sm text-dc-muted">Loading…</p>
      </div>
    )
  }

  const connectHref = `${organizerConventionApiBase(eventSlug)}/google-sheets/oauth/start?returnTo=import`
  const oauthAvailable = connection?.oauthConfigured
  const googleLinked = connection?.connected

  return (
    <div className="rounded-2xl border border-dc-accent-border/35 bg-dc-accent-muted p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dc-accent">Or pull from Google Sheets</p>
          <p className="mt-1 text-sm text-dc-muted">
            Paste a spreadsheet link below. Works when the sheet is shared as{' '}
            <strong className="text-dc-text">Anyone with the link can view</strong>. For private sheets, connect Google
            (when available). Custom column layouts may still work better via CSV/XLSX upload and column mapping.
          </p>
        </div>
        <span
          className={cx(
            'shrink-0 rounded-full border px-2.5 py-1 text-dc-micro font-semibold uppercase tracking-wide',
            googleLinked
              ? 'border-dc-success/35 bg-dc-success-muted text-dc-success'
              : 'border-dc-border text-dc-muted',
          )}
        >
          {googleLinked ? 'Google linked' : 'Link or connect'}
        </span>
      </div>

      {oauthAvailable && !googleLinked ? (
        <a
          href={connectHref}
          className="mt-4 inline-flex rounded-lg border border-dc-border bg-dc-surface-muted px-4 py-2 text-sm font-semibold text-dc-text hover:bg-white/5"
        >
          Connect Google account (private sheets)
        </a>
      ) : null}

      <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-dc-muted">
            Spreadsheet URL or ID
            <input
              type="text"
              disabled={readOnly || busy}
              className="mt-2 block w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
            />
            {sheetInput.trim() && !parsedId ? (
              <span className="mt-1 block text-xs font-normal normal-case text-red-700">
                Could not read a spreadsheet ID from that value.
              </span>
            ) : null}
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-dc-muted">
            Cell range (A1 notation)
            <input
              type="text"
              disabled={readOnly || busy}
              className="mt-2 block w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 font-mono text-sm text-dc-text"
              placeholder={DEFAULT_GOOGLE_SHEET_RANGE}
              value={range}
              onChange={(e) => setRange(e.target.value)}
            />
            <span className="mt-2 block text-xs font-normal normal-case leading-relaxed text-dc-muted">
              Use the tab name from your workbook, e.g. <strong className="text-dc-text">Grid!A1:Z500</strong>. Row 1
              should be column headers for <strong className="text-dc-text">program</strong> imports. Complex staff
              volunteer grids may still need an XLSX export until multi-tab sheet import ships.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={readOnly || busy || !parsedId}
              className="rounded-lg border border-dc-border px-3 py-2 text-sm font-semibold text-dc-text hover:bg-white/5 disabled:opacity-50"
              onClick={() => void saveSpreadsheet()}
            >
              Save spreadsheet
            </button>
            <button
              type="button"
              disabled={readOnly || busy || !parsedId}
              className="rounded-lg border border-dc-accent-border/50 px-3 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent/10 disabled:opacity-50"
              onClick={() => void runPreview()}
            >
              Preview cells
            </button>
            <button
              type="button"
              disabled={readOnly || busy || !parsedId}
              className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
              onClick={() => void loadFromSheet()}
            >
              {busy ? 'Fetching…' : 'Fetch rows for mapping'}
            </button>
          </div>
          {showPreview && preview?.preview ? (
            <pre className="max-h-48 overflow-auto rounded-lg border border-dc-border bg-dc-surface-muted p-2 text-[10px] text-dc-muted">
              {JSON.stringify(preview.preview, null, 2)}
              {preview.rowCount > preview.preview.length ? (
                <span className="mt-2 block text-dc-muted">
                  Showing first {preview.preview.length} of {preview.rowCount} rows ({preview.range}).
                </span>
              ) : null}
            </pre>
          ) : null}
      </div>

      <p className="mt-3 text-xs text-dc-muted">
        API keys and registrant webhooks stay on{' '}
        <Link
          href={integrationsHref}
          className="font-semibold text-dc-accent underline underline-offset-2 hover:text-dc-accent-hover"
        >
          Integrations
        </Link>
        .
      </p>
    </div>
  )
}
