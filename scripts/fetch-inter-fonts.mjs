#!/usr/bin/env node
/**
 * Download Inter woff2 files into packages/web/public/assets/fonts/
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const outDir = join(process.cwd(), 'packages/web/public/assets/fonts')
const weights = [
  ['Inter-Light.woff2', 'Inter-Light.woff2'],
  ['Inter-Regular.woff2', 'Inter-Regular.woff2'],
  ['Inter-Medium.woff2', 'Inter-Medium.woff2'],
  ['Inter-SemiBold.woff2', 'Inter-SemiBold.woff2'],
  ['Inter-Bold.woff2', 'Inter-Bold.woff2'],
  ['Inter-ExtraBold.woff2', 'Inter-ExtraBold.woff2'],
]

await mkdir(outDir, { recursive: true })

for (const [dest, src] of weights) {
  const url = `https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/${src}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(join(outDir, dest), buf)
  console.log('wrote', dest)
}

console.log('Inter fonts ready in', outDir)
