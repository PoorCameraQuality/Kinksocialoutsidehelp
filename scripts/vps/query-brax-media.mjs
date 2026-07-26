import { Client } from 'ssh2'

const password = process.env.SSH_PASSWORD
if (!password) process.exit(1)

const sql = `SELECT ma.id, ma.upload_status, ma.scan_status, ma.original_filename, ma.created_at, ma.moderation_case_id, msr.scanner_name, msr.status, msr.labels FROM media_assets ma LEFT JOIN media_scanner_results msr ON msr.media_asset_id = ma.id WHERE ma.uploader_user_id = (SELECT id FROM users WHERE username = 'Brax') ORDER BY ma.created_at DESC, msr.created_at LIMIT 30`

const conn = new Client()
conn.on('ready', () => {
  conn.exec(
    `cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${sql}"`,
    (err, stream) => {
      if (err) process.exit(1)
      stream.on('close', (c) => { conn.end(); process.exit(c ?? 0) })
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
    },
  )
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 20000 })
