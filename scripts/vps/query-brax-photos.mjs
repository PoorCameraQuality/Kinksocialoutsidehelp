/**
 * Query Brax profile photos + moderation state on VPS DB.
 */
import { Client } from 'ssh2'

const PASS = process.env.SSH_PASSWORD ?? 'EastCoastKinkEvents@3'
const HOST = process.env.VPS_HOST ?? '2.25.196.84'

const sql = `
SELECT ma.id, ma.upload_status, ma.scan_status, ma.storage_state, ma.moderation_case_id,
       ma.original_filename, ma.created_at::text,
       mc.status AS case_status, mc.queue AS case_queue,
       pp.id AS profile_photo_id, pp.sort_order
FROM media_assets ma
LEFT JOIN moderation_cases mc ON mc.id = ma.moderation_case_id
LEFT JOIN profile_photos pp ON pp.media_asset_id = ma.id
WHERE ma.uploader_user_id = (SELECT id FROM users WHERE username = 'Brax')
  AND ma.source_surface = 'profile_gallery'
ORDER BY ma.created_at DESC
LIMIT 15;
`

function sshExec(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let out = ''
    conn
      .on('ready', () => {
        conn.exec(cmd, (err, stream) => {
          if (err) return reject(err)
          stream.on('data', (d) => (out += d))
          stream.on('close', () => {
            conn.end()
            resolve(out)
          })
        })
      })
      .on('error', reject)
      .connect({ host: HOST, username: 'root', password: PASS, readyTimeout: 25000 })
  })
}

const escaped = sql.replace(/"/g, '\\"').replace(/\n/g, ' ')
const cmd = `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${escaped}"`

console.log('Querying VPS...')
const result = await sshExec(cmd)
console.log(result)

const sql2 = `
SELECT count(*) AS open_cases FROM moderation_cases
WHERE status IN ('OPEN','TRIAGED','ESCALATED');
`
const cmd2 = `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${sql2.replace(/\n/g, ' ')}"`
console.log('\nOpen moderation cases:')
console.log(await sshExec(cmd2))
