import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const doorPanelPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../web/src/components/dancecard/organizer/door/DoorModePanel.tsx',
)

test('door mode panel does not call missing bulk-check-in endpoint', () => {
  const src = readFileSync(doorPanelPath, 'utf8')
  assert.equal(src.includes('bulk-check-in'), false)
})
