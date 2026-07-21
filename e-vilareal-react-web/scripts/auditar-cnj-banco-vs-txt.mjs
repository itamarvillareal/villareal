#!/usr/bin/env node
/**
 * Auditoria global: `processo.numero_cnj` no banco ↔ txt `5.1` (Dropbox).
 *
 * Classifica cada processo do banco com CNJ preenchido:
 *   - contaminado:  CNJ do banco pertence, no txt, a OUTRO cliente/processo,
 *                   e o processo tem txt 5.1 próprio com CNJ diferente (grave).
 *   - divergente:   txt 5.1 do próprio processo difere do banco (sem prova de contaminação;
 *                   pode ser atualização legítima feita em produção).
 *   - so_banco:     banco tem CNJ, processo sem txt 5.1 (cadastro novo em produção — ok).
 *   - duplicado_db: mesmo CNJ em 2+ processos no banco (pode ser legítimo: co-partes).
 *
 * Uso:
 *   node scripts/auditar-cnj-banco-vs-txt.mjs                # VPS via SSH
 *   node scripts/auditar-cnj-banco-vs-txt.mjs --mysql-local
 *   node scripts/auditar-cnj-banco-vs-txt.mjs --relatorio=tmp/auditoria-cnj-global.json
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { indexarCnj51Txt, normCnj } from './lib/cabecalho-processo-txt-audit.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const execFileAsync = promisify(execFile);

const SQL = `
SELECT
  p.id,
  TRIM(c.codigo_cliente) AS codigo_cliente,
  p.numero_interno,
  p.numero_cnj,
  p.descricao_acao,
  p.valor_causa,
  p.ativo
FROM processo p
INNER JOIN cliente c ON c.id = p.cliente_id
WHERE p.numero_cnj IS NOT NULL AND TRIM(p.numero_cnj) <> ''
ORDER BY c.codigo_cliente, p.numero_interno
`.trim();

function parseArgs(argv) {
  const out = {
    base: resolverBaseBancoDados(),
    mysqlLocal: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    vpsSshKey: process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'villareal_vps'),
    dbName: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dbUser: process.env.VILAREAL_MYSQL_USER || 'root',
    dbPass: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
    relatorio: null,
  };
  for (const a of argv) {
    if (a === '--mysql-local') out.mysqlLocal = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
  }
  return out;
}

/** @param {ReturnType<typeof parseArgs>} opts */
async function carregarProcessosDb(opts) {
  /** @type {object[]} */
  const rows = [];

  if (opts.mysqlLocal) {
    const conn = await conectarMysqlVilareal();
    try {
      const [res] = await conn.query(SQL);
      for (const r of res) rows.push(r);
    } finally {
      await conn.end();
    }
    return rows;
  }

  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  sshArgs.push(
    opts.vpsHost,
    `mysql -u ${opts.dbUser} -p${opts.dbPass} -N -B -e "${SQL.replace(/"/g, '\\"')}" ${opts.dbName}`
  );
  const { stdout } = await execFileAsync('ssh', sshArgs, {
    maxBuffer: 128 * 1024 * 1024,
    encoding: 'utf8',
  });
  const headers = ['id', 'codigo_cliente', 'numero_interno', 'numero_cnj', 'descricao_acao', 'valor_causa', 'ativo'];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    /** @type {Record<string, unknown>} */
    const row = {};
    headers.forEach((h, i) => {
      const v = cols[i];
      row[h] = v === undefined || v === 'NULL' ? null : v;
    });
    rows.push(row);
  }
  return rows;
}

/** CNJ padrão (NNNNNNN-DD.AAAA.J.TR.OOOO) — textos livres (ex. «AGUARDANDO») ficam fora da análise de duplicados. */
function pareceCnj(cnj) {
  return /^\d{6,7}-?\d{2}\.?\d{4}\./.test(String(cnj)) || /^\d{15,20}$/.test(String(cnj).replace(/\D/g, ''));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('\n=== Auditoria global CNJ — banco ↔ txt 5.1 ===');
  console.log(`Fonte txt: ${opts.base}`);
  console.log(`Fonte DB:  ${opts.mysqlLocal ? 'mysql-local' : opts.vpsHost}\n`);

  const { porCnj, porProcesso } = indexarCnj51Txt(opts.base);
  console.log(`[txt] ${porProcesso.size} processos com 5.1; ${porCnj.size} CNJs distintos\n`);

  const rows = await carregarProcessosDb(opts);
  console.log(`[db] ${rows.length} processos com numero_cnj preenchido\n`);

  /** @type {Map<string, object[]>} db CNJ → linhas */
  const dbPorCnj = new Map();
  for (const r of rows) {
    const cnj = normCnj(r.numero_cnj);
    if (!cnj) continue;
    const lista = dbPorCnj.get(cnj);
    if (lista) lista.push(r);
    else dbPorCnj.set(cnj, [r]);
  }

  /** @type {object[]} */
  const contaminados = [];
  /** @type {object[]} */
  const divergentes = [];
  /** @type {object[]} */
  const soBanco = [];

  for (const r of rows) {
    const cod8 = String(r.codigo_cliente).padStart(8, '0');
    const ni = Number(r.numero_interno);
    const chave = `${cod8}|${ni}`;
    const cnjDb = normCnj(r.numero_cnj);
    const txtProprio = porProcesso.get(chave) ?? null;
    const donosTxt = cnjDb ? (porCnj.get(cnjDb) ?? []) : [];

    const donoProprio = donosTxt.some((d) => d.cod8 === cod8 && d.numeroInterno === ni);
    const donosOutros = donosTxt.filter((d) => !(d.cod8 === cod8 && d.numeroInterno === ni));

    if (!txtProprio) {
      if (donosOutros.length > 0 && !donoProprio) {
        // Sem 5.1 próprio mas o CNJ é de outro processo no txt — suspeito, mas pode ser co-parte nova.
        soBanco.push({
          ...resumo(r, cod8, ni),
          cnjDb,
          donosTxtOutros: donosOutros.map((d) => `${d.cod8}/${d.numeroInterno}`),
          nota: 'sem_txt_51_mas_cnj_pertence_a_outro_txt',
        });
      }
      continue;
    }

    const cnjTxt = txtProprio.cnj;
    if (cnjTxt === cnjDb) continue; // fiel ao txt

    if (donosOutros.length > 0 && !donoProprio) {
      contaminados.push({
        ...resumo(r, cod8, ni),
        cnjDb,
        cnjTxt,
        donoCnjDbNoTxt: donosOutros.map((d) => `${d.cod8}/${d.numeroInterno}`),
        arquivoTxt: txtProprio.arquivo,
      });
    } else {
      divergentes.push({
        ...resumo(r, cod8, ni),
        cnjDb,
        cnjTxt,
        arquivoTxt: txtProprio.arquivo,
      });
    }
  }

  /** @type {object[]} */
  const duplicadosDb = [];
  for (const [cnj, lista] of dbPorCnj) {
    if (lista.length < 2 || !pareceCnj(cnj)) continue;
    const clientes = new Set(lista.map((r) => String(r.codigo_cliente)));
    duplicadosDb.push({
      cnj,
      qtd: lista.length,
      clientesDistintos: clientes.size,
      processos: lista.map((r) => `${String(r.codigo_cliente).padStart(8, '0')}/${r.numero_interno} (id=${r.id})`),
      donosTxt: (porCnj.get(cnj) ?? []).map((d) => `${d.cod8}/${d.numeroInterno}`),
    });
  }
  duplicadosDb.sort((a, b) => b.clientesDistintos - a.clientesDistintos || b.qtd - a.qtd);

  console.log('--- Resultado ---');
  console.log(`  CONTAMINADOS (CNJ de outro processo no lugar do próprio): ${contaminados.length}`);
  for (const c of contaminados) {
    console.log(
      `    ${c.processo} (id=${c.id}) db=${c.cnjDb} ← pertence a ${c.donoCnjDbNoTxt.join(', ')}; txt próprio=${c.cnjTxt}`
    );
  }
  console.log(`  DIVERGENTES (txt ≠ banco, sem prova de contaminação): ${divergentes.length}`);
  console.log(`  SÓ BANCO com CNJ de outro txt (sem 5.1 próprio): ${soBanco.length}`);
  console.log(`  CNJs duplicados no banco (formato válido): ${duplicadosDb.length}`);
  console.log('');

  const payload = {
    geradoEm: new Date().toISOString(),
    fonteTxt: opts.base,
    fonteDb: opts.mysqlLocal ? 'mysql-local' : opts.vpsHost,
    totais: {
      processosDbComCnj: rows.length,
      processosTxtCom51: porProcesso.size,
      contaminados: contaminados.length,
      divergentes: divergentes.length,
      soBancoSuspeitos: soBanco.length,
      duplicadosDb: duplicadosDb.length,
    },
    contaminados,
    divergentes,
    soBancoSuspeitos: soBanco,
    duplicadosDb,
  };

  const relPath = opts.relatorio ?? path.join(process.cwd(), 'tmp', 'auditoria-cnj-global.json');
  fs.mkdirSync(path.dirname(relPath), { recursive: true });
  fs.writeFileSync(relPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Relatório: ${relPath}\n`);
}

function resumo(r, cod8, ni) {
  return {
    processo: `${cod8}/${ni}`,
    id: Number(r.id),
    descricaoAcao: r.descricao_acao ?? null,
    ativo: String(r.ativo) === '1' || r.ativo === 1 || r.ativo === true,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
