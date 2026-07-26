/**
 * Patch deploy: ECKE publish bridge UI (partial listing webhook success).
 * Usage: SSH_PASS='...' node scripts/vps/patch-ecke-publish-ui.mjs
 */
import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const files = [
  'packages/web/src/lib/ecke-publish-utils.ts',
  'packages/web/src/components/organizer/EckePublishStub.tsx',
  'packages/web/src/components/organizer/ConventionPublishActions.tsx',
]

const compose =
  'docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production'

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => resolve(conn)).on('error', reject)
    conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 120000 })
  })
}

function exec(conn, cmd, label = '') {
  return new Promise((resolve, reject) => {
    if (label) console.log(`\n>>> ${label}`)
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => (code !== 0 ? reject(new Error(`${label || cmd} exit ${code}`)) : resolve()))
    })
  })
}

async function uploadAll(conn) {
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)))
  })
  for (const rel of files) {
    const local = join(root, rel)
    const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
    readFileSync(local)
    await new Promise((resolve, reject) => {
      sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()))
    })
    console.log(`Uploaded ${rel}`)
  }
}

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')
  await uploadAll(conn)
  await exec(
    conn,
    `cd /opt/c2k && ${compose} build web && ${compose} up -d web 2>&1`,
    'Rebuild and restart web',
  )
  conn.end()
  console.log('\nECKE publish UI patch deployed.')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
