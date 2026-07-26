/**
 * Deploy organizer Messaging campaigns (going/interested → in-app DMs).
 *
 * Usage:
 *   SSH_PASS='...' node scripts/vps/patch-messaging-campaign-vps.mjs
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
const DEPLOY_ROOT = process.env.DEPLOY_ROOT ?? '/opt/c2k'
const COMPOSE =
  'docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production'

const files = [
  'packages/api/src/db/schema.ts',
  'packages/api/src/lib/marketing-email-html.ts',
  'packages/api/src/lib/convention-campaign-audience.ts',
  'packages/api/src/lib/sanitize-dm-body.ts',
  'packages/api/src/lib/organizer-inbox-campaign.ts',
  'packages/api/src/lib/conversations-inbox.ts',
  'packages/api/src/routes/convention-organizer-routes.ts',
  'packages/api/src/routes/convention-organizer/modules-routes.ts',
  'packages/api/src/routes/ecosystem-stubs.ts',
  'packages/web/src/components/dancecard/organizer/MessagingPanel.tsx',
  'packages/web/src/components/dancecard/organizer/CampaignBodyEditor.tsx',
  'packages/web/src/components/dancecard/organizer/shell/organizerNavConfig.ts',
  'packages/web/src/components/dancecard/organizer/home/DashboardQuickActions.tsx',
  'packages/web/src/app/messaging/page.tsx',
]

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => resolve(conn)).on('error', reject)
    conn.connect({ host: HOST, port: 22, username: 'root', password, readyTimeout: 120000 })
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
        if (code !== 0) reject(new Error(`${label || cmd} exit ${code}\n${out.slice(-4000)}`))
        else resolve(out.trim())
      })
    })
  })
}

async function main() {
  for (const rel of files) {
    if (!existsSync(join(root, rel))) throw new Error(`Missing local file: ${rel}`)
  }

  const conn = await connect()
  console.log('Connected to VPS')

  await new Promise((resolve, reject) => {
    conn.sftp(async (err, sftp) => {
      if (err) return reject(err)
      try {
        for (const rel of files) {
          const local = join(root, rel)
          const remote = `${DEPLOY_ROOT}/${rel.replace(/\\/g, '/')}`
          await exec(conn, `mkdir -p '${remote.replace(/\/[^/]+$/, '')}'`)
          console.log(`Upload ${rel}`)
          await new Promise((res, rej) => {
            sftp.writeFile(remote, readFileSync(local), (wErr) => (wErr ? rej(wErr) : res()))
          })
        }
        resolve(undefined)
      } catch (e) {
        reject(e)
      }
    })
  })

  // Ensure body_format column exists even if drizzle-kit push is flaky on varchar defaults.
  await exec(
    conn,
    `cd ${DEPLOY_ROOT} && docker exec c2k-postgres-1 psql -U c2k -d c2k -v ON_ERROR_STOP=1 -c "ALTER TABLE messages ADD COLUMN IF NOT EXISTS body_format varchar(16) NOT NULL DEFAULT 'text';"`,
    'Add messages.body_format if missing',
  )

  await exec(
    conn,
    `cd ${DEPLOY_ROOT} && set -a && source .env.production && set +a && export NODE_ENV=production USE_DATABASE=true DATABASE_URL="postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@127.0.0.1:5432/\${POSTGRES_DB}" && npm run build -w @c2k/api && ${COMPOSE} build api web && ${COMPOSE} up -d api web && sleep 20 && curl -sf https://kink.social/api/health/ready && echo && curl -sf -o /dev/null -w "messaging=%{http_code}\\n" https://kink.social/messaging`,
    'Build api + rebuild/restart api web',
  )

  conn.end()
  console.log('\nMessaging campaign patch deployed.')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
