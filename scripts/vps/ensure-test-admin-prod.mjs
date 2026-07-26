/**
 * Create or update TestAdmin on production VPS.
 * Usage: SSH_PASSWORD=... node scripts/vps/ensure-test-admin-prod.mjs
 */
import { Client } from 'ssh2'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'

const HOST = process.env.SSH_HOST ?? '2.25.196.84'
const PASSWORD = process.env.SSH_PASSWORD
const ROOT = process.env.DEPLOY_ROOT ?? '/opt/c2k'
const REPO = process.cwd()
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'Testing!2'
const SCRIPT_LOCAL = join(REPO, 'packages/api/scripts/ensure-test-admin.ts')
const SCRIPT_REMOTE = `${ROOT}/packages/api/scripts/ensure-test-admin.ts`

if (!PASSWORD) {
  console.error('Set SSH_PASSWORD')
  process.exit(1)
}

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let out = ''
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`exit ${code}: ${out}`))
        else resolve(out)
      })
      stream.on('data', (d) => {
        process.stdout.write(d)
        out += d
      })
      stream.stderr.on('data', (d) => process.stderr.write(d))
    })
  })
}

function sshUpload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      const rs = createReadStream(localPath)
      const ws = sftp.createWriteStream(remotePath)
      ws.on('close', () => resolve())
      ws.on('error', reject)
      rs.on('error', reject)
      rs.pipe(ws)
    })
  })
}

const conn = new Client()
conn.on('ready', async () => {
  try {
    console.log('Uploading ensure-test-admin.ts...')
    await sshExec(conn, `mkdir -p ${ROOT}/packages/api/scripts`)
    await sshUpload(conn, SCRIPT_LOCAL, SCRIPT_REMOTE)

    const escapedPw = TEST_ADMIN_PASSWORD.replace(/'/g, "'\\''")
    const cmd = [
      `cd ${ROOT}`,
      'set -a && source .env.production && set +a',
      'export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"',
      'export USE_DATABASE=true',
      `export TEST_ADMIN_PASSWORD='${escapedPw}'`,
      'npx tsx packages/api/scripts/ensure-test-admin.ts',
    ].join(' && ')

    console.log('Ensuring TestAdmin on production...')
    await sshExec(conn, cmd)
    conn.end()
  } catch (e) {
    conn.end()
    console.error(e)
    process.exit(1)
  }
})
conn.on('error', (e) => {
  console.error(e)
  process.exit(1)
})
conn.connect({ host: HOST, username: 'root', password: PASSWORD, readyTimeout: 30000 })
