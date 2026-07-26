/**
 * Scoped VPS deploy: convention public hub layout cleanup from chat
 * (flyer hero, sidebar, closed participation, official links, ICS gate).
 *
 * Usage:
 *   SSH_PASS='...' node scripts/vps/patch-convention-hub-layout-vps.mjs
 */
import { Client } from 'ssh2'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD || process.argv[2]
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

/** Runtime files only — no tests/docs. */
const files = [
  'packages/api/src/routes/conventions-routes.ts',
  'packages/web/src/app/conventions/[slug]/page.tsx',
  'packages/web/src/app/conventions/[slug]/panels/ConventionProgramSchedulePanel.tsx',
  'packages/web/src/app/conventions/[slug]/panels/ConventionWelcomePanel.tsx',
  'packages/web/src/components/conventions/ConventionConnectLinks.tsx',
  'packages/web/src/components/conventions/ConventionEventSidebar.tsx',
  'packages/web/src/components/conventions/ConventionGetInvolvedPanel.tsx',
  'packages/web/src/components/conventions/ConventionHero.tsx',
  'packages/web/src/components/conventions/ConventionHighlightsGrid.tsx',
  'packages/web/src/components/conventions/ConventionOfficialLinks.tsx',
  'packages/web/src/components/conventions/ConventionVenueTravelCard.tsx',
  'packages/web/src/components/conventions/ConventionWelcomeTab.tsx',
  'packages/web/src/components/conventions/HostedByCard.tsx',
  'packages/web/src/hooks/useConventionHub.ts',
  'packages/web/src/lib/convention-description.ts',
  'packages/web/src/lib/mobile-chrome.ts',
  'packages/web/src/app/globals.css',
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

function sftpMkdirp(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, { mode: 0o755 }, () => resolve())
  })
}

async function ensureRemoteDirs(sftp, remoteFile) {
  const parts = remoteFile.split('/')
  let cur = ''
  for (let i = 0; i < parts.length - 1; i++) {
    if (!parts[i]) continue
    cur += `/${parts[i]}`
    await sftpMkdirp(sftp, cur)
  }
}

async function uploadAll(conn) {
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)))
  })
  for (const rel of files) {
    const local = join(root, rel)
    if (!existsSync(local)) throw new Error(`Missing local file: ${rel}`)
    const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
    await ensureRemoteDirs(sftp, remote)
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

  await exec(conn, `cd /opt/c2k && ${compose} build api web 2>&1`, 'Docker build api + web')
  await exec(conn, `cd /opt/c2k && ${compose} up -d api web 2>&1`, 'Restart api + web')
  await exec(conn, 'sleep 18', 'Wait for services')
  await exec(
    conn,
    [
      'curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/',
      'curl -sf https://kink.social/api/health/ready | head -c 400',
      'echo',
      'curl -sf -o /dev/null -w "conventions=%{http_code}\\n" https://kink.social/conventions',
    ].join(' && '),
    'Smoke home + health + conventions',
  )

  conn.end()
  console.log('\nPATCH OK — hard-refresh a convention page (flyer hero + sidebar).')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
