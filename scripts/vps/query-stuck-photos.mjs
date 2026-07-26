import { Client } from 'ssh2'

const PASS = process.env.SSH_PASSWORD ?? 'EastCoastKinkEvents@3'
const HOST = process.env.VPS_HOST ?? '2.25.196.84'

const queries = [
  ['Stuck profile gallery assets', `
SELECT u.username, ma.id, ma.upload_status, ma.scan_status, ma.moderation_case_id, ma.created_at::text
FROM media_assets ma
JOIN users u ON u.id = ma.uploader_user_id
WHERE ma.source_surface = 'profile_gallery'
  AND ma.upload_status IN ('PENDING_SCAN','QUARANTINED','ESCALATED')
ORDER BY ma.created_at DESC LIMIT 20;
`],
  ['Open media cases', `
SELECT mc.id, mc.queue, mc.status, mc.target_content_id, u.username, mc.created_at::text
FROM moderation_cases mc
LEFT JOIN users u ON u.id = mc.target_user_id
WHERE mc.status IN ('OPEN','TRIAGED','ESCALATED')
ORDER BY mc.created_at DESC LIMIT 20;
`],
  ['Brax mod permissions', `
SELECT u.username, r.role
FROM users u
LEFT JOIN platform_roles r ON r.user_id = u.id
WHERE u.username = 'Brax';
`],
]

function sshExec(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let out = ''
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err)
        stream.on('data', (d) => (out += d))
        stream.on('close', () => { conn.end(); resolve(out) })
      })
    }).on('error', reject).connect({ host: HOST, username: 'root', password: PASS, readyTimeout: 25000 })
  })
}

for (const [label, sql] of queries) {
  const escaped = sql.replace(/"/g, '\\"').replace(/\n/g, ' ')
  const cmd = `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${escaped}"`
  console.log(`\n=== ${label} ===`)
  console.log(await sshExec(cmd))
}
