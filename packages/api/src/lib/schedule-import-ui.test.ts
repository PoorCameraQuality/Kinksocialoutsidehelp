import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const importPanelPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../web/src/components/dancecard/organizer/ScheduleImportPanel.tsx',
)

test('import tab does not offer live staff kind toggle', () => {
  const src = readFileSync(importPanelPath, 'utf8')
  assert.equal(src.includes("setKind('staff')"), false)
  assert.equal(src.includes("['program', 'staff']"), false)
})
