import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const conventionsRoutesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../routes/conventions-routes.ts',
)

test('conventions routes register calendar-feed GET handler', () => {
  const src = readFileSync(conventionsRoutesPath, 'utf8')
  assert.ok(src.includes("app.get('/api/v1/conventions/:key/calendar-feed/:token'"))
  assert.ok(src.includes('buildConventionCalendarFeedIcs'))
})
