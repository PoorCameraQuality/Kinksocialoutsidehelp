#!/usr/bin/env node
/**
 * Alpha Hardening Pass 1 — media upload security verification.
 * Unit tests always; DB integration when USE_DATABASE=true and Postgres reachable.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiDir = path.join(root, 'packages', 'api')

function run(label, cmd, args, opts = {}) {
  console.log(`\n==> ${label}`)
  const useNpm = cmd === 'npm'
  const r = spawnSync(useNpm ? 'npm' : cmd, args, {
    cwd: opts.cwd ?? root,
    stdio: 'inherit',
    shell: useNpm,
    env: { ...process.env, ...opts.env },
  })
  if (r.status !== 0) {
    console.error(`\nFAILED: ${label}`)
    process.exit(r.status ?? 1)
  }
}

run('typecheck @c2k/api', 'npm', ['run', 'typecheck', '-w', '@c2k/api'])

run('media-pipeline unit tests', 'node', [
  '--import',
  'tsx/esm',
  '--test',
  'src/lib/media-pipeline.test.ts',
  'src/lib/image-delivery.test.ts',
], { cwd: apiDir })

if (process.env.VERIFY_ALPHA_HARDENING_DB === '1') {
  run('wait for Postgres', 'node', ['scripts/wait-for-postgres.mjs'], { cwd: root })
  run('media upload DB integration tests (hardening scope)', 'node', [
    '--import',
    'tsx/esm',
    '--test',
    '--test-force-exit',
    'src/test/profile-photos-upload.test.ts',
  ], { cwd: apiDir, env: { USE_DATABASE: 'true', MEDIA_PIPELINE_ALLOW_NO_S3: '1' } })
} else {
  console.log('\n==> Skipping DB integration tests (set VERIFY_ALPHA_HARDENING_DB=1 with Docker Postgres up)')
}

console.log('\n==> Alpha hardening media verification passed')
