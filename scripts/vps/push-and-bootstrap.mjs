/**
 * Push repo tarball to VPS and run bootstrap (one-shot deploy).
 * Usage: SSH_PASSWORD=... node scripts/vps/push-and-bootstrap.mjs
 */
import { Client } from 'ssh2';
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { deployTarExcludeFlag } from '../lib/deploy-tar-excludes.mjs';

const HOST = process.env.SSH_HOST ?? '2.25.196.84';
const USER = process.env.SSH_USER ?? 'root';
const PASSWORD = process.env.SSH_PASSWORD;
const ROOT = process.env.DEPLOY_ROOT ?? '/opt/c2k';
const REPO = process.cwd();
const TARBALL = join(REPO, '.deploy-c2k.tgz');

if (!PASSWORD) {
  console.error('Set SSH_PASSWORD');
  process.exit(1);
}

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`exit ${code}: ${out}`));
        else resolve(out);
      });
      stream.on('data', (d) => {
        process.stdout.write(d);
        out += d;
      });
      stream.stderr.on('data', (d) => process.stderr.write(d));
    });
  });
}

function sshUpload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const rs = createReadStream(localPath);
      const ws = sftp.createWriteStream(remotePath);
      ws.on('close', () => resolve());
      ws.on('error', reject);
      rs.on('error', reject);
      rs.pipe(ws);
    });
  });
}

console.log('Creating deploy tarball (see .deployignore; bootstrap only — prefer patch-*-vps.mjs)...');
execSync(
  `tar -czf "${TARBALL}" ${deployTarExcludeFlag()} -C "${REPO}" .`,
  { stdio: 'inherit', shell: true },
);

const conn = new Client();
conn.on('ready', async () => {
  try {
    await sshExec(conn, `mkdir -p ${ROOT}`);
    console.log('Uploading tarball...');
    await sshUpload(conn, TARBALL, '/tmp/c2k-deploy.tgz');
    await sshExec(
      conn,
      `mkdir -p ${ROOT} && tar -xzf /tmp/c2k-deploy.tgz -C ${ROOT} && rm -f /tmp/c2k-deploy.tgz && chmod +x ${ROOT}/scripts/vps/*.sh`,
    );
    console.log('Running bootstrap (this takes several minutes)...');
    await sshExec(
      conn,
      `cd ${ROOT} && export DEPLOY_ROOT=${ROOT} DOMAIN=kink.social BRAX_ADMIN_PASSWORD='${process.env.BRAX_ADMIN_PASSWORD ?? 'Airshipknight!2'}' && bash scripts/vps/bootstrap-kink-social.sh`,
    );
    conn.end();
    if (existsSync(TARBALL)) unlinkSync(TARBALL);
    console.log('Done.');
  } catch (e) {
    conn.end();
    if (existsSync(TARBALL)) unlinkSync(TARBALL);
    console.error(e);
    process.exit(1);
  }
});
conn.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});
conn.connect({ host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 30000 });
