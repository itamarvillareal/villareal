/**
 * Ligação MySQL para scripts de manutenção (env ou Docker).
 *
 * Envs: VILAREAL_MYSQL_HOST, VILAREAL_MYSQL_PORT, VILAREAL_MYSQL_USER,
 *       VILAREAL_MYSQL_PASSWORD, VILAREAL_MYSQL_DATABASE,
 *       VILAREAL_MYSQL_DOCKER (ex.: vilareal-db → usa `docker exec` sem mysql2).
 *
 * Porta defeito **3307** (MySQL local oficial `vilareal-db`, mesmo que `application-dev`).
 * Com `VILAREAL_MYSQL_DOCKER=vilareal-db` ignora host/porta e usa `docker exec`.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** @returns {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} */
export async function conectarMysqlVilareal() {
  const docker = process.env.VILAREAL_MYSQL_DOCKER?.trim();
  if (docker) {
    return new DockerMysqlAdapter(docker, resolverCredenciais());
  }
  let mysql;
  try {
    mysql = await import('mysql2/promise');
  } catch {
    throw new Error(
      'Pacote mysql2 não instalado. Corra `npm install` em e-vilareal-react-web ou defina VILAREAL_MYSQL_DOCKER=vilareal-db'
    );
  }
  const cred = resolverCredenciais();
  return mysql.createConnection({
    host: cred.host,
    port: cred.port,
    user: cred.user,
    password: cred.password,
    database: cred.database,
    timezone: 'Z',
    multipleStatements: false,
  });
}

function resolverCredenciais() {
  return {
    host: process.env.VILAREAL_MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.VILAREAL_MYSQL_PORT || '3307'),
    user: process.env.VILAREAL_MYSQL_USER || 'root',
    password: process.env.VILAREAL_MYSQL_PASSWORD ?? 'root',
    database: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
  };
}

/**
 * Adaptador mínimo compatível com mysql2/promise para scripts read-only simples.
 * Transações: não suportadas — use mysql2 directo em produção.
 */
export class DockerMysqlAdapter {
  /** @param {string} container @param {{ host: string, port: number, user: string, password: string, database: string }} cred */
  constructor(container, cred) {
    this.container = container;
    this.cred = cred;
  }

  /** @param {string} sql @param {unknown[]} [params] */
  async query(sql, params = []) {
    const { sql: bound, vals } = bindParams(sql, params);
    const args = [
      'exec',
      this.container,
      'mysql',
      `-u${this.cred.user}`,
      `-p${this.cred.password}`,
      '--batch',
      '--raw',
      '--default-character-set=utf8mb4',
      this.cred.database,
      '-e',
      bound,
    ];
    const { stdout } = await execFileAsync('docker', args, {
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    });
    return parseMysqlBatchOutput(stdout, sql);
  }

  async beginTransaction() {
    throw new Error('DockerMysqlAdapter não suporta transacções; use mysql2 (remova VILAREAL_MYSQL_DOCKER).');
  }

  async commit() {
    /* noop */
  }

  async rollback() {
    /* noop */
  }

  async end() {
    /* noop */
  }
}

/** @param {string} sql @param {unknown[]} params */
function bindParams(sql, params) {
  if (!params.length) return { sql, vals: [] };
  let i = 0;
  const vals = [];
  const bound = sql.replace(/\?/g, () => {
    const v = params[i++];
    vals.push(v);
    return escapeSqlLiteral(v);
  });
  return { sql: bound, vals };
}

/** @param {unknown} v */
function escapeSqlLiteral(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/** @param {string} stdout @param {string} sql */
function parseMysqlBatchOutput(stdout, sql) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [[]];
  }
  const lower = sql.trim().toLowerCase();
  if (lower.startsWith('select')) {
    const lines = trimmed.split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).map((line) => {
      const cols = line.split('\t');
      /** @type {Record<string, string | null>} */
      const row = {};
      headers.forEach((h, idx) => {
        const val = cols[idx];
        row[h] = val === undefined || val === 'NULL' ? null : val;
      });
      return row;
    });
    return [rows];
  }
  return [{ affectedRows: 0 }];
}
