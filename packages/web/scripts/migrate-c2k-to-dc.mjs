/**
 * One-off / repeatable: replace legacy Tailwind c2k-* classes with dc-* in web src.
 * Skips token definition files and mock data seeds.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../src')

const SKIP_FILES = new Set([
  'globals.css',
  'dancecard-parity.css',
  'mock-seeds.ts',
  'track-accent.ts',
])

const SKIP_DIRS = new Set(['node_modules', 'dist'])

const REPLACEMENTS = [
  ['hover:bg-c2k-accent-primary-hover', 'hover:bg-dc-accent-hover'],
  ['bg-c2k-accent-primary-hover', 'bg-dc-accent-hover'],
  ['hover:border-c2k-accent-primary/40', 'hover:border-dc-accent-border/40'],
  ['hover:border-c2k-accent-primary/30', 'hover:border-dc-accent-border/40'],
  ['hover:border-c2k-accent-primary/20', 'hover:border-dc-accent-border/30'],
  ['border-c2k-accent-primary/50', 'border-dc-accent-border/50'],
  ['border-c2k-accent-primary/40', 'border-dc-accent-border/40'],
  ['border-c2k-accent-primary/30', 'border-dc-accent-border/30'],
  ['border-c2k-accent-primary/20', 'border-dc-accent-border/30'],
  ['bg-c2k-accent-primary/30', 'bg-dc-accent/30'],
  ['bg-c2k-accent-primary/20', 'bg-dc-accent/20'],
  ['bg-c2k-accent-primary/15', 'bg-dc-accent/15'],
  ['bg-c2k-accent-primary/10', 'bg-dc-accent/10'],
  ['ring-c2k-accent-primary/30', 'ring-dc-accent/30'],
  ['ring-c2k-accent-primary', 'ring-dc-accent'],
  ['focus-visible:outline-c2k-accent-primary', 'focus-visible:outline-dc-accent'],
  ['focus-visible:ring-c2k-accent-primary', 'focus-visible:ring-dc-accent'],
  ['focus:ring-c2k-accent-primary', 'focus:ring-dc-accent'],
  ['focus:border-c2k-accent-primary', 'focus:border-dc-accent'],
  ['hover:text-c2k-accent-primary-hover', 'hover:text-dc-accent-hover'],
  ['text-c2k-accent-primary-hover', 'text-dc-accent-hover'],
  ['text-c2k-accent-primary', 'text-dc-accent'],
  ['bg-c2k-accent-primary', 'bg-dc-accent'],
  ['text-c2k-text-primary', 'text-dc-text'],
  ['text-c2k-text-secondary', 'text-dc-text-muted'],
  ['text-c2k-text-muted', 'text-dc-muted'],
  ['text-c2k-meta', 'text-dc-micro'],
  ['bg-c2k-bg-card/80', 'bg-dc-elevated/80'],
  ['bg-c2k-bg-card', 'bg-dc-elevated/95'],
  ['bg-c2k-bg-elevated', 'bg-dc-elevated-solid'],
  ['bg-c2k-bg', 'bg-dc-surface-muted'],
  ['border-c2k-border-strong', 'border-dc-border-strong'],
  ['border-c2k-border', 'border-dc-border'],
  ['border-c2k-danger', 'border-dc-danger-border'],
  ['text-c2k-danger', 'text-dc-danger'],
  ['bg-c2k-danger', 'bg-dc-danger'],
  ['text-c2k-success', 'text-dc-success'],
  ['bg-c2k-success', 'bg-dc-success'],
  ['shadow-c2k-soft', 'shadow-[var(--dc-shadow-soft)]'],
  ['border-white/[0.06]', 'border-dc-border-subtle'],
  ['border-white/20', 'border-dc-border-strong'],
  ['border-white/15', 'border-dc-border'],
  ['border-white/10', 'border-dc-border'],
  ['border-white/5', 'border-dc-border-subtle'],
  ['hover:bg-white/10', 'hover:bg-dc-elevated-muted'],
  ['hover:bg-white/5', 'hover:bg-dc-elevated-muted'],
  ['bg-white/10', 'bg-dc-elevated-muted'],
  ['bg-white/5', 'bg-dc-elevated-muted'],
  ['hover:text-white', 'hover:text-dc-text'],
  ['text-white', 'text-dc-text'],
  ['ring-offset-c2k-bg', 'ring-offset-dc-surface'],
  ['ring-c2k-focus-ring', 'ring-[var(--ecke-focus-ring)]'],
  ['outline-c2k-focus-ring', 'outline-dc-accent'],
  ['decoration-c2k-bg/40', 'decoration-dc-surface/40'],
  ['color: var(--c2k-accent-primary', 'color: var(--dc-accent'],
  ['var(--c2k-accent-primary', 'var(--dc-accent'],
  ['var(--c2k-bg', 'var(--dc-surface'],
  ['var(--c2k-text-primary', 'var(--dc-text'],
  ['var(--c2k-text-muted', 'var(--dc-muted'],
  ['accent-c2k-accent-primary', 'accent-dc-accent'],
  ['bg-dc-accent hover:bg-dc-accent-hover text-dc-text', 'bg-dc-accent hover:bg-dc-accent-hover text-dc-accent-foreground'],
  ['bg-dc-accent text-dc-text', 'bg-dc-accent text-dc-accent-foreground'],
  ["'bg-dc-accent text-dc-text'", "'bg-dc-accent text-dc-accent-foreground'"],
  ['? \'bg-dc-accent text-dc-text\'', '? \'bg-dc-accent text-dc-accent-foreground\''],
  ['placeholder-c2k-text-muted', 'placeholder-dc-muted'],
  ['border-b-2 border-c2k-accent-primary', 'border-b-2 border-dc-accent'],
  ['border-c2k-accent-primary', 'border-dc-accent'],
  ['from-c2k-bg-charcoal', 'from-dc-surface-muted'],
  ['to-c2k-bg-elevated', 'to-dc-elevated-solid'],
  ['via-c2k-bg-elevated', 'via-dc-elevated-solid'],
  ['border-c2k-bg-card', 'border-dc-border'],
  ['from-c2k-bg ', 'from-dc-surface '],
  ['from-c2k-accent-primary/10', 'from-dc-accent/10'],
  ['border-l-2 border-c2k-accent-primary/45', 'border-l-2 border-dc-accent/45'],
  ['border-c2k-accent-primary/35', 'border-dc-accent-border/35'],
  ['border-l-c2k-accent-primary', 'border-l-dc-accent'],
  ['border-l-c2k-success', 'border-l-dc-success'],
  ['border-c2k-success', 'border-dc-success'],
  ['text-c2k-bg', 'text-dc-accent-foreground'],
  ['text-c2k-accent-secondary', 'text-dc-accent-hover'],
  ['from-c2k-accent-primary', 'from-dc-accent'],
  ['to-c2k-bg', 'to-dc-surface'],
  ['via-c2k-bg', 'via-dc-surface'],
  ['from-c2k-bg/', 'from-dc-surface/'],
  ['ring-c2k-bg-card', 'ring-dc-border'],
  ['bg-c2k-bg-card', 'bg-dc-elevated-solid'],
  ['rounded-c2k-card', 'rounded-2xl'],
]

function walk(dir, changed) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      walk(p, changed)
      continue
    }
    if (!/\.(tsx?|css)$/.test(ent.name)) continue
    if (SKIP_FILES.has(ent.name)) continue
    let c = fs.readFileSync(p, 'utf8')
    if (!c.includes('c2k-') && !c.includes('border-white/')) continue
    const before = c
    for (const [from, to] of REPLACEMENTS) {
      c = c.split(from).join(to)
    }
    if (c !== before) {
      fs.writeFileSync(p, c)
      changed.push(p)
    }
  }
}

const changed = []
walk(ROOT, changed)
console.log(`Updated ${changed.length} files`)
for (const f of changed.slice(0, 30)) console.log(' ', path.relative(ROOT, f))
if (changed.length > 30) console.log(`  ... and ${changed.length - 30} more`)
