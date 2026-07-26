import { Client } from 'ssh2';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const password = process.env.SSH_PASSWORD;
const files = process.argv.slice(2);
if (!password || files.length === 0) process.exit(1);

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(local), { recursive: true });
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
      const remote = `/opt/c2k/${rel.replace(/\\/g, '/')}`;
      await new Promise((res, rej) => {
        sftp.mkdir(dirname(remote).replace(/\\/g, '/'), { mode: 0o755 }, () => res());
      }).catch(() => {});
      await upload(sftp, local, remote);
      console.log('uploaded', rel);
    }
    conn.end();
  });
});
conn.connect({ host: '2.25.196.84', username: 'root', password, readyTimeout: 30000 });
