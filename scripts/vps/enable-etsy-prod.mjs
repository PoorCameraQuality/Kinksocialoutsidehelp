/**
 * Enable Etsy vendor sync on production VPS and run API smoke test.
 *
 * Usage:
 *   ETSY_X_API_KEY='keystring:shared_secret' SSH_PASS='...' node scripts/vps/enable-etsy-prod.mjs
 *
 * Adds ETSY_X_API_KEY to /opt/c2k/.env.production (or updates existing line),
 * recreates api + worker containers, runs smoke-etsy-api.mjs on the host.
 */
import { Client } from 'ssh2'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD || process.argv[2]
const etsyKey = process.env.ETSY_X_API_KEY?.trim() || process.env.ETSY_KEYSTRING?.trim()

if (!password) {
  console.error('Set SSH_PASS')
  process.exit(1)
}
if (!etsyKey || !etsyKey.includes(':')) {
  console.error('Set ETSY_X_API_KEY=keystring:shared_secret (both parts, colon-separated)')
  process.exit(1)
}

const HOST = '2.25.196.84'
const REMOTE = '/opt/c2k'
const COMPOSE =
  'docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production'

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
        if (code !== 0) reject(new Error(`${label || cmd} exit ${code}\n${out.slice(-1500)}`))
        else resolve(out.trim())
      })
    })
  })
}

function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const conn = await connect()
  console.log('Connected to VPS')

  await exec(
    conn,
    `cd ${REMOTE} && cp -a .env.production .env.production.bak-etsy-${stamp}`,
    'Backup .env.production',
  )

  const keyB64 = Buffer.from(etsyKey, 'utf8').toString('base64')
  await exec(
    conn,
    `cd ${REMOTE} && node -e "const fs=require('fs');const k=Buffer.from('${keyB64}','base64').toString('utf8');const p='.env.production';let t=fs.readFileSync(p,'utf8');const line='ETSY_X_API_KEY='+k;if(/^ETSY_X_API_KEY=/m.test(t)) t=t.replace(/^ETSY_X_API_KEY=.*$/m,line); else if(/^ETSY_KEYSTRING=/m.test(t)) t=t.replace(/^ETSY_KEYSTRING=.*$/m,line); else t=t.replace(/\\n?$/,'\\n')+line+'\\n'; fs.writeFileSync(p,t);"`,
    'Set ETSY_X_API_KEY in .env.production',
  )

  await exec(conn, `cd ${REMOTE} && ${COMPOSE} up -d --force-recreate api worker`, 'Recreate api + worker')

  await exec(conn, 'sleep 12', 'Wait for containers')

  const smokeScript = readFileSync(join(root, 'scripts/smoke-etsy-api.mjs'), 'utf8')
  const remoteSmoke = `/tmp/c2k-smoke-etsy-api.mjs`
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      sftp.writeFile(remoteSmoke, smokeScript, (wErr) => (wErr ? reject(wErr) : resolve()))
    })
  })

  await exec(
    conn,
    `cd ${REMOTE} && ETSY_X_API_KEY=${shellQuote(etsyKey)} node ${remoteSmoke} --shop FlogginFarmers`,
    'Etsy API smoke (FlogginFarmers)',
  )

  await exec(
    conn,
    `docker exec c2k-api-1 node -e "console.log(process.env.ETSY_X_API_KEY || process.env.ETSY_KEYSTRING ? 'etsy_env=set' : 'etsy_env=missing')"`,
    'Verify api container env',
  )

  conn.end()
  console.log('\nETSY PROD ENABLE OK — vendors can connect Etsy shops in onboarding.')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
