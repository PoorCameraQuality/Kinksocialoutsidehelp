import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../packages/web/src')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

for (const file of walk(root)) {
  let s = fs.readFileSync(file, 'utf8')
  const orig = s

  s = s.replace(/^'use client'\s*\n?/gm, '')
  s = s.replace(/import Link from 'next\/link'/g, "import { Link } from 'react-router-dom'")
  s = s.replace(/import Link from "next\/link"/g, 'import { Link } from "react-router-dom"')
  s = s.replace(/import Image from 'next\/image'/g, '')
  s = s.replace(/import Image from "next\/image"/g, '')

  s = s.replace(
    /import \{ useParams, usePathname, useRouter \} from 'next\/navigation'/g,
    "import { useParams, useLocation, useNavigate } from 'react-router-dom'"
  )
  s = s.replace(
    /import \{ usePathname, useRouter, useSearchParams \} from 'next\/navigation'/g,
    "import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'"
  )
  s = s.replace(
    /import \{ usePathname, useRouter \} from 'next\/navigation'/g,
    "import { useLocation, useNavigate } from 'react-router-dom'"
  )
  s = s.replace(/import \{ useRouter \} from 'next\/navigation'/g, "import { useNavigate } from 'react-router-dom'")
  s = s.replace(/import \{ useParams \} from 'next\/navigation'/g, "import { useParams } from 'react-router-dom'")
  s = s.replace(/import \{ usePathname \} from 'next\/navigation'/g, "import { useLocation } from 'react-router-dom'")
  s = s.replace(/import \{ useSearchParams \} from 'next\/navigation'/g, "import { useSearchParams } from 'react-router-dom'")
  s = s.replace(/import \{ notFound \} from 'next\/navigation'\s*\n?/g, '')
  s = s.replace(/import \{ redirect \} from 'next\/navigation'\s*\n?/g, '')
  s = s.replace(/import type \{ Metadata \} from 'next'\s*\n?/g, '')
  s = s.replace(/import type \{ Metadata \} from "next"\s*\n?/g, '')

  s = s.replace(/<Link href=/g, '<Link to=')
  s = s.replace(/\brouter\.push\(/g, 'navigate(')
  s = s.replace(/\brouter\.replace\(/g, 'navigate(')
  s = s.replace(/const router = useRouter\(\)/g, 'const navigate = useNavigate()')

  if (s !== orig) {
    fs.writeFileSync(file, s)
    console.log('updated', path.relative(root, file))
  }
}

console.log('done')
