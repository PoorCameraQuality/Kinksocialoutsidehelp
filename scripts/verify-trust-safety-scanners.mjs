#!/usr/bin/env node
/**
 * T&S-4A scanner adapter verification slice.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const apiSrc = join(root, 'packages/api/src')
const runDbTests = process.env.USE_DATABASE === 'true'

function discover(needle) {
  const files = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name)
      if (name.isDirectory()) {
        if (name.name === 'node_modules' || name.name === 'dist') continue
        walk(full)
      } else if (name.name.includes(needle) && name.name.endsWith('.test.ts')) {
        files.push(full)
      }
    }
  }
  walk(apiSrc)
  walk(join(apiSrc, 'test'))
  return [...new Set(files)].sort()
}

const unit = discover('media-scanner')
if (!unit.length) {
  console.error('No media-scanner*.test.ts files found')
  process.exit(1)
}

const steps = [
  {
    name: 'scanner-unit',
    cmd: `node --import tsx/esm --test ${unit.map((f) => f.replace(/\\/g, '/')).join(' ')}`,
  },
]

if (runDbTests) {
  steps.push({
    name: 'scanner-db',
    cmd: 'node --import tsx/esm --test --test-force-exit packages/api/src/test/media-scanner-pipeline.test.ts',
  })
}

let failed = false
for (const step of steps) {
  console.log(`\n▶ ${step.name}\n`)
  const r = spawnSync(step.cmd, { shell: true, stdio: 'inherit', env: process.env })
  if (r.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
