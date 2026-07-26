/**
 * Upload alpha hardening media scripts to VPS and run audit → dry-run → apply.
 * Usage: SSH_PASS='...' node scripts/vps/run-alpha-hardening-media-remediation.mjs
 * Env: APPLY=true (default false — dry-run only after audit)
 */
import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS || process.env.SSH_PASSWORD
const APPLY = process.env.APPLY === 'true'

if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

const files = [
  'packages/api/scripts/audit-restricted-public-media.ts',
  'packages/api/scripts/remediate-restricted-public-media.ts',
  'scripts/vps/remote-audit-restricted-public-media.sh',
  'scripts/vps/remote-remediate-restricted-public-media.sh',
  'scripts/vps/purge-remediated-minio.mjs',
]

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(72)}\n▶ ${label}\n${'='.repeat(72)}\n`)
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`${label} exited ${code}`))
        else resolve()
      })
    })
  })
}

function uploadAll(conn, sftp) {
  return Promise.all(
    files.map(
      (rel) =>
        new Promise((resolve, reject) => {
          const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`
          const body = readFileSync(join(root, rel))
          const normalized = rel.endsWith('.sh') ? body.toString('utf8').replace(/\r\n/g, '\n') : body
          sftp.writeFile(remote, normalized, (err) => {
            if (err) reject(err)
            else {
              console.log('uploaded', rel)
              resolve()
            }
          })
        }),
    ),
  )
}

const conn = new Client()
conn.on('ready', () => {
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    try {
      await uploadAll(conn, sftp)
      await exec(
        conn,
        'cd /opt/c2k && bash scripts/vps/remote-audit-restricted-public-media.sh',
        'Phase 2a — audit restricted public media',
      )
      await exec(
        conn,
        'cd /opt/c2k && APPLY=false bash scripts/vps/remote-remediate-restricted-public-media.sh',
        'Phase 2b — remediate dry-run',
      )
      if (APPLY) {
        await exec(
          conn,
          'cd /opt/c2k && APPLY=true bash scripts/vps/remote-remediate-restricted-public-media.sh',
          'Phase 2c — remediate APPLY',
        )
        await exec(
          conn,
          'cd /opt/c2k && node scripts/vps/purge-remediated-minio.mjs',
          'Phase 2c2 — purge MinIO media/ objects (mc rm)',
        )
        await exec(
          conn,
          'cd /opt/c2k && bash scripts/vps/remote-audit-restricted-public-media.sh',
          'Phase 2d — post-remediation audit',
        )
      } else {
        console.log('\nSkipped APPLY (set APPLY=true to mutate prod DB + MinIO)')
      }
      conn.end()
    } catch (e) {
      console.error(e.message || e)
      conn.end()
      process.exit(1)
    }
  })
})
conn.on('error', (e) => {
  console.error(e.message)
  process.exit(1)
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 120000 })
