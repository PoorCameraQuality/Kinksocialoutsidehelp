#!/usr/bin/env node
/**
 * Design system static audit — tokens, hardcoded values, stale configs.
 * Output: docs/audits/ui/generated/design-system-audit.json, docs/UI_DESIGN_SYSTEM_AUDIT.md
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT,
  WEB_SRC,
  OUT_DIR,
  DOCS_DIR,
  readText,
  writeJson,
  walk,
  mdEscape,
} from './audit-ui-shared.mjs'

const TOKEN_FILES = [
  'packages/web/src/app/globals.css',
  'packages/web/src/styles/dancecard-tokens.css',
  'packages/web/src/styles/dancecard-parity.css',
  'packages/web/src/styles/dancecard-motion.css',
  'packages/web/src/styles/site-atmosphere.css',
  'packages/web/src/components/landing/public-auth.css',
  'packages/web/src/lib/dancecard/appearancePresets.ts',
  'packages/web/src/lib/dancecard/appearanceThemeBuilder.ts',
  'packages/web/tailwind.config.js',
  'packages/web/index.html',
]

const STALE_FILES = [
  { path: 'tailwind.config.js', note: 'Root config references non-existent src/pages; not used by web package' },
  { path: 'packages/web/src/globals.css', note: 'Older duplicate; main.tsx imports app/globals.css instead' },
]

function scanDirectory(dir, patterns) {
  const hits = { hex: [], rgba: [], px: [], whiteOpacity: [], blackOpacity: [], dcClasses: [], c2kClasses: [], darkVariant: [] }
  const files = walk(dir, [], (p) => /\.(tsx|ts|css)$/.test(p) && !p.includes('node_modules'))

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    const content = readText(file)

    for (const m of content.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      if (!rel.includes('appearancePresets') && !rel.includes('appearanceThemeBuilder') && !rel.includes('globals.css')) {
        hits.hex.push({ file: rel, value: m[0] })
      }
    }
    for (const m of content.matchAll(/rgba?\([^)]+\)/g)) {
      if (!rel.includes('appearance') && !rel.includes('globals.css') && !rel.includes('public-auth.css')) {
        hits.rgba.push({ file: rel, value: m[0].slice(0, 40) })
      }
    }
    for (const m of content.matchAll(/(?:className|class)=["'][^"']*\b(\d+)px/g)) {
      hits.px.push({ file: rel, value: m[1] + 'px' })
    }
    if (/white\/\[\d/.test(content) || /bg-white\//.test(content) || /border-white\//.test(content)) {
      hits.whiteOpacity.push({ file: rel })
    }
    if (/bg-black\//.test(content)) hits.blackOpacity.push({ file: rel })
    if (/\bdark:/.test(content)) hits.darkVariant.push({ file: rel })
  }

  // tailwind class usage counts
  const webSrc = walk(path.join(WEB_SRC), [], (p) => p.endsWith('.tsx'))
  let dcCount = 0
  let c2kTwCount = 0
  for (const f of webSrc) {
    const c = readText(f)
    dcCount += (c.match(/\b(?:bg|text|border)-dc-/g) ?? []).length
    c2kTwCount += (c.match(/\b(?:bg|text|border)-c2k-/g) ?? []).length
  }
  hits.dcClasses = dcCount
  hits.c2kClasses = c2kTwCount

  return hits
}

function extractCssVars(file) {
  const content = readText(path.join(ROOT, file))
  const families = { dc: [], c2k: [], pub: [], organizer: [], ecke: [] }
  for (const m of content.matchAll(/--(dc|c2k|pub|organizer|ecke)-[\w-]+/g)) {
    const full = m[0]
    const fam = m[1]
    if (!families[fam].includes(full)) families[fam].push(full)
  }
  return families
}

function extractPresets() {
  const file = path.join(WEB_SRC, 'lib/dancecard/appearancePresets.ts')
  const content = readText(file)
  const presets = []
  for (const m of content.matchAll(/id:\s*['"]([^'"]+)['"][\s\S]*?mode:\s*['"](light|dark)['"]/g)) {
    presets.push({ id: m[1], mode: m[2] })
  }
  return presets
}

function checkTailwindExtensions() {
  const config = readText(path.join(ROOT, 'packages/web/tailwind.config.js'))
  const unused = []
  const extensions = ['c2k-1', 'c2k-2', 'c2k-3', 'c2k-4', 'c2k-5', 'c2k-6', 'rounded-c2k-card', 'shadow-c2k-soft']
  const src = walk(WEB_SRC, [], (p) => p.endsWith('.tsx')).map((f) => readText(f)).join('\n')
  for (const ext of extensions) {
    if (!src.includes(ext)) unused.push(ext)
  }
  const hasDarkMode = /darkMode/.test(config)
  return { unused, hasDarkMode }
}

function aggregateTopFiles(hits, limit = 15) {
  const counts = new Map()
  for (const h of hits) {
    counts.set(h.file, (counts.get(h.file) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

function buildMarkdown(data, generatedAt) {
  const { tokenFamilies, presets, scan, tailwind, staleFiles } = data
  const lines = [
    '# UI Design System Audit — kink.social',
    '',
    `Generated: ${generatedAt.slice(0, 10)} via \`npm run audit:ui-architecture\``,
    '',
    '**Binding docs:** [`docs/C2K-DESIGN-SYSTEM.md`](C2K-DESIGN-SYSTEM.md), [`docs/design/08-DESIGN_TOKENS.md`](design/08-DESIGN_TOKENS.md).',
    '',
    '## Token architecture',
    '',
    '| Family | Purpose | Var count (sampled) | Primary files |',
    '|--------|---------|---------------------|---------------|',
    `| \`--dc-*\` | Member/community UI (primary) | ${tokenFamilies.dc.length} | appearancePresets.ts, globals.css |`,
    `| \`--c2k-*\` | Legacy teal theme fallbacks | ${tokenFamilies.c2k.length} | globals.css :root |`,
    `| \`--pub-*\` | Landing/auth marketing palette | ${tokenFamilies.pub.length} | public-auth.css |`,
    `| \`--organizer-*\` | Organizer console chrome | ${tokenFamilies.organizer.length} | globals.css |`,
    `| \`--ecke-*\` | ECKE link/focus bridge | ${tokenFamilies.ecke.length} | dancecard-parity.css |`,
    '',
    '## Theme presets',
    '',
    'Theming is **preset-based** (not Tailwind `darkMode`). `DancecardAppearanceProvider` sets inline `--dc-*` on `<html>`.',
    '',
    '| Preset ID | Mode |',
    '|-----------|------|',
    ...presets.map((p) => `| ${p.id} | ${p.mode} |`),
    '',
    '## Typography',
    '',
    '| Layer | Fonts | Source |',
    '|-------|-------|--------|',
    '| **Live app** | Manrope (UI), Sora (display) | packages/web/index.html, lib/fonts.ts |',
    '| **Stale references** | Inter | root tailwind.config.js, packages/web/src/globals.css, design doc §5 |',
    '',
    '## Tailwind usage',
    '',
    `- **\`dc-*\` utility usages (approx):** ${scan.dcClasses}`,
    `- **\`c2k-*\` utility usages (approx):** ${scan.c2kClasses}`,
    `- **Tailwind darkMode configured:** ${tailwind.hasDarkMode ? 'yes' : 'no'}`,
    `- **Stray \`dark:\` classes in TSX:** ${scan.darkVariant.length} files`,
    '',
    '### Unused Tailwind extensions (defined but zero TSX usage)',
    '',
    tailwind.unused.length ? tailwind.unused.map((u) => `- \`${u}\``).join('\n') : '_None detected_',
    '',
    '## Hardcoded color hotspots (top files)',
    '',
    '### Raw hex in components (excluding token definition files)',
    '',
    ...aggregateTopFiles(scan.hex).map(([f, n]) => `- \`${f}\`: ${n} hits`),
    '',
    '### `white/` opacity overlays (glass idiom — off-token)',
    '',
    ...aggregateTopFiles(scan.whiteOpacity).slice(0, 10).map(([f]) => `- \`${f}\``),
    '',
    '### `bg-black/` scrims',
    '',
    ...aggregateTopFiles(scan.blackOpacity).slice(0, 10).map(([f]) => `- \`${f}\``),
    '',
    '## Spacing, radius, shadow',
    '',
    '| Token | Value | Tailwind bridge | TSX usage |',
    '|-------|-------|-----------------|-----------|',
    '| `--c2k-space-1…6` | 4–24px | `c2k-1…c2k-6` | **unused** — components use default Tailwind scale |',
    '| `--c2k-card-radius` | 1rem | `rounded-c2k-card` | **unused** — `rounded-xl` / `rounded-2xl` dominate |',
    '| `--c2k-shadow-soft` | subtle | `shadow-c2k-soft` | **unused** |',
    '| `--dc-shadow-*` | panel/tab shadows | arbitrary `shadow-[var(--dc-shadow-soft)]` | primary pattern |',
    '',
    '## Layout chrome tokens',
    '',
    '- `--c2k-header-h`, `--c2k-bottom-nav-h`, `--c2k-bottom-nav-total-h` — mobile safe-area helpers in globals.css',
    '- Classes: `.safe-area-pb`, `.c2k-main-mobile-pb`, `.c2k-fixed-above-bottom-nav`',
    '',
    '## Stale / duplicate files',
    '',
    '| File | Issue |',
    '|------|-------|',
    ...staleFiles.map((s) => `| \`${s.path}\` | ${mdEscape(s.note)} |`),
    '',
    '## Normalization recommendations (audit-only, execution order)',
    '',
    '1. **Stop adding `--c2k-*`** — new UI uses `--dc-*` only (per C2K-DESIGN-SYSTEM.md).',
    '2. **Consolidate landing** — wire `--pub-*` marketing pages to appearance provider or document permanent split.',
    '3. **Replace `white/` and `black/` scrims** with semantic overlay tokens.',
    '4. **Remove or wire Tailwind `c2k-*` extensions** — currently dead config.',
    '5. **Unify dancecard + ui primitives** before template migration (Button, Panel, Confirm).',
    '6. **Update stale Inter references** in docs and delete unused globals.css duplicate.',
    '',
    '## Key source files',
    '',
    ...TOKEN_FILES.map((f) => `- [\`${f}\`](${f.replace(/ /g, '%20')})`),
    '',
  ]
  return lines.join('\n')
}

function main() {
  const tokenFamilies = { dc: [], c2k: [], pub: [], organizer: [], ecke: [] }
  for (const f of TOKEN_FILES) {
    if (!fs.existsSync(path.join(ROOT, f))) continue
    const fam = extractCssVars(f)
    for (const k of Object.keys(tokenFamilies)) {
      tokenFamilies[k] = [...new Set([...tokenFamilies[k], ...fam[k]])]
    }
  }

  const scan = scanDirectory(WEB_SRC)
  const presets = extractPresets()
  const tailwind = checkTailwindExtensions()
  const generatedAt = new Date().toISOString()

  const data = { generatedAt, tokenFamilies, presets, scan, tailwind, staleFiles: STALE_FILES }
  writeJson(path.join(OUT_DIR, 'design-system-audit.json'), data)
  fs.writeFileSync(path.join(DOCS_DIR, 'UI_DESIGN_SYSTEM_AUDIT.md'), buildMarkdown(data, generatedAt))

  console.log(`Design system audit → docs/UI_DESIGN_SYSTEM_AUDIT.md (${scan.dcClasses} dc-class refs)`)
}

main()
