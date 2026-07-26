import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('src')
const entryDirs = ['components/dancecard', 'components/organizer/convention']
const importRe = /from ['"]@\/lib\/dancecard\/([^'"]+)['"]/g

function resolveMod(mod) {
  const base = path.join(root, 'lib/dancecard', mod)
  for (const ext of ['.ts', '.tsx', '/index.ts']) {
    const fp = ext.startsWith('/') ? base + ext : base + ext
    if (fs.existsSync(fp)) return fp
  }
  return null
}

const queue = new Set()
for (const dir of entryDirs) {
  const walk = (rel) => {
    for (const ent of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const p = path.join(rel, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
        const txt = fs.readFileSync(path.join(root, p), 'utf8')
        let m
        while ((m = importRe.exec(txt))) queue.add(m[1].replace(/\.js$/, ''))
      }
    }
  }
  walk(dir)
}

const seen = new Set()
const all = new Set()
while (queue.size) {
  const mod = queue.values().next().value
  queue.delete(mod)
  if (seen.has(mod)) continue
  seen.add(mod)
  all.add(mod)
  const file = resolveMod(mod)
  if (!file) continue
  const txt = fs.readFileSync(file, 'utf8')
  let m
  while ((m = importRe.exec(txt))) queue.add(m[1].replace(/\.js$/, ''))
}

console.log([...all].sort().join('\n'))

const libRoot = path.join(root, 'lib/dancecard')
const allFiles = []
const walkLib = (rel) => {
  for (const ent of fs.readdirSync(path.join(libRoot, rel), { withFileTypes: true })) {
    const p = path.join(rel, ent.name)
    if (ent.isDirectory()) walkLib(p)
    else if (/\.(tsx?)$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      allFiles.push(p.replace(/\\/g, '/').replace(/\.tsx?$/, ''))
    }
  }
}
walkLib('.')
const unused = allFiles.filter((f) => !all.has(f))
fs.writeFileSync('scripts/unused-dancecard-libs.txt', unused.sort().join('\n'))
console.log('used', all.size, 'unused', unused.length)
