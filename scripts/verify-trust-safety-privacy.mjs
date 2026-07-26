#!/usr/bin/env node
/**
 * LEGAL-ALPHA-1 user privacy export/delete foundation verification.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const required = [
  'packages/api/src/routes/legal-alpha-routes.ts',
  'packages/web/src/components/settings/SettingsPrivacyDataPanel.tsx',
  'packages/api/src/lib/legal-hold.ts',
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
    name: 'privacy-ui-panel',
    cmd: 'node -e "const fs=require(\'fs\'); const p=\'packages/web/src/components/settings/SettingsPrivacyDataPanel.tsx\'; const s=fs.readFileSync(p,\'utf8\'); if(!s.includes(\'legal hold\')) process.exit(1)"',
  },
]

if (runDb) {
  steps.push({
    name: 'legal-alpha-privacy-db',
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
