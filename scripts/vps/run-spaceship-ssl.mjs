import { Client } from 'ssh2';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const password = process.env.SSH_PASSWORD;
const token = process.env.SPACESHIP_SSL_TOKEN;
if (!password || !token) {
  console.error('Set SSH_PASSWORD and SPACESHIP_SSL_TOKEN');
  process.exit(1);
}

const script = readFileSync(join(process.cwd(), 'scripts/vps/install-spaceship-ssl.sh'));
const escaped = token.replace(/'/g, `'\\''`);

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/install-spaceship-ssl.sh');
    ws.on('close', () => {
      conn.exec(`chmod +x /tmp/install-spaceship-ssl.sh && bash /tmp/install-spaceship-ssl.sh '${escaped}'`, (e, stream) => {
        stream.on('close', (code) => {
          conn.end();
          process.exit(code ?? 0);
        });
        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));
      });
    });
    ws.write(script);
    ws.end();
  });
});
conn.connect({ host: '2.25.196.84', username: 'root', password, readyTimeout: 30000 });
