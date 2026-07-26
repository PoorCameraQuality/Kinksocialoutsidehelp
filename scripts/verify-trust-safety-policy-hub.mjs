#!/usr/bin/env node
/**
 * LEGAL-ALPHA-1.5 Policy Hub verification — registry, pages, router aliases.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredPages = [
  'packages/web/src/app/policies/page.tsx',
  'packages/web/src/app/policies/moderator-code-of-conduct/page.tsx',
  'packages/web/src/app/policies/appeals/page.tsx',
  'packages/web/src/app/policies/groups/page.tsx',
  'packages/web/src/app/policies/events/page.tsx',
  'packages/web/src/app/policies/adult-content-records/page.tsx',
  'packages/web/src/config/policy-registry.ts',
  'packages/web/src/components/ui/PolicyStandardPage.tsx',
  'docs/policies/POLICY-HUB-ARCHITECTURE.md',
]

for (const rel of requiredPages) {
  if (!existsSync(join(root, rel))) {
    console.error(`Missing: ${rel}`)
    process.exit(1)
  }
}

const routerPath = join(root, 'packages/web/src/router.tsx')
const router = readFileSync(routerPath, 'utf8')

const requiredRoutes = [
  "path: 'policies'",
  "path: 'policies/terms'",
  "path: 'policies/moderator-code-of-conduct'",
  "path: 'policies/appeals'",
  "path: 'policies/groups'",
  "path: 'policies/events'",
  "path: 'policies/adult-content-records'",
  "Navigate to=\"/terms\"",
  "Navigate to=\"/vendor-organizer-terms\"",
]

for (const snippet of requiredRoutes) {
  if (!router.includes(snippet)) {
    console.error(`Router missing: ${snippet}`)
    process.exit(1)
  }
}

const registry = readFileSync(join(root, 'packages/web/src/config/policy-registry.ts'), 'utf8')
if (!registry.includes('POLICY_REGISTRY') || !registry.includes('moderator-code-of-conduct')) {
  console.error('policy-registry.ts incomplete')
  process.exit(1)
}

const dmca = readFileSync(join(root, 'packages/web/src/app/dmca/page.tsx'), 'utf8')
for (const phrase of ['repeat infringer', 'Designated agent', 'DmcaIntakeForm']) {
  if (!dmca.includes(phrase)) {
    console.error(`DMCA page missing: ${phrase}`)
    process.exit(1)
  }
}

const standard = readFileSync(join(root, 'packages/web/src/components/ui/PolicyStandardPage.tsx'), 'utf8')
for (const section of ['What this means', 'Escalation path', 'Last updated']) {
  if (!standard.includes(section)) {
    console.error(`PolicyStandardPage missing section title: ${section}`)
    process.exit(1)
  }
}

console.log('Policy Hub verification passed.')
process.exit(0)
