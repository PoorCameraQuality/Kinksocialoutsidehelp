/** Sets TSX path aliases for web package tests run from @c2k/api. */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
process.env.TSX_TSCONFIG_PATH = join(dir, '../../web/tsconfig.app.json')
