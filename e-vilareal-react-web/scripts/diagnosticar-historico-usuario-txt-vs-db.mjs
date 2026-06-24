#!/usr/bin/env node
/**
 * Diagnóstico: andamentos sem responsável (coluna Usuário) vs txt tipo 17 (Dropbox).
 *
 * Uso:
 *   node scripts/diagnosticar-historico-usuario-txt-vs-db.mjs --cliente=149 --processo=192
 *   node scripts/diagnosticar-historico-usuario-txt-vs-db.mjs
 *   node scripts/diagnosticar-historico-usuario-txt-vs-db.mjs --gravar-vps
 *   node scripts/diagnosticar-historico-usuario-txt-vs-db.mjs --incluir-com-usuario
 *
 * Saída:
 *   tmp/historico-usuario-reimport-diagnostico.json
 *   tmp/historico-usuario-reimport-diagnostico.csv
 *
 * VPS MySQL: SSH root@161.97.175.73 ou VILAREAL_MYSQL_* com túnel 3308.
 */

import './lib/load-vilareal-import-env.mjs';

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatProcNomeArquivo, lerMaxIndiceHistorico } from './lib/historico-local-txt-paths.mjs';
import { iterarEntradasHistoricoLocal } from './lib/historico-local-txt-iterar.mjs';
import {
  diagnosticarAndamentoUsuario,
  extrairUsuarioExibicaoDb,
  indexarEsperadosTxt,
  mapaUsuariosFromApi,
  resolverEsperadoTxtParaAndamento,
} from './lib/historico-usuario-txt-vs-db.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    base: resolverBaseBancoDados(),
    relatorio: null,
    csv: null,
    gravarVps: false,
    mysqlLocal: false,
    incluirComUsuario: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    vpsSshKey: process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'villareal_vps'),
    dbName: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dbUser: process.env.VILAREAL_MYSQL_USER || 'root',
    dbPass: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
    usarMysqlLocal: false,
  };
  for (const a of argv) {
    if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a.startsWith('--processo=')) out.processo = Number(a.slice(11));
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--csv=')) out.csv = a.slice(6);
    else if (a === '--gravar-vps') out.gravarVps = true;
    else if (a === '--mysql-local') out.mysqlLocal = true;
    else if (a === '--incluir-com-usuario') out.incluirComUsuario = true;
  }
  out.usarMysqlLocal = out.mysqlLocal;
  return out;
}

const SQL_ANDAMENTOS = `
SELECT
  pa.id AS andamento_id,
  pa.processo_id,
  pa.movimento_em,
  pa.titulo,
  pa.detalhe,
  pa.usuario_id,
  u.login AS usuario_login,
  u.apelido AS usuario_apelido,
  u.nome AS usuario_nome,
  LPAD(TRIM(c.codigo_cliente), 8, '0') AS codigo_cliente,
  p.numero_interno
FROM processo_andamento pa
INNER JOIN processo p ON p.id = pa.processo_id
INNER JOIN cliente c ON c.id = p.cliente_id
LEFT JOIN usuarios u ON u.id = pa.usuario_id
`.trim();

const SQL_USUARIOS = `
SELECT id, login, nome, apelido, ativo
FROM usuarios
WHERE ativo = 1 OR ativo IS NULL
`.trim();

/** @returns {Promise<{ andamentos: any[], usuarios: any[] }>} */
async function carregarEstadoDb(opts) {
  if (opts.usarMysqlLocal) {
    const conn = await conectarMysqlVilareal();
    try {
      const [andamentos] = await conn.query(`${SQL_ANDAMENTOS} ORDER BY pa.id`);
      const [usuarios] = await conn.query(SQL_USUARIOS);
      return { andamentos, usuarios };
    } finally {
      await conn.end();
    }
  }

  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) {
    sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  }

  const run = async (sql) => {
    const { stdout } = await execFileAsync(
      'ssh',
      [...sshArgs, opts.vpsHost, `mysql -u ${opts.dbUser} -p${opts.dbPass} -N -B -e "${sql.replace(/\n/g, ' ')}" ${opts.dbName}`],
      { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' },
    );
    return stdout;
  };

  const parseTsv = (stdout, cols) => {
    /** @type {any[]} */
    const rows = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      /** @type {Record<string, string|null>} */
      const row = {};
      cols.forEach((c, i) => {
        row[c] = parts[i] === undefined || parts[i] === 'NULL' ? null : parts[i];
      });
      rows.push(row);
    }
    return rows;
  };

  const andStdout = await run(`${SQL_ANDAMENTOS} ORDER BY pa.id`);
  const usrStdout = await run(SQL_USUARIOS);

  return {
    andamentos: parseTsv(andStdout, [
      'andamento_id',
      'processo_id',
      'movimento_em',
      'titulo',
      'detalhe',
      'usuario_id',
      'usuario_login',
      'usuario_apelido',
      'usuario_nome',
      'codigo_cliente',
      'numero_interno',
    ]),
    usuarios: parseTsv(usrStdout, ['id', 'login', 'nome', 'apelido', 'ativo']),
  };
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {ReturnType<typeof montarRelatorio>} rel @param {string} csvPath */
function escreverCsv(rel, csvPath) {
  const lines = [
    [
      'codigo_cliente',
      'numero_interno',
      'andamento_id',
      'indice_txt',
      'usuario_txt',
      'usuario_db',
      'usuario_id_novo',
      'motivos',
      'titulo_resumo',
    ].join(','),
  ];
  for (const d of rel.andamentos_afetados) {
    lines.push(
      [
        d.codigo_cliente,
        d.numero_interno,
        d.andamento_id,
        d.indice_txt ?? '',
        d.usuario_txt ?? '',
        d.usuario_db ?? '',
        d.usuario_id_novo ?? '',
        d.motivos.join('|'),
        d.titulo_resumo ?? '',
      ].map(csvEscape).join(','),
    );
  }
  fs.mkdirSync(path.dirname(path.resolve(csvPath)), { recursive: true });
  fs.writeFileSync(csvPath, `${lines.join('\n')}\n`);
}

/**
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {{ andamentos: any[], usuarios: any[] }} db
 */
function montarRelatorio(opts, db) {
  const mapaUsuarios = mapaUsuariosFromApi(
    db.usuarios.map((u) => ({ ...u, id: Number(u.id), ativo: u.ativo !== '0' })),
  );

  /** @type {Map<string, any[]>} */
  const porPar = new Map();
  for (const row of db.andamentos) {
    if (opts.cliente != null && Number(row.codigo_cliente) !== Number(String(opts.cliente).padStart(8, '0'))) {
      continue;
    }
    if (opts.processo != null && Number(row.numero_interno) !== Number(opts.processo)) continue;
    if (!opts.incluirComUsuario && extrairUsuarioExibicaoDb(row)) continue;
    const key = `${row.codigo_cliente}|${row.numero_interno}`;
    const lista = porPar.get(key) ?? [];
    lista.push(row);
    porPar.set(key, lista);
  }

  /** @type {any[]} */
  const andamentosAfetados = [];
  /** @type {any[]} */
  const pares = [];

  let paresProcessados = 0;
  const totalPares = porPar.size;

  for (const [key, rows] of porPar.entries()) {
    paresProcessados += 1;
    if (paresProcessados % 100 === 0) {
      console.log(`[historico-usuario] pares processados: ${paresProcessados}/${totalPares}…`);
    }
    const [codigoCliente, numeroInternoStr] = key.split('|');
    const codNum = Number.parseInt(codigoCliente, 10);
    const numeroInterno = Number(numeroInternoStr);
    const procStr = formatProcNomeArquivo(numeroInterno);
    if (!procStr || lerMaxIndiceHistorico(opts.base, codigoCliente, codNum, procStr) == null) continue;

    const entradas = [
      ...iterarEntradasHistoricoLocal({
        base: opts.base,
        filtroClienteCod: codNum,
        filtroProcesso: numeroInterno,
      }),
    ];
    const { mapaEstrito, mapaDataDia } = indexarEsperadosTxt(entradas);

    /** @type {Set<string>} */
    const motivosPar = new Set();
    let afetados = 0;

    const rowsSemUsuario = opts.incluirComUsuario
      ? rows
      : rows.filter((row) => !extrairUsuarioExibicaoDb(row));
    if (!rowsSemUsuario.length) continue;

    for (const row of rowsSemUsuario) {
      const { esperado, match } = resolverEsperadoTxtParaAndamento(mapaEstrito, mapaDataDia, row);
      if (!esperado) continue;

      const diag = diagnosticarAndamentoUsuario(esperado, row, mapaUsuarios);
      if (!diag.precisaAtualizacao || !diag.patch) continue;

      afetados += 1;
      for (const m of diag.motivos) motivosPar.add(m);

      andamentosAfetados.push({
        andamento_id: Number(row.andamento_id),
        processo_id: Number(row.processo_id),
        codigo_cliente: codigoCliente,
        numero_interno: numeroInterno,
        indice_txt: diag.patch.indice_txt,
        movimento_em: row.movimento_em,
        titulo_resumo: String(row.titulo ?? '').slice(0, 200),
        usuario_txt: diag.patch.usuario_txt,
        usuario_db: diag.motivos.includes('sem_usuario_db') ? '' : null,
        usuario_id_antigo: row.usuario_id != null ? Number(row.usuario_id) : null,
        usuario_id_novo: diag.patch.usuario_id_novo,
        detalhe_antigo: row.detalhe,
        detalhe_novo: diag.patch.detalhe_novo,
        motivos: diag.motivos,
        match_txt: match,
        precisa_atualizacao: true,
      });
    }

    if (afetados > 0) {
      pares.push({
        codigo_cliente: codigoCliente,
        numero_interno: numeroInterno,
        processo_id: Number(rows[0]?.processo_id),
        andamentos_db: rows.length,
        entradas_txt: entradas.length,
        andamentos_afetados: afetados,
        motivos_resumo: [...motivosPar].sort(),
        precisa_atualizacao: true,
      });
    }
  }

  andamentosAfetados.sort((a, b) => {
    const c = a.codigo_cliente.localeCompare(b.codigo_cliente);
    if (c !== 0) return c;
    const p = a.numero_interno - b.numero_interno;
    if (p !== 0) return p;
    return a.andamento_id - b.andamento_id;
  });

  pares.sort((a, b) => {
    const c = a.codigo_cliente.localeCompare(b.codigo_cliente);
    if (c !== 0) return c;
    return a.numero_interno - b.numero_interno;
  });

  console.log(`[historico-usuario] pares com andamento sem usuário: ${porPar.size}`);

  return {
    geradoEm: new Date().toISOString(),
    baseTxt: opts.base,
    fonteDb: opts.usarMysqlLocal ? 'mysql_local' : `ssh:${opts.vpsHost}`,
    tabelaAlvo: 'processo_andamento',
    tabelasDiagnostico: [
      'processo_andamento_usuario_reimport_diag',
      'processo_andamento_usuario_reimport_par',
    ],
    resumo: {
      pares_db: porPar.size,
      pares_afetados: pares.length,
      andamentos_afetados: andamentosAfetados.length,
      motivos: contarMotivos(andamentosAfetados),
    },
    pares,
    andamentos_afetados: andamentosAfetados,
  };
}

/** @param {Array<{ motivos: string[] }>} rows */
function contarMotivos(rows) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const r of rows) {
    for (const m of r.motivos) out[m] = (out[m] || 0) + 1;
  }
  return out;
}

function sqlEscape(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/** @param {ReturnType<typeof montarRelatorio>} rel @param {ReturnType<typeof parseArgs>} opts */
async function gravarDiagnosticoVps(rel, opts) {
  const conn = opts.usarMysqlLocal ? await conectarMysqlVilareal() : null;

  const runSql = async (sql) => {
    if (conn) {
      await conn.query(sql);
      return;
    }
    const sshArgs = [];
    if (fs.existsSync(opts.vpsSshKey)) {
      sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
    }
    sshArgs.push(opts.vpsHost, `mysql -u ${opts.dbUser} -p${opts.dbPass} ${opts.dbName} -e ${JSON.stringify(sql)}`);
    await execFileAsync('ssh', sshArgs, { maxBuffer: 64 * 1024 * 1024 });
  };

  await runSql('TRUNCATE TABLE processo_andamento_usuario_reimport_diag');
  await runSql('TRUNCATE TABLE processo_andamento_usuario_reimport_par');

  if (conn) {
    for (const d of rel.andamentos_afetados) {
      await conn.query(
        `INSERT INTO processo_andamento_usuario_reimport_diag (
          andamento_id, processo_id, codigo_cliente, numero_interno, indice_txt,
          movimento_em, titulo_resumo, usuario_txt, usuario_db,
          usuario_id_antigo, usuario_id_novo, detalhe_antigo, detalhe_novo,
          motivos, precisa_atualizacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), 1)`,
        [
          d.andamento_id,
          d.processo_id,
          d.codigo_cliente,
          d.numero_interno,
          d.indice_txt,
          d.movimento_em,
          d.titulo_resumo,
          d.usuario_txt,
          d.usuario_db,
          d.usuario_id_antigo,
          d.usuario_id_novo,
          d.detalhe_antigo,
          d.detalhe_novo,
          JSON.stringify(d.motivos),
        ],
      );
    }
    for (const p of rel.pares) {
      await conn.query(
        `INSERT INTO processo_andamento_usuario_reimport_par (
          codigo_cliente, numero_interno, processo_id,
          andamentos_db, entradas_txt, andamentos_afetados,
          motivos_resumo, precisa_atualizacao
        ) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), 1)`,
        [
          p.codigo_cliente,
          p.numero_interno,
          p.processo_id,
          p.andamentos_db,
          p.entradas_txt,
          p.andamentos_afetados,
          JSON.stringify(p.motivos_resumo),
        ],
      );
    }
    await conn.end();
    return;
  }

  const chunks = ['SET NAMES utf8mb4;', 'START TRANSACTION;'];
  for (const d of rel.andamentos_afetados) {
    const motivos = JSON.stringify(d.motivos).replace(/'/g, "''");
    chunks.push(`INSERT INTO processo_andamento_usuario_reimport_diag (
      andamento_id, processo_id, codigo_cliente, numero_interno, indice_txt,
      movimento_em, titulo_resumo, usuario_txt, usuario_db,
      usuario_id_antigo, usuario_id_novo, detalhe_antigo, detalhe_novo,
      motivos, precisa_atualizacao
    ) VALUES (
      ${d.andamento_id}, ${d.processo_id}, '${d.codigo_cliente}', ${d.numero_interno},
      ${d.indice_txt ?? 'NULL'},
      ${d.movimento_em ? sqlEscape(d.movimento_em) : 'NULL'},
      ${sqlEscape(d.titulo_resumo)},
      ${sqlEscape(d.usuario_txt)},
      ${d.usuario_db == null ? 'NULL' : sqlEscape(d.usuario_db)},
      ${d.usuario_id_antigo ?? 'NULL'},
      ${d.usuario_id_novo ?? 'NULL'},
      ${sqlEscape(d.detalhe_antigo)},
      ${sqlEscape(d.detalhe_novo)},
      '${motivos}', 1
    );`);
  }
  for (const p of rel.pares) {
    const motivos = JSON.stringify(p.motivos_resumo).replace(/'/g, "''");
    chunks.push(`INSERT INTO processo_andamento_usuario_reimport_par (
      codigo_cliente, numero_interno, processo_id,
      andamentos_db, entradas_txt, andamentos_afetados,
      motivos_resumo, precisa_atualizacao
    ) VALUES (
      '${p.codigo_cliente}', ${p.numero_interno}, ${p.processo_id},
      ${p.andamentos_db}, ${p.entradas_txt}, ${p.andamentos_afetados},
      '${motivos}', 1
    );`);
  }
  chunks.push('COMMIT;');

  const tmp = path.join(os.tmpdir(), `vilareal-historico-usuario-diag-${Date.now()}.sql`);
  fs.writeFileSync(tmp, chunks.join('\n'));
  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) {
    sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  }
  const remote = `/tmp/vilareal-historico-usuario-diag-${Date.now()}.sql`;
  await execFileAsync('scp', [...sshArgs, tmp, `${opts.vpsHost}:${remote}`]);
  await execFileAsync('ssh', [
    ...sshArgs,
    opts.vpsHost,
    `mysql -u ${opts.dbUser} -p${opts.dbPass} ${opts.dbName} < ${remote} && rm -f ${remote}`,
  ]);
  fs.unlinkSync(tmp);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('[historico-usuario] carregando processo_andamento da VPS…');
  const db = await carregarEstadoDb(opts);
  console.log(`[historico-usuario] andamentos: ${db.andamentos.length} | usuários: ${db.usuarios.length}`);

  console.log('[historico-usuario] comparando com txt…');
  const rel = montarRelatorio(opts, db);

  console.log('\n=== RESUMO ===');
  console.log(`Tabela a atualizar: ${rel.tabelaAlvo}`);
  console.log(`Pares (cliente+proc) no banco: ${rel.resumo.pares_db}`);
  console.log(`Pares com divergência: ${rel.resumo.pares_afetados}`);
  console.log(`Andamentos a corrigir: ${rel.resumo.andamentos_afetados}`);
  console.log('Motivos:', rel.resumo.motivos);

  if (rel.pares.length) {
    console.log('\nPrimeiros 30 pares afetados:');
    for (const p of rel.pares.slice(0, 30)) {
      console.log(
        `  ${p.codigo_cliente} proc ${p.numero_interno} — ${p.andamentos_afetados}/${p.andamentos_db} andamento(s) [${p.motivos_resumo.join(', ')}]`,
      );
    }
    if (rel.pares.length > 30) console.log(`  … +${rel.pares.length - 30} pares`);
  }

  const defaultDir = path.join(path.dirname(opts.base), 'tmp');
  const relPath = opts.relatorio || path.join(defaultDir, 'historico-usuario-reimport-diagnostico.json');
  const csvPath = opts.csv || path.join(defaultDir, 'historico-usuario-reimport-diagnostico.csv');

  fs.mkdirSync(path.dirname(path.resolve(relPath)), { recursive: true });
  fs.writeFileSync(relPath, `${JSON.stringify(rel, null, 2)}\n`);
  escreverCsv(rel, csvPath);
  console.log(`\nRelatório: ${relPath}`);
  console.log(`CSV: ${csvPath}`);

  if (opts.gravarVps) {
    console.log('\n[historico-usuario] gravando tabelas de diagnóstico na VPS…');
    await gravarDiagnosticoVps(rel, opts);
    console.log('Diagnóstico gravado em processo_andamento_usuario_reimport_*');
    console.log('Próximo passo: ./scripts/vps-historico-usuario-reimport-dump-seletivo.sh --yes');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
