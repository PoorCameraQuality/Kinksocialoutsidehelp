const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim())
}

/** Tab name from A1 range, e.g. `Grid!A1:Z500` → `Grid`. */
export function sheetNameFromRange(range: string): string {
  const bang = range.indexOf('!')
  if (bang <= 0) return range.trim() || 'Sheet1'
  return range.slice(0, bang).replace(/^'|'$/g, '').trim() || 'Sheet1'
}

export function googleOAuthRedirectUri(conventionKey: string): string {
  const site = process.env.VITE_SITE_URL ?? 'http://127.0.0.1:5173'
  return `${site}/api/v1/conventions/${encodeURIComponent(conventionKey)}/google-sheets/oauth/callback`
}

export function googleOAuthStartUrl(conventionKey: string, returnTo: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!.trim()
  const redirectUri = googleOAuthRedirectUri(conventionKey)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SHEETS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: returnTo,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGoogleOAuthCode(
  code: string,
  conventionKey: string,
): Promise<{ refreshToken: string; accessToken: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim()
  const redirectUri = googleOAuthRedirectUri(conventionKey)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = (await res.json()) as {
    refresh_token?: string
    access_token?: string
    error?: string
    error_description?: string
  }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Google token exchange failed')
  }
  if (!data.refresh_token) {
    throw new Error('Google did not return a refresh token. Revoke app access in Google Account settings and try again.')
  }
  return { refreshToken: data.refresh_token, accessToken: data.access_token }
}

export async function googleSheetsAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Could not refresh Google access token')
  }
  return data.access_token
}

export async function fetchGoogleSheetValues(
  refreshToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const accessToken = await googleSheetsAccessToken(refreshToken)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json()) as { values?: string[][]; error?: { message?: string } }
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Google Sheets API request failed')
  }
  return data.values ?? []
}

const PRIVATE_SHEET_HINT =
  'Could not read this spreadsheet. Share it as “Anyone with the link can view”, or connect your Google account for private sheets.'

/** Read a link-viewable sheet via Google’s public CSV export (no OAuth). */
export async function fetchGoogleSheetValuesPublic(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const sheet = sheetNameFromRange(range)
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`
  const res = await fetch(url, {
    headers: { Accept: 'text/csv,text/plain,*/*' },
  })
  const text = (await res.text()).replace(/^\uFEFF/, '')
  if (!res.ok || /<html[\s>]/i.test(text.slice(0, 200))) {
    throw new Error(PRIVATE_SHEET_HINT)
  }
  const { parseCsvRows } = await import('./csv-parse.js')
  const rows = parseCsvRows(text.trim())
  if (!rows.length) {
    throw new Error('Spreadsheet tab is empty or could not be read. Check the tab name in your range.')
  }
  return rows
}

/** OAuth when linked; otherwise public export for link-viewable sheets. */
export async function fetchGoogleSheetValuesResolved(
  refreshToken: string | null | undefined,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  if (refreshToken && googleOAuthConfigured()) {
    try {
      return await fetchGoogleSheetValues(refreshToken, spreadsheetId, range)
    } catch (oauthErr) {
      try {
        return await fetchGoogleSheetValuesPublic(spreadsheetId, range)
      } catch {
        throw oauthErr instanceof Error ? oauthErr : new Error(PRIVATE_SHEET_HINT)
      }
    }
  }
  return fetchGoogleSheetValuesPublic(spreadsheetId, range)
}
