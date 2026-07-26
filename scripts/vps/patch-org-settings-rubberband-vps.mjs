/**
 * Fix org settings rubberbanding (refetch loop + PATCH owner permission).
 *
 * Usage:
 *   SSH_PASS='...' node scripts/vps/patch-org-settings-rubberband-vps.mjs
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
  'packages/api/src/routes/organizations.ts',
  'packages/web/src/components/organizer/OrganizerOrgSettingsPanel.tsx',
  'packages/web/src/components/organizer/settings/SettingsGeneralTab.tsx',
  'packages/web/src/app/organizer/orgs/[slug]/OrganizerOrgClient.tsx',
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
        if (code !== 0) reject(new Error(`${label || cmd} exit ${code}\n${out.slice(-3000)}`))
        else resolve(out.trim())
      })
    })
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

  await exec(
    conn,
    `cd ${DEPLOY_ROOT} && npm run build -w @c2k/api && ${COMPOSE} build api web && ${COMPOSE} up -d api web && sleep 15 && curl -sf -o /dev/null -w "ready=%{http_code}\\n" https://kink.social/api/health/ready`,
    'Rebuild api + web',
  )

  conn.end()
  console.log('\nOrg settings rubberband fix deployed.')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
