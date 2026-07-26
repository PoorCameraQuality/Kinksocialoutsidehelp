// Upload local files to the isolated STAGING tree only (/opt/c2k-staging).
// Never writes to /opt/c2k (production). Usage:
//   SSH_PASSWORD=... node scripts/vps/upload-files-staging.mjs <relative paths...>
import { Client } from 'ssh2';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const STAGING_ROOT = '/opt/c2k-staging';
const password = process.env.SSH_PASSWORD;
const files = process.argv.slice(2);
if (!password || files.length === 0) {
  console.error('SSH_PASSWORD env and at least one file argument required.');
  process.exit(1);
}

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    const ws = sftp.createWriteStream(remote);
    ws.on('close', resolve);
    ws.on('error', reject);
    ws.write(readFileSync(local));
    ws.end();
  });
}

const conn = new Client();
conn.on('ready', () => {
  conn.sftp(async (err, sftp) => {
    if (err) throw err;
    for (const rel of files) {
      const local = join(process.cwd(), rel);
      const remote = `${STAGING_ROOT}/${rel.replace(/\\/g, '/')}`;
      await new Promise((res) => {
        sftp.mkdir(dirname(remote).replace(/\\/g, '/'), { mode: 0o755 }, () => res());
      }).catch(() => {});
      await upload(sftp, local, remote);
      console.log('uploaded (staging)', rel);
    }
    conn.end();
  });
});
conn.on('error', (e) => {
  console.error('ssh error:', e.message);
  process.exit(1);
});
conn.connect({ host: '2.25.196.84', username: 'root', password, readyTimeout: 30000 });
