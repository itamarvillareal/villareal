#!/usr/bin/env node
/**
 * Lê **somente** `Banco de Dados/Proc/` — txt `*.0.89.1.*` (vínculo processo → imóvel).
 * Varredura com `fs.Dirent`; conteúdo = nº planilha (col. A) → `imovel.numero_planilha`
 * + `imovel.processo_id` (campo «Imóvel» em Processos).
 *
 * Padrão: `{cod8}.0.89.1.{numeroInterno}.txt` em `Proc/1000/…` ou `Proc/0/…`.
 *
 * Uso:
 *   node scripts/ler-vinculos-imovel-proc-0891-txt.mjs
 *   node scripts/ler-vinculos-imovel-proc-0891-txt.mjs --cliente=728
 *   node scripts/ler-vinculos-imovel-proc-0891-txt.mjs --somente-faltantes
 *   node scripts/ler-vinculos-imovel-proc-0891-txt.mjs --csv=tmp/vinculos-0891-auditoria.csv
 *   VILAREAL_IMPORT_SENHA='…' node scripts/ler-vinculos-imovel-proc-0891-txt.mjs --aplicar
 *   VILAREAL_IMPORT_SENHA='…' node scripts/ler-vinculos-imovel-proc-0891-txt.mjs --aplicar --forcar
 *
 * `--base=` aceita a raiz «Banco de Dados» ou a pasta `Proc` (sempre normalizada para `…/Proc`).
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  levantarVinculosImovelProc,
  resolverBaseProc,
  validarRaizProc,
} from './lib/proc-imovel-vinculo-txt.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {
    baseProc: resolverBaseProc(),
    clienteFiltro: null,
    somenteFaltantes: false,
    incluirTxtInvalidos: false,
    csv: null,
    relatorio: path.join(process.cwd(), 'tmp', 'vinculos-imovel-0891-auditoria.json'),
    aplicar: false,
    forcar: false,
    limiteAmostra: 30,
  };
  for (const a of argv) {
    if (a === '--somente-faltantes') out.somenteFaltantes = true;
    else if (a === '--incluir-txt-invalidos') out.incluirTxtInvalidos = true;
    else if (a === '--aplicar') out.aplicar = true;
    else if (a === '--forcar') out.forcar = true;
    else if (a.startsWith('--base=') || a.startsWith('--base-proc=')) {
      const raw = a.startsWith('--base=') ? a.slice(7) : a.slice(12);
      out.baseProc = validarRaizProc(raw);
    } else if (a.startsWith('--cliente=')) {
      const n = Number.parseInt(a.slice(10), 10);
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--csv=')) out.csv = path.resolve(a.slice(6));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--limite-amostra=')) {
      out.limiteAmostra = Math.max(0, Number.parseInt(a.slice(17), 10) || 30);
    }
  }
  return out;
}

function padCod8(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  return d.padStart(8, '0').slice(-8);
}

function escapeCsv(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

/**
 * @param {import('mysql2/promise').Connection | import('./lib/mysql-vilareal.mjs').DockerMysqlAdapter} conn
 */
async function carregarIndicesMysql(conn) {
  const clientePorCod8 = new Map();
  const [rowsCliente] = await conn.query(
    `SELECT id, pessoa_id, TRIM(codigo_cliente) AS codigo_cliente
     FROM cliente`
  );
  for (const r of rowsCliente) {
    const cod8 = padCod8(r.codigo_cliente);
    if (!cod8) continue;
    if (!clientePorCod8.has(cod8)) {
      clientePorCod8.set(cod8, {
        clienteId: Number(r.id),
        pessoaId: Number(r.pessoa_id),
      });
    }
  }

  const [rowsPlanilha] = await conn.query(
    `SELECT chave_cliente, pessoa_id FROM planilha_pasta1_cliente`
  );
  const pessoaPorCod8Planilha = new Map();
  for (const r of rowsPlanilha) {
    const cod8 = padCod8(r.chave_cliente);
    if (!cod8 || pessoaPorCod8Planilha.has(cod8)) continue;
    pessoaPorCod8Planilha.set(cod8, Number(r.pessoa_id));
  }

  const processoPorClienteNi = new Map();
  const processoPorPessoaNi = new Map();
  const [rowsProc] = await conn.query(
    `SELECT id, numero_interno, cliente_id, pessoa_id FROM processo`
  );
  for (const r of rowsProc) {
    const ni = Number(r.numero_interno);
    const procId = Number(r.id);
    if (!Number.isFinite(ni) || ni < 1) continue;
    if (r.cliente_id != null) {
      const k = `${Number(r.cliente_id)}|${ni}`;
      if (!processoPorClienteNi.has(k)) processoPorClienteNi.set(k, procId);
    }
    if (r.pessoa_id != null) {
      const k = `${Number(r.pessoa_id)}|${ni}`;
      if (!processoPorPessoaNi.has(k)) processoPorPessoaNi.set(k, procId);
    }
  }

  const imovelPorClienteNp = new Map();
  const imovelPorPessoaNp = new Map();
  const imovelPorNumeroPlanilha = new Map();
  const [rowsImovel] = await conn.query(
    `SELECT id, numero_planilha, processo_id, cliente_id, pessoa_id
     FROM imovel
     WHERE numero_planilha IS NOT NULL`
  );
  for (const r of rowsImovel) {
    const np = Number(r.numero_planilha);
    const imovelId = Number(r.id);
    if (!Number.isFinite(np) || np < 1) continue;
    const entry = {
      imovelId,
      processoId: r.processo_id != null ? Number(r.processo_id) : null,
      numeroPlanilha: np,
      clienteId: r.cliente_id != null ? Number(r.cliente_id) : null,
      pessoaId: r.pessoa_id != null ? Number(r.pessoa_id) : null,
    };
    if (!imovelPorNumeroPlanilha.has(np)) {
      imovelPorNumeroPlanilha.set(np, []);
    }
    imovelPorNumeroPlanilha.get(np).push(entry);
    if (r.cliente_id != null) {
      const k = `${Number(r.cliente_id)}|${np}`;
      if (!imovelPorClienteNp.has(k)) imovelPorClienteNp.set(k, entry);
    }
    if (r.pessoa_id != null) {
      const k = `${Number(r.pessoa_id)}|${np}`;
      if (!imovelPorPessoaNp.has(k)) imovelPorPessoaNp.set(k, entry);
    }
  }

  return {
    clientePorCod8,
    pessoaPorCod8Planilha,
    processoPorClienteNi,
    processoPorPessoaNi,
    imovelPorClienteNp,
    imovelPorPessoaNp,
    imovelPorNumeroPlanilha,
  };
}

/**
 * @param {string} cod8
 * @param {Awaited<ReturnType<typeof carregarIndicesMysql>>} idx
 */
function resolverCliente(cod8, idx) {
  const hit = idx.clientePorCod8.get(cod8);
  if (hit) return { ...hit, origem: 'cliente' };
  const pessoaId = idx.pessoaPorCod8Planilha.get(cod8);
  if (pessoaId != null) {
    return { clienteId: null, pessoaId, origem: 'planilha_pasta1' };
  }
  const n = Number.parseInt(cod8, 10);
  if (Number.isFinite(n) && n >= 1) {
    return { clienteId: null, pessoaId: n, origem: 'codigo_como_pessoa_id' };
  }
  return null;
}

/**
 * @param {object} reg — linha do txt
 * @param {Awaited<ReturnType<typeof carregarIndicesMysql>>} idx
 */
function auditarRegisto(reg, idx) {
  const base = {
    cod8: reg.cod8,
    numeroInterno: reg.numeroInterno,
    numeroPlanilhaTxt: reg.numeroPlanilha,
    textoBruto: reg.texto,
    avisoConteudo: reg.avisoConteudo,
    arquivo: reg.arquivo,
    relAposBanco: reg.relAposBanco,
    relAposProc: reg.relAposProc,
    origemPasta: reg.origem,
    status: 'ignorado',
    mensagem: '',
    clienteId: null,
    pessoaId: null,
    processoId: null,
    imovelId: null,
    processoIdNoBanco: null,
  };

  if (reg.numeroPlanilha == null) {
    base.status = 'txt_invalido';
    base.mensagem = reg.avisoConteudo ?? 'conteúdo sem número de imóvel';
    return base;
  }

  const cli = resolverCliente(reg.cod8, idx);
  if (!cli) {
    base.status = 'sem_cliente';
    base.mensagem = 'Código cliente sem linha em cliente/planilha';
    return base;
  }
  base.clienteId = cli.clienteId;
  base.pessoaId = cli.pessoaId;

  let processoId = null;
  if (cli.clienteId != null) {
    processoId = idx.processoPorClienteNi.get(`${cli.clienteId}|${reg.numeroInterno}`) ?? null;
  }
  if (processoId == null && cli.pessoaId != null) {
    processoId = idx.processoPorPessoaNi.get(`${cli.pessoaId}|${reg.numeroInterno}`) ?? null;
  }
  if (processoId == null) {
    base.status = 'sem_processo';
    base.mensagem = `Processo nº ${reg.numeroInterno} não encontrado no banco`;
    return base;
  }
  base.processoId = processoId;

  let imovel = null;
  if (cli.clienteId != null) {
    imovel = idx.imovelPorClienteNp.get(`${cli.clienteId}|${reg.numeroPlanilha}`) ?? null;
  }
  if (!imovel && cli.pessoaId != null) {
    imovel = idx.imovelPorPessoaNp.get(`${cli.pessoaId}|${reg.numeroPlanilha}`) ?? null;
  }

  if (!imovel) {
    const global = idx.imovelPorNumeroPlanilha.get(reg.numeroPlanilha) ?? [];
    if (global.length === 1) {
      base.status = 'sem_imovel_cliente';
      base.mensagem = `Existe imóvel planilha ${reg.numeroPlanilha} (id ${global[0].imovelId}) mas de outro cliente`;
      base.imovelId = global[0].imovelId;
      base.processoIdNoBanco = global[0].processoId;
      return base;
    }
    if (global.length > 1) {
      base.status = 'sem_imovel_cliente';
      base.mensagem = `Nº planilha ${reg.numeroPlanilha} ambíguo (${global.length} imóveis no banco)`;
      return base;
    }
    base.status = 'sem_imovel';
    base.mensagem = `Imóvel planilha ${reg.numeroPlanilha} não existe no banco`;
    return base;
  }

  base.imovelId = imovel.imovelId;
  base.processoIdNoBanco = imovel.processoId;

  if (imovel.processoId == null) {
    base.status = 'falta_vinculo';
    base.mensagem = 'Imóvel existe; processo_id NULL no banco';
    return base;
  }
  if (Number(imovel.processoId) === Number(processoId)) {
    base.status = 'ok';
    base.mensagem = 'Vínculo já gravado';
    return base;
  }
  base.status = 'conflito_processo';
  base.mensagem = `Imóvel vinculado ao processo ${imovel.processoId}, txt pede ${processoId}`;
  return base;
}

const STATUS_FALTA = new Set([
  'falta_vinculo',
  'sem_imovel',
  'sem_imovel_cliente',
  'conflito_processo',
]);

function imprimirResumo(resumo, amostras, limite) {
  console.log('\n=== Vínculos imóvel (somente Banco de Dados/Proc, txt 0.89.1) ===\n');
  console.log('Pasta Proc:', resumo.baseProc);
  console.log('Txt lidos (pares cod+proc):', resumo.totalTxt);
  console.log('Com nº planilha válido:', resumo.comNumeroPlanilha);
  console.log('Txt inválidos/vazios:', resumo.txtInvalidos);
  console.log('');
  for (const [k, v] of Object.entries(resumo.porStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('\nFaltam gravar (ação possível):', resumo.precisamAcao);
  if (limite > 0) {
    for (const [status, rows] of Object.entries(amostras)) {
      if (!rows.length) continue;
      console.log(`\n--- ${status} (até ${limite}) ---`);
      for (const r of rows.slice(0, limite)) {
        console.log(
          `  ${r.cod8} proc=${r.numeroInterno} imovel=${r.numeroPlanilhaTxt} → ${r.mensagem}`
        );
        if (r.arquivo) console.log(`    ${r.arquivo}`);
      }
    }
  }
}

function gravarCsv(linhas, destino) {
  const header =
    'status,codigoCliente,numeroInterno,numeroPlanilhaImovel,processoId,imovelId,processoIdNoBanco,mensagem,caminho\n';
  const body = linhas.map((r) =>
    [
      r.status,
      r.cod8,
      r.numeroInterno,
      r.numeroPlanilhaTxt ?? '',
      r.processoId ?? '',
      r.imovelId ?? '',
      r.processoIdNoBanco ?? '',
      escapeCsv(r.mensagem),
      escapeCsv(r.relAposBanco),
    ].join(',')
  );
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, header + body.join('\n') + '\n', 'utf8');
}

function executarImportacaoProc(opts) {
  if (!process.env.VILAREAL_IMPORT_SENHA) {
    console.error('\n[aplicar] Defina VILAREAL_IMPORT_SENHA.');
    process.exit(1);
  }
  const args = [
    path.join(__dirname, 'import-proc-imovel-vinculo-txt.mjs'),
    '--aplicar',
    `--base-proc=${opts.baseProc}`,
  ];
  if (opts.clienteFiltro != null) args.push(`--cliente=${opts.clienteFiltro}`);
  if (opts.forcar) args.push('--forcar');

  console.log(
    `\n[aplicar] Varre ${opts.baseProc} (Dirent), lê 0.89.1 e grava imovel.numero_planilha + processo_id…`
  );
  const run = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env,
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  opts.baseProc = validarRaizProc(opts.baseProc);

  if (!fs.existsSync(opts.baseProc)) {
    console.error('Pasta Proc não encontrada:', opts.baseProc);
    process.exit(1);
  }

  const todosTxt = levantarVinculosImovelProc(opts.baseProc, {
    clienteFiltro: opts.clienteFiltro,
  });

  if (opts.aplicar) {
    executarImportacaoProc(opts);
    return;
  }

  const conn = await conectarMysqlVilareal();
  try {
    const idx = await carregarIndicesMysql(conn);
    const linhas = todosTxt.map((reg) => auditarRegisto(reg, idx));

    const porStatus = {};
    const amostras = {};
    for (const l of linhas) {
      porStatus[l.status] = (porStatus[l.status] ?? 0) + 1;
      if (!amostras[l.status]) amostras[l.status] = [];
      amostras[l.status].push(l);
    }

    const precisamAcao = linhas.filter((l) => STATUS_FALTA.has(l.status));
    const txtInvalidos = linhas.filter((l) => l.status === 'txt_invalido').length;

    const resumo = {
      baseProc: opts.baseProc,
      clienteFiltro: opts.clienteFiltro,
      totalTxt: todosTxt.length,
      comNumeroPlanilha: linhas.filter((l) => l.numeroPlanilhaTxt != null).length,
      txtInvalidos,
      porStatus,
      precisamAcao: precisamAcao.length,
      ok: porStatus.ok ?? 0,
    };

    const exibir =
      opts.somenteFaltantes && !opts.incluirTxtInvalidos
        ? linhas.filter((l) => STATUS_FALTA.has(l.status))
        : opts.somenteFaltantes
          ? linhas.filter((l) => STATUS_FALTA.has(l.status) || l.status === 'txt_invalido')
          : linhas;

    imprimirResumo(resumo, amostras, opts.limiteAmostra);

    if (opts.csv) {
      gravarCsv(exibir, opts.csv);
      console.log('\nCSV:', opts.csv);
    }

    if (opts.relatorio) {
      fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
      fs.writeFileSync(
        opts.relatorio,
        JSON.stringify({ resumo, linhas: exibir }, null, 2),
        'utf8'
      );
      console.log('JSON:', opts.relatorio);
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
