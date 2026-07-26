/**
 * Patch: sync public Get involved with organizer Applications windows.
 * Usage: SSH_PASS='...' node scripts/vps/patch-participation-public-sync-vps.mjs
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

const files = [
  'packages/api/src/lib/convention-participation-offers.ts',
  'packages/web/src/components/conventions/ConventionGetInvolvedPanel.tsx',
  'packages/web/src/hooks/useApiConventionParticipation.ts',
  'packages/web/src/components/dancecard/organizer/applications/RoleWindowsBoard.tsx',
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
    if (!existsSync(local)) throw new Error(`Missing ${rel}`)
    const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
    await new Promise((resolve, reject) => {
      sftp.writeFile(remote, readFileSync(local), (wErr) => {
        if (wErr) return reject(wErr)
        console.log('uploaded', rel)
        resolve()
      })
    })
  }
}

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')
  await uploadAll(conn)
  await exec(conn, `cd /opt/c2k && npm run build -w @c2k/api 2>&1`, 'Build api on host')
  await exec(conn, `cd /opt/c2k && ${compose} build api web 2>&1`, 'Docker build api + web')
  await exec(conn, `cd /opt/c2k && ${compose} up -d api web 2>&1`, 'Restart api + web')
  await exec(conn, 'sleep 18', 'Wait')
  await exec(
    conn,
    'curl -sf https://kink.social/api/health/ready | head -c 300 && echo && curl -sf "https://kink.social/api/v1/public/conventions/seed-demo-con-gated/participation-opportunities" | head -c 800 && echo',
    'Smoke health + participation API',
  )
  conn.end()
  console.log('\nPATCH OK — hard-refresh the convention Welcome tab.')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
