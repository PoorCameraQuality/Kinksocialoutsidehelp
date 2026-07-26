#!/usr/bin/env node
/**
 * LEGAL-ALPHA-1 privileged admin step-up verification.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const authLib = join(root, 'packages/api/src/lib/legal-admin-auth.ts')
if (!existsSync(authLib)) {
  console.error('Missing legal-admin-auth.ts')
  process.exit(1)
}
const src = readFileSync(authLib, 'utf8')
if (!src.includes('requiresPrivilegedStepUp') || !src.includes('30')) {
  console.error('Step-up helper missing or wrong TTL')
  process.exit(1)
}

const runDb = process.env.USE_DATABASE === 'true'
const steps = [
  {
    name: 'step-up-route-present',
    cmd: 'node -e "const fs=require(\'fs\'); const p=\'packages/api/src/routes/legal-alpha-routes.ts\'; if(!fs.readFileSync(p,\'utf8\').includes(\'/api/v1/admin/security/step-up\')) process.exit(1)"',
  },
  {
    name: 'step-up-modal-ui',
    cmd: 'node -e "const fs=require(\'fs\'); if(!fs.existsSync(\'packages/web/src/components/moderation/AdminStepUpModal.tsx\')) process.exit(1)"',
  },
]

if (runDb) {
  steps.push({
    name: 'legal-alpha-step-up-db',
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
