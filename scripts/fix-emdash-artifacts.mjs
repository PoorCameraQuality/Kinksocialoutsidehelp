/**
 * Fix awkward " , " artifacts left after em-dash removal.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const TARGET_DIRS = [
  path.join(ROOT, 'packages/web/src'),
  path.join(ROOT, 'packages/shared/src'),
  path.join(ROOT, 'packages/api/src'),
  path.join(ROOT, 'e2e'),
]
const EXT = new Set(['.ts', '.tsx', '.css', '.md'])

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(full, out)
    } else if (EXT.has(path.extname(name))) {
      out.push(full)
    }
  }
  return out
}

function fixLine(line, isCss) {
  if (!line.includes(' , ')) return line
  if (isCss) return line.replaceAll(' , ', ' - ')

  const trimmed = line.trimStart()
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return line.replaceAll(' , ', ' - ')
  }

  let s = line
  s = s.replaceAll('Closed , ', 'Closed: ')
  s = s.replaceAll('Early , ', 'Early: ')
  s = s.replaceAll('Demo mode , ', 'Demo mode: ')
  s = s.replaceAll('Add signup , ', 'Add signup: ')
  // Sentence continuations: ", lowercase" -> ". Uppercase"
  s = s.replace(/ , ([a-z])/g, (_, c) => `. ${c.toUpperCase()}`)
  s = s.replaceAll(' , ', ' · ')
  return s
}

function transform(content, file) {
  if (!content.includes(' , ')) return content
  const isCss = file.endsWith('.css')
  return content
    .split('\n')
    .map((line) => fixLine(line, isCss))
    .join('\n')
}

const files = TARGET_DIRS.flatMap((d) => walk(d))
let changed = 0

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8')
  const after = transform(before, file)
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8')
    changed++
  }
}

console.log(`Fixed artifacts in ${changed} files.`)
