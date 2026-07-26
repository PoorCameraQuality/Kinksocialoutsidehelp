#!/usr/bin/env node
/**
 * T&S-4B legal-profile hardening verification (scanner strictness + policy + playbooks).
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const requiredDocs = [
  'docs/privacy/LEGAL-RISK-PRINCIPLE.md',
  'docs/trust-safety/minor-safety-escalation.md',
  'docs/trust-safety/ncmec-manual-reporting-playbook.md',
  'docs/audits/trust-and-safety/T&S-IMPLEMENTATION.md',
]

for (const rel of requiredDocs) {
  const full = join(root, rel)
  if (!existsSync(full)) {
    console.error(`Missing required doc: ${rel}`)
    process.exit(1)
  }
}

const steps = [
  { name: 'scanner-config', cmd: 'node --import tsx/esm --test packages/shared/src/media-scanner-config.test.ts' },
  { name: 'scanner-unit', cmd: 'node --import tsx/esm --test packages/api/src/lib/media-scanner.test.ts' },
  { name: 'media-policy', cmd: 'node scripts/verify-trust-safety-media-policy.mjs' },
  {
    name: 'vendor-registry-guard',
    cmd: 'node --import tsx/esm -e "import { assertVendorRegistered } from \'./packages/api/src/lib/vendor-registry-guard.ts\'; assertVendorRegistered(\'resend_smtp_relay\'); try { assertVendorRegistered(\'fake_vendor_xyz\'); process.exit(1) } catch { /* expected */ }"',
  },
  {
    name: 'policy-pages',
    cmd: 'node -e "const fs=require(\'fs\'); for (const p of [\'adult-content-consent\',\'law-enforcement\',\'dmca\',\'ncii\',\'minor-safety\',\'vendor-organizer-terms\']) { if(!fs.existsSync(\'packages/web/src/app/\'+p+\'/page.tsx\')) process.exit(1) }"',
  },
  { name: 'policy-hub', cmd: 'node scripts/verify-trust-safety-policy-hub.mjs' },
]

let failed = false
for (const step of steps) {
  console.log(`\n▶ ${step.name}\n`)
  const r = spawnSync(step.cmd, { shell: true, stdio: 'inherit', env: process.env, cwd: root })
  if (r.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
