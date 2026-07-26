/**
 * Enable ECKE Supabase publish bridge on VPS (convention/org dancecard + events sync).
 * Reads ECKE Supabase creds from EastCoast .env.local by default.
 *
 * Usage:
 *   SSH_PASS='...' node scripts/vps/enable-ecke-supabase-bridge.mjs
 *   SSH_PASS='...' ECKE_ENV_LOCAL=C:/path/.env.local node scripts/vps/enable-ecke-supabase-bridge.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { Client } from 'ssh2'

const password = process.env.SSH_PASS || process.env.SSH_PASSWORD
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const eckeEnvPath =
  process.env.ECKE_ENV_LOCAL ||
  'C:/Users/shkin/Desktop/eastcoast/EastCoast-master/.env.local'

if (!existsSync(eckeEnvPath)) {
  console.error(`ECKE env file not found: ${eckeEnvPath}`)
  process.exit(1)
}

const eckeEnv = readFileSync(eckeEnvPath, 'utf8')
const supabaseUrl = eckeEnv.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
const serviceRoleKey = eckeEnv.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Could not parse NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY from ECKE env')
  process.exit(1)
}

const compose =
  'docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production'

function upsertEnvLine(content, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(content)) return content.replace(re, line)
  return content.endsWith('\n') ? `${content}${line}\n` : `${content}\n${line}\n`
}

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

async function main() {
  const conn = await connect()
  console.log('Connected to VPS')

  const readEnv = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      sftp.readFile('/opt/c2k/.env.production', (readErr, buf) => {
        if (readErr) return reject(readErr)
        resolve(buf.toString('utf8'))
      })
    })
  })

  let next = readEnv
  next = upsertEnvLine(next, 'ECKE_SUPABASE_URL', supabaseUrl)
  next = upsertEnvLine(next, 'ECKE_SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey)

  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      sftp.writeFile('/opt/c2k/.env.production', next, (writeErr) => {
        if (writeErr) return reject(writeErr)
        console.log('Updated ECKE_SUPABASE_URL and ECKE_SUPABASE_SERVICE_ROLE_KEY on VPS')
        resolve()
      })
    })
  })

  await exec(conn, `cd /opt/c2k && ${compose} up -d api worker 2>&1`, 'Restart api + worker')
  await exec(conn, 'sleep 12', 'Wait for API')
  await exec(
    conn,
    `cd /opt/c2k && set -a && . ./.env.production && set +a && node -e "const u=process.env.ECKE_SUPABASE_URL; const k=process.env.ECKE_SUPABASE_SERVICE_ROLE_KEY; console.log('ECKE_SUPABASE_URL='+(u?'set':'missing')); console.log('ECKE_SUPABASE_SERVICE_ROLE_KEY='+(k?'set':'missing')); console.log('ECKE_PUBLISH_ENABLED='+process.env.ECKE_PUBLISH_ENABLED);"`,
    'Verify env loaded',
  )

  conn.end()
  console.log('\nECKE Supabase bridge enabled. Hard-refresh Integrations and retry Publish with ECKE checked.')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
