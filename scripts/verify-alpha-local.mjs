#!/usr/bin/env node
/** Alpha verification — local: use verify:alpha:auto:local; CI: verify:alpha:auto with stack up. */
import { spawnSync } from 'node:child_process'

const r = spawnSync('node scripts/verify-alpha-auto-local.mjs', {
  shell: true,
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
})

process.exit(r.status ?? 1)
