#!/usr/bin/env node
/**
 * T&S-4B media policy mode verification slice.
 */
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const steps = [
  {
    name: 'media-policy-shared',
    cmd: 'node --import tsx/esm --test packages/shared/src/media-policy-config.test.ts packages/shared/src/content-policy.test.ts',
  },
  {
    name: 'media-policy-api',
    cmd: 'node --import tsx/esm --test packages/api/src/lib/media-policy.test.ts',
  },
]

if (process.env.USE_DATABASE === 'true') {
  steps.push({
    name: 'media-policy-db',
    cmd: 'node --import tsx/esm --test --test-force-exit packages/api/src/test/media-assets.test.ts',
  })
}

let failed = false
for (const step of steps) {
  console.log(`\n▶ ${step.name}\n`)
  const r = spawnSync(step.cmd, { shell: true, stdio: 'inherit', env: process.env, cwd: root })
  if (r.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
