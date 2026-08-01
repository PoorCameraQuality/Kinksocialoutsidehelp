#!/usr/bin/env node
/**
 * Production migrations: tolerate drizzle-kit push Zod failures; always run incremental scripts.
 */
import { spawnSync } from 'node:child_process'

function run(cmd, args, { allowFail = false } = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0 && !allowFail) {
    process.exit(r.status ?? 1)
  }
  return r.status ?? 0
}

run('node', ['scripts/verify-migrate-env.mjs'])
run('npm', ['run', 'build', '-w', '@c2k/api'])

const pushCode = run('npm', ['run', 'db:push', '-w', '@c2k/api'], { allowFail: true })
if (pushCode !== 0) {
  console.warn('WARN: drizzle-kit push failed (known expression-index Zod issue); continuing incremental migrations.')
}

run('npm', ['run', 'db:migrate-hub-ext', '-w', '@c2k/api'])
run('npm', ['run', 'db:migrate-incremental', '-w', '@c2k/api'])
run('npm', ['run', 'db:migrate-organizer-parity', '-w', '@c2k/api'])
console.log('Production migrations complete.')
