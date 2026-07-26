/**
 * Scoped VPS deploy: Applications hub + richer ECKE convention listing publish (commit 2ed90fe).
 * Uploads runtime source only — no e2e, tests, docs, or unrelated feed/profile changes.
 *
 * Usage:
 *   SSH_PASS='...' node scripts/vps/patch-ecke-applications-pass1-vps.mjs
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

/** Files from ecke-events-conventions-pass1 @ 2ed90fe (runtime only). */
const files = [
  'packages/api/scripts/migrate-organizer-parity.ts',
  'packages/api/src/db/convention-organizer-schema.ts',
  'packages/api/src/db/schema.ts',
  'packages/api/src/lib/convention-organizer/registration.ts',
  'packages/api/src/lib/ecke-directory-sync.ts',
  'packages/api/src/lib/ecke-publish-payload.ts',
  'packages/api/src/routes/convention-organizer-routes.ts',
  'packages/api/src/routes/convention-organizer/registration-routes.ts',
  'packages/api/src/routes/convention-public-routes.ts',
  'packages/api/src/routes/conventions-routes.ts',
  'packages/shared/src/index.ts',
  'packages/shared/src/notification-types.ts',
  'packages/shared/src/seo-policy.ts',
  'packages/web/src/components/dancecard/organizer/BadgesPrintPanel.tsx',
  'packages/web/src/components/dancecard/organizer/DmCoveragePanel.tsx',
  'packages/web/src/components/dancecard/organizer/EventSetupRequired.tsx',
  'packages/web/src/components/dancecard/organizer/ExhibitorsOrganizerPanel.tsx',
  'packages/web/src/components/dancecard/organizer/ExportsHubPanel.tsx',
  'packages/web/src/components/dancecard/organizer/IcalBusyPreviewPanel.tsx',
  'packages/web/src/components/dancecard/organizer/IntegrationsPanel.tsx',
  'packages/web/src/components/dancecard/organizer/IsoModerationPanel.tsx',
  'packages/web/src/components/dancecard/organizer/KitchenMealPanel.tsx',
  'packages/web/src/components/dancecard/organizer/MessagingPanel.tsx',
  'packages/web/src/components/dancecard/organizer/PersonDetailDrawer.tsx',
  'packages/web/src/components/dancecard/organizer/ProgramScheduleGrid.tsx',
  'packages/web/src/components/dancecard/organizer/RegistrantsPanel.tsx',
  'packages/web/src/components/dancecard/organizer/SessionFeedbackConfigPanel.tsx',
  'packages/web/src/components/dancecard/organizer/ShiftSwapsPanel.tsx',
  'packages/web/src/components/dancecard/organizer/TrustedRolesPanel.tsx',
  'packages/web/src/components/dancecard/organizer/VettingQueuePanel.tsx',
  'packages/web/src/components/dancecard/organizer/VolunteerCompliancePanel.tsx',
  'packages/web/src/components/dancecard/organizer/applications/ApplicationsHubPanel.tsx',
  'packages/web/src/components/dancecard/organizer/applications/RoleWindowsBoard.tsx',
  'packages/web/src/components/dancecard/organizer/program/PresenterRequestsPanel.tsx',
  'packages/web/src/components/dancecard/organizer/shell/organizerNavConfig.ts',
  'packages/web/src/components/organizer/ConventionListingDetailsEditor.tsx',
  'packages/web/src/components/organizer/ConventionPublishActions.tsx',
  'packages/web/src/components/organizer/EckePublishStub.tsx',
  'packages/web/src/components/organizer/convention/ConventionDancecardOrganizerClient.tsx',
  'packages/web/src/lib/dancecard/commandBridgeNavPermissions.ts',
  'packages/web/src/lib/ecke-publish-utils.ts',
  'packages/web/src/lib/organizer/conventionProgramApi.ts',
  'packages/web/src/styles/dancecard-parity.css',
]

const remoteDeletes = ['packages/web/src/lib/organizer/conventionNavConfig.ts']

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

async function uploadAll(conn) {
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)))
  })
  for (const rel of files) {
    const local = join(root, rel)
    if (!existsSync(local)) {
      throw new Error(`Missing local file: ${rel}`)
    }
    const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
    await sftpMkdirp(sftp, dirname(remote))
    await new Promise((resolve, reject) => {
      sftp.writeFile(remote, readFileSync(local), (wErr) => {
        if (wErr) return reject(wErr)
        console.log('uploaded', rel)
        resolve()
      })
    })
  }
  for (const rel of remoteDeletes) {
    const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
    await new Promise((resolve) => {
      sftp.unlink(remote, () => {
        console.log('removed (if existed)', rel)
        resolve()
      })
    })
  }
}

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')
  await uploadAll(conn)

  await exec(
    conn,
    `cd /opt/c2k && set -a && . ./.env.production && set +a && export DATABASE_URL="postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@127.0.0.1:5432/\${POSTGRES_DB}" && npm run db:migrate-organizer-parity -w @c2k/api 2>&1`,
    'Organizer parity migration (apply_opens_at / apply_closes_at)',
  )

  await exec(
    conn,
    `cd /opt/c2k && npm run build -w @c2k/shared && npm run build -w @c2k/api 2>&1`,
    'Build shared + api on host',
  )
  await exec(conn, `cd /opt/c2k && ${compose} build api web worker 2>&1`, 'Docker build api + web + worker')
  await exec(conn, `cd /opt/c2k && ${compose} up -d api web worker 2>&1`, 'Restart api + web + worker')
  await exec(conn, 'sleep 20', 'Wait for services')
  await exec(
    conn,
    [
      'curl -sf -o /dev/null -w "home=%{http_code}\\n" https://kink.social/',
      'curl -sf https://kink.social/api/health/ready | head -c 500',
      'echo',
      'curl -sf -o /dev/null -w "organizer=%{http_code}\\n" "https://kink.social/organizer/orgs/demo-east-collective/conventions/seed-demo-con-gated?tab=applications"',
    ].join(' && '),
    'Smoke home + health + organizer applications tab',
  )

  conn.end()
  console.log('\nPATCH OK — hard-refresh organizer dashboard; fill Listing details then Preview → Publish for ECKE.')
}

main().catch((e) => {
  console.error('\nPATCH FAILED:', e.message)
  process.exit(1)
})
