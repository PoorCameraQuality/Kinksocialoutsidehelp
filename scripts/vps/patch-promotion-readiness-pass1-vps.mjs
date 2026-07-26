/** Upload promotion readiness pass 1 scripts to VPS (no service rebuild unless remediation applied). */
import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const password = process.env.SSH_PASS
if (!password) {
  console.error('Set SSH_PASS')
  process.exit(1)
}

const files = [
  'packages/api/scripts/audit-restricted-public-media.ts',
  'packages/api/scripts/remediate-staff-restricted-public-media.ts',
  'scripts/vps/remote-audit-restricted-public-media.sh',
  'scripts/vps/remote-remediate-staff-restricted-public-media.sh',
]

const conn = new Client()
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err
    let pending = files.length
    for (const rel of files) {
      sftp.writeFile(`/opt/c2k/${rel.replace(/\\/g, '/')}`, readFileSync(join(root, rel)), (wErr) => {
        if (wErr) throw wErr
        console.log('uploaded', rel)
        if (--pending === 0) {
          conn.exec(
            'cd /opt/c2k && bash scripts/vps/remote-audit-restricted-public-media.sh && APPLY=false bash scripts/vps/remote-remediate-staff-restricted-public-media.sh',
            (e, stream) => {
              stream.on('data', (d) => process.stdout.write(d))
              stream.stderr.on('data', (d) => process.stderr.write(d))
              stream.on('close', (code) => {
                conn.end()
                process.exit(code ?? 0)
              })
            },
          )
        }
      })
    }
  })
})
conn.on('error', (e) => {
  console.error(e.message)
  process.exit(1)
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 60000 })
