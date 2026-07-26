/**
 * Purge MinIO media/ objects for DB-remediated profile gallery rows.
 * Usage: SSH_PASS='...' node scripts/vps/purge-remediated-minio.mjs
 */
import { Client } from 'ssh2'

const password = process.env.SSH_PASS || process.env.SSH_PASSWORD
if (!password) {
  console.error('Set SSH_PASS or SSH_PASSWORD')
  process.exit(1)
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    let out = ''
    let err = ''
    conn.exec(cmd, (e, stream) => {
      if (e) return reject(e)
      stream.on('data', (d) => {
        out += d.toString()
      })
      stream.stderr.on('data', (d) => {
        err += d.toString()
      })
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(err || out || `exit ${code}`))
        else resolve(out)
      })
    })
  })
}

const compose =
  'docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml'

const conn = new Client()
conn.on('ready', async () => {
  try {
    const raw = await exec(
      conn,
      `cd /opt/c2k && ${compose} exec -T postgres psql -U c2k -d c2k -t -A -F '|' -c "SELECT id, uploader_user_id, COALESCE(original_filename, id::text || '.png') FROM media_assets WHERE storage_state = 'VALIDATED_PRIVATE' AND public_storage_key IS NULL AND source_surface = 'profile_gallery' AND storage_key LIKE 'quarantine/%';"`,
    )

    const rows = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, userId, filename] = line.split('|')
        return { id, userId, filename }
      })
      .filter((r) => r.id && r.userId)

    console.log(`Found ${rows.length} remediated row(s)`)
    let removed = 0
    for (const row of rows) {
      const ext = row.filename?.includes('.') ? row.filename.split('.').pop() : 'png'
      const key = `media/${row.userId}/${row.id}.${ext}`
      try {
        await exec(
          conn,
          `cd /opt/c2k && set -a && . ./.env.production && set +a && ${compose} exec -T minio mc rm --force "local/\${S3_BUCKET:-c2k-uploads}/${key}"`,
        )
        removed++
        console.log('removed', key)
      } catch {
        console.log('skip/missing', key)
      }
    }

    const check = await exec(
      conn,
      "curl -s -o /dev/null -w '%{http_code}' 'https://kink.social/media/f222c094-6887-4354-a42a-6b7edf0ec41b/1a4eb002-674f-43c7-bff4-199e94aa4d1a.png'",
    )
    console.log(`\nSummary: removed=${removed}/${rows.length} tarkiz_public=${check.trim()}`)
    conn.end()
  } catch (e) {
    console.error(e.message || e)
    conn.end()
    process.exit(1)
  }
})
conn.connect({ host: '2.25.196.84', port: 22, username: 'root', password, readyTimeout: 120000 })
