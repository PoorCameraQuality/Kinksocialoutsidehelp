/**
 * Upload Primal Arts import script to VPS and run it on production DB.
 *
 * Usage:
 *   SSH_PASS='...' node scripts/vps/patch-import-primal-arts-vps.mjs
 */
import { Client } from 'ssh2'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD || process.argv[2]
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const HOST = process.env.SSH_HOST ?? '2.25.196.84'
const USER = process.env.SSH_USER ?? 'root'
const DEPLOY_ROOT = process.env.DEPLOY_ROOT ?? '/opt/c2k'

const files = [
  'packages/api/scripts/import-primal-arts-org.ts',
  'packages/api/src/lib/org-import-media.ts',
  'scripts/vps/remote-import-primal-arts-org.sh',
]

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => resolve(conn)).on('error', reject)
    conn.connect({ host: HOST, username: USER, password, readyTimeout: 120000 })
  })
}

function exec(conn, cmd, label = '') {
  return new Promise((resolve, reject) => {
    if (label) console.log(`\n>>> ${label}`)
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let out = ''
      stream.on('data', (d) => {
        out += d.toString()
        process.stdout.write(d)
      })
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`${label || cmd} exit ${code}\n${out.slice(-3000)}`))
        else resolve(out.trim())
      })
    })
  })
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const ws = sftp.createWriteStream(remotePath)
    ws.on('close', resolve)
    ws.on('error', reject)
    ws.write(readFileSync(localPath))
    ws.end()
  })
}

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')

  await new Promise((resolve, reject) => {
    conn.sftp(async (err, sftp) => {
      if (err) return reject(err)
      try {
        for (const rel of files) {
          const local = join(root, rel)
          if (!existsSync(local)) throw new Error(`Missing ${local}`)
          const remote = `${DEPLOY_ROOT}/${rel.replace(/\\/g, '/')}`
          const remoteDir = remote.replace(/\/[^/]+$/, '')
          await exec(conn, `mkdir -p '${remoteDir}'`)
          console.log(`Upload ${rel}`)
          await uploadFile(sftp, local, remote)
        }
        resolve(undefined)
      } catch (e) {
        reject(e)
      }
    })
  })

  await exec(conn, `chmod +x ${DEPLOY_ROOT}/scripts/vps/remote-import-primal-arts-org.sh`)
  await exec(conn, `bash ${DEPLOY_ROOT}/scripts/vps/remote-import-primal-arts-org.sh`, 'Run Primal Arts import')

  conn.end()
  console.log('\nPrimal Arts org import deploy complete.')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
