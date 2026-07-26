/**
 * Remove Unicode em dashes (U+2014) from website source copy.
 * Replaces with periods, commas, colons, hyphens, or plain words per context.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const EM = '\u2014'

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

function transform(content) {
  if (!content.includes(EM)) return content

  let s = content

  // Placeholder / select options
  s = s.replaceAll(`${EM} select ${EM}`, 'Select one')
  s = s.replaceAll(`${EM} none ${EM}`, 'None')
  s = s.replaceAll(`${EM} not set ${EM}`, 'Not set')

  // Quoted empty-cell markers
  s = s.replaceAll(`'${EM}'`, "'-'")
  s = s.replaceAll(`"${EM}"`, '"-"')
  s = s.replaceAll(`\`${EM}\``, '`-`')

  // Label patterns: "Foo — Bar" in aria/titles → comma
  s = s.replaceAll(`${EM} `, ', ')

  // Remaining em dashes (prefix or tight joins)
  s = s.replaceAll(EM, '-')

  // Cleanup awkward punctuation from bulk replace
  s = s.replaceAll(', , ', ', ')
  s = s.replaceAll(': , ', ': ')
  s = s.replaceAll('? , ', '? ')
  s = s.replaceAll('! , ', '! ')
  s = s.replaceAll('. , ', '. ')
  s = s.replaceAll(', . ', '. ')

  return s
}

const files = TARGET_DIRS.flatMap((d) => walk(d))
let changed = 0

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8')
  if (!before.includes(EM)) continue
  const after = transform(before)
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8')
    changed++
  }
}

console.log(`Updated ${changed} files.`)
