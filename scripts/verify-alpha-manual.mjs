#!/usr/bin/env node
/**
 * Manual-only alpha checklist pointer — subjective pilot acceptance.
 * Automated gates live in verify:alpha:auto.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const checklist = join(process.cwd(), 'docs', 'audits', 'ui', 'MANUAL_QA_CHECKLIST.md')

console.log('Alpha manual verification checklist (human-only)\n')
console.log('Automated gates: npm run verify:alpha:auto\n')

if (existsSync(checklist)) {
  const text = readFileSync(checklist, 'utf8')
  const lines = text.split('\n').slice(0, 40)
  console.log(lines.join('\n'))
  if (text.split('\n').length > 40) console.log('\n… (see full file)\n')
  console.log(`Full checklist: ${checklist}`)
} else {
  console.log(`Checklist not found at ${checklist}`)
  process.exit(1)
}

console.log('\nManual QA is for subjective pilot acceptance only — not a routine dev gate.')
