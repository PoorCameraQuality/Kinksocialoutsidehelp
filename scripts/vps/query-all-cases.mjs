import { Client } from 'ssh2'
const password = process.env.SSH_PASSWORD
if (!password) process.exit(1)
const sql = `SELECT mc.id, mc.status, mc.queue, mc.created_at, ma.original_filename, ma.upload_status, ma.scan_status FROM moderation_cases mc LEFT JOIN media_assets ma ON ma.id::text = mc.target_content_id ORDER BY mc.created_at DESC LIMIT 15`
const conn = new Client()
conn.on('ready', () => {
  conn.exec(`cd /opt/c2k && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T postgres psql -U c2k -d c2k -c "${sql}"`, (err, stream) => {
    if (err) process.exit(1)
    stream.on('close', (c) => { conn.end(); process.exit(c ?? 0) })
    stream.on('data', (d) => process.stdout.write(d))
    stream.stderr.on('data', (d) => process.stderr.write(d))
  })
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 20000 })
