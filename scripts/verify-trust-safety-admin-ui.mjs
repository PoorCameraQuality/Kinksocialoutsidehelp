#!/usr/bin/env node
/**
 * T&S-3.5 admin console API verification — dashboard counts + restricted queue ACL.
 * Requires USE_DATABASE=true and prepared DB (db:prepare or db:seed).
 */
import { spawnSync } from 'node:child_process'

const env = { ...process.env, USE_DATABASE: 'true' }
const r = spawnSync(
  'node',
  ['--import', 'tsx/esm', '--test', '--test-force-exit', 'packages/api/src/test/moderation-ts-admin.test.ts'],
  { stdio: 'inherit', env, shell: process.platform === 'win32' }
)
process.exit(r.status ?? 1)
