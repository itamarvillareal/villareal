/**
 * Perfil de ligação MySQL para scripts de manutenção (local vs VPS via túnel SSH).
 *
 * VPS: túnel activo, ex. `ssh -N -L 3308:127.0.0.1:3306 root@161.97.175.73`
 * Password: `.env.docker` (VILLAREAL_COMPOSE_JDBC_PASSWORD) ou VILAREAL_MYSQL_PASSWORD.
 */

import fs from 'node:fs';
import path from 'node:path';

/** @param {string[]} argv */
export function parseFlagVps(argv) {
  return argv.includes('--vps');
}

/**
 * @param {{ vps?: boolean, repoRoot?: string }} [opts]
 * @returns {{ alvo: string, host: string, port: number, vps: boolean }}
 */
export function aplicarPerfilConexao(opts = {}) {
  const vps = opts.vps === true;
  if (vps) {
    process.env.VILAREAL_MYSQL_HOST = process.env.VILAREAL_MYSQL_HOST || '127.0.0.1';
    process.env.VILAREAL_MYSQL_PORT = process.env.VILAREAL_MYSQL_PORT || '3308';
    carregarPasswordDockerSeVazia(opts.repoRoot);
  }

  const host = process.env.VILAREAL_MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.VILAREAL_MYSQL_PORT || (vps ? 3308 : 3307));
  const alvo = vps ? `VPS (túnel ${host}:${port})` : `local (${host}:${port})`;

  if (process.env.VILAREAL_MYSQL_DOCKER?.trim()) {
    console.warn(
      '[aviso] VILAREAL_MYSQL_DOCKER activo — scripts com transacções (exclusão) podem falhar; use mysql2 directo.'
    );
  }

  return { alvo, host, port, vps };
}

/** @param {string} [repoRoot] */
function carregarPasswordDockerSeVazia(repoRoot) {
  if (process.env.VILAREAL_MYSQL_PASSWORD) return;
  const root = repoRoot || path.resolve(process.cwd(), '..');
  const envDocker = path.join(root, '.env.docker');
  if (!fs.existsSync(envDocker)) return;
  const text = fs.readFileSync(envDocker, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^VILLAREAL_COMPOSE_JDBC_PASSWORD=(.+)$/);
    if (m) {
      let val = m[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env.VILAREAL_MYSQL_PASSWORD = val;
      return;
    }
  }
}
