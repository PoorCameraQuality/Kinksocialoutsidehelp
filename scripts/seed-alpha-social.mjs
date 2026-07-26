#!/usr/bin/env node
/**
 * Root entry for alpha social seed — delegates to @c2k/api runner.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const result = spawnSync('npm', ['run', 'db:seed:alpha:social', '-w', '@c2k/api'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(result.status ?? 1)
