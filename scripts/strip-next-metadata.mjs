import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../packages/web/src/app')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

const re = /export const metadata[^=]*=\s*\{[\s\S]*?\n\}\s*\n?/g

for (const file of walk(root)) {
  let s = fs.readFileSync(file, 'utf8')
  const orig = s
  s = s.replace(re, '')
  if (s !== orig) {
    fs.writeFileSync(file, s)
    console.log('stripped', path.relative(root, file))
  }
}

console.log('done')
