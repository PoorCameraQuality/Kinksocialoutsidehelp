/**
 * Shared deploy tarball exclude flag for tar --exclude-from .deployignore
 * Usage: `tar -czf out.tgz ${deployTarExcludeFlag()} -C "${root}" .`
 */
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
export const deployIgnorePath = join(repoRoot, '.deployignore')

/** GNU/BSD tar --exclude-from path (quoted for shell). */
export function deployTarExcludeFlag() {
  if (!existsSync(deployIgnorePath)) return ''
  const p = deployIgnorePath.replace(/\\/g, '/')
  return `--exclude-from="${p}"`
}
