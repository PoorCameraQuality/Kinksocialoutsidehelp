#!/usr/bin/env node
/**
 * LEGAL-ALPHA-1 DMCA workflow verification.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const required = [
  'packages/api/src/routes/legal-alpha-routes.ts',
  'packages/api/src/db/schema.ts',
  'packages/web/src/app/dmca/page.tsx',
  'packages/web/src/app/moderation/dmca/page.tsx',
]

for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error(`Missing: ${rel}`)
    process.exit(1)
  }
}

const runDb = process.env.USE_DATABASE === 'true'
const steps = [
  {
    name: 'dmca-policy-page-build-check',
    cmd: 'node -e "const fs=require(\'fs\'); const p=\'packages/web/src/app/dmca/page.tsx\'; const t=fs.readFileSync(p,\'utf8\'); if(!t.includes(\'repeat infringer\')) process.exit(1); if(!/10.*14.*business days/i.test(t)) process.exit(1); if(/restore.*7\\s*day/i.test(t)) process.exit(1)"',
  },
]

if (runDb) {
  steps.push({
    name: 'legal-alpha-dmca-db',
    cmd: 'node --import tsx/esm --test --test-force-exit packages/api/src/test/legal-alpha.test.ts',
  })
}

let failed = false
for (const step of steps) {
  console.log(`\n▶ ${step.name}\n`)
  const r = spawnSync(step.cmd, { shell: true, stdio: 'inherit', cwd: root, env: process.env })
  if (r.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
