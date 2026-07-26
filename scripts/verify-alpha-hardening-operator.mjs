#!/usr/bin/env node
/**
 * Alpha Hardening Pass 1 — full operator orchestrator.
 *
 * Phase 1 (engineering): unit/typecheck media gate — always runs.
 * Phase 2 (legacy media): DB audit — only when VERIFY_ALPHA_HARDENING_DB=1.
 * Phase 3 (prod HTTP): mod/mail/health smoke — SMOKE_BASE (default https://kink.social).
 * Phase 4–6: manual checklists printed at end.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const node = process.execPath

function run(label, cmd, args, opts = {}) {
  console.log(`\n${'='.repeat(72)}\n▶ ${label}\n${'='.repeat(72)}\n`)
  const useNpm = cmd === 'npm'
  const r = spawnSync(useNpm ? 'npm' : cmd, args, {
    cwd: opts.cwd ?? root,
    stdio: 'inherit',
    shell: useNpm,
    env: { ...process.env, ...opts.env },
  })
  if (r.status !== 0) {
    console.error(`\n✗ FAILED: ${label}`)
    process.exit(r.status ?? 1)
  }
}

console.log('Alpha Hardening Pass 1 — operator orchestrator\n')

run('Phase 1 — media upload security (unit)', node, ['scripts/verify-alpha-hardening-media.mjs'], {
  env: { ...process.env, VERIFY_ALPHA_HARDENING_DB: '' },
})

if (process.env.VERIFY_ALPHA_HARDENING_DB === '1') {
  run('Phase 2 — legacy media audit (read-only)', npm, [
    'run',
    'audit:restricted-public-media',
    '-w',
    '@c2k/api',
  ], { env: { USE_DATABASE: 'true' } })
  console.log(
    '\nPhase 2 dry-run remediation (review JSON before APPLY=true):\n' +
      '  USE_DATABASE=true npm run remediate:restricted-public-media -w @c2k/api\n',
  )
} else {
  console.log(
    '\n▶ Phase 2 — legacy media (skipped)\n' +
      '  On VPS: bash scripts/vps/remote-audit-restricted-public-media.sh\n' +
      '  Local: VERIFY_ALPHA_HARDENING_DB=1 npm run verify:alpha-hardening-operator\n',
  )
}

const smokeBase = process.env.SMOKE_BASE ?? 'https://kink.social'
const braxEnv = {
  SMOKE_BASE: smokeBase,
  ...(process.env.BRAX_ADMIN_PASSWORD ? { BRAX_ADMIN_PASSWORD: process.env.BRAX_ADMIN_PASSWORD } : {}),
  ...(process.env.REQUIRE_BRAX_ADMIN_SMOKE ? { REQUIRE_BRAX_ADMIN_SMOKE: process.env.REQUIRE_BRAX_ADMIN_SMOKE } : {}),
}
run('Phase 3 — prod/staging HTTP smoke (mod + mail + upload guards)', node, [
  'scripts/smoke-alpha-hardening-prod.mjs',
], { env: braxEnv })

if (process.env.RUN_LEGAL_ALPHA_SMOKE === '1') {
  run('Phase 3b — LEGAL-ALPHA automated smoke', node, ['scripts/smoke-legal-alpha-manual.mjs'], {
    env: braxEnv,
  })
}

run('Phase 4 — privacy API smoke', node, ['scripts/smoke-alpha-hardening-privacy.mjs'], {
  env: { SMOKE_BASE: smokeBase },
})

run('Phase 5 — SMTP transport smoke (prod)', node, ['scripts/smoke-alpha-hardening-smtp-prod.mjs'], {
  env: { SMOKE_BASE: smokeBase },
})

run('Phase 6 — pilot infrastructure gate', node, ['scripts/smoke-alpha-hardening-pilot-gate.mjs'], {
  env: { SMOKE_BASE: smokeBase },
})

console.log(`
${'='.repeat(72)}
Manual gates (product / operator — still required)
${'='.repeat(72)}

Phase 4 — Privacy QA UI walkthrough
  docs/ALPHA_QA_JOURNEY.md sections 4–5 (mobile/desktop, persona UX)

Phase 5 — SMTP inbox sign-off
  docs/PROD_SMTP_K8S_CHECKLIST.md D.2–D.5 (deliverability, digests)

Phase 6 — PILOT-ORG
  docs/PILOT_READINESS.md § First real pilot org (external org owner walkthrough)

Optional (site-owner prod login):
  REQUIRE_BRAX_ADMIN_SMOKE=1 BRAX_ADMIN_PASSWORD=... npm run verify:alpha-hardening-prod
  REQUIRE_BRAX_ADMIN_SMOKE=1 RUN_LEGAL_ALPHA_SMOKE=1 npm run verify:alpha-hardening-operator

VPS legacy media (Phase 2 prod):
  SSH_PASS='...' APPLY=true node scripts/vps/run-alpha-hardening-media-remediation.mjs

${'='.repeat(72)}
✓ Automated alpha hardening gates passed
${'='.repeat(72)}
`)
