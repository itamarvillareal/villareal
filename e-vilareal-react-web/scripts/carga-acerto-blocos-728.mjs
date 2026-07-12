/**
 * Backfill dos cards de acerto do cliente 728 (SE77E, id 729) — blocos zerados da aba
 * "LANÇ MANUAIS (2)" da planilha Extratos Bancos.
 *
 * Para cada bloco zerado com linhas REF 728:
 *   1. Cruza lançamentos na conta 19 pelo rowId em descricao_detalhada
 *   2. Aplica refs da planilha (proc, repasse) via PUT
 *   3. Pareia o bloco em grupo_compensacao CZ-B728-{primeiroRowId728}
 *
 * Tipos de bloco:
 *   OK      — só linhas 728, soma zero
 *   ESPELHO — linhas 728 + espelho(s) no mesmo bloco (ref vazia / letra E)
 *   MISTO   — multi-cliente (ex.: 7783) — pulado nesta leva
 *
 * Uso:
 *   node scripts/carga-acerto-blocos-728.mjs
 *   node scripts/carga-acerto-blocos-728.mjs --executar
 */

import './lib/load-vilareal-import-env.mjs';
import XLSX from 'xlsx';
import mysql from 'mysql2/promise';
import { requireExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';
import { excelSerialParaISO } from './lib/extrato-bancos-planilha-parse.mjs';
import { normalizarRefTipo } from './lib/extrato-bancos-planilha-parse.mjs';

const CLIENTE_ID = 729;
const COD_CLIENTE = '728';
const NUMERO_BANCO_CZ = 19;
const ABA = 'LANÇ MANUAIS (2)';
const PREFIXO_GRUPO = 'CZ-B728';
/** Blocos multi-cliente — revisão manual (Etapa 5d). */
const BLOCOS_PULAR = new Set([7783]);

function parseArgs(argv) {
  const out = { executar: false, baseUrl: 'http://localhost:8080' };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function brl(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function normalizarRef01(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d+\.0$/.test(s)) return s.slice(0, -2);
  return s;
}

async function login(baseUrl) {
  const loginUser = (process.env.VILAREAL_IMPORT_LOGIN || 'itamar').trim().toLowerCase();
  const senha = process.env.VILAREAL_IMPORT_SENHA || '';
  if (!senha) throw new Error('Defina VILAREAL_IMPORT_SENHA (ou .env.import.local).');
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginUser, senha }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

async function apiGet(ctx, path) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${ctx.token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function apiSend(ctx, method, path, body) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

function lerBlocos728() {
  const caminho = requireExtratoBancosPlanilhaXlsPath();
  const wb = XLSX.readFile(caminho, { cellDates: false });
  const nomeAba = wb.SheetNames.find((n) => n.trim().toUpperCase() === ABA.toUpperCase());
  if (!nomeAba) throw new Error(`Aba "${ABA}" não encontrada`);
  const ws = wb.Sheets[nomeAba];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

  const linhas = [];
  for (let r = 6; r <= range.e.r; r += 1) {
    const valor = cell(r, 7);
    const rowId = cell(r, 4);
    if (typeof valor !== 'number' || !Number.isFinite(valor) || typeof rowId !== 'number') continue;
    linhas.push({
      rowId,
      cents: Math.round(valor * 100),
      dataIso: excelSerialParaISO(cell(r, 3)),
      comentario: String(cell(r, 9) ?? '').trim(),
      procPlanilha: Number(cell(r, 12)) > 0 ? Math.trunc(Number(cell(r, 12))) : null,
      refTipo: normalizarRefTipo(cell(r, 13)),
      ref01: normalizarRef01(cell(r, 11)),
    });
  }

  const todosBlocos = [];
  let atual = [];
  let soma = 0;
  for (const l of linhas) {
    atual.push(l);
    soma += l.cents;
    if (soma === 0) {
      todosBlocos.push(atual);
      atual = [];
    }
  }

  const blocos = todosBlocos.filter((b) => b.some((l) => l.ref01 === COD_CLIENTE));
  return { caminho, blocos, foraDeBloco: atual.length };
}

function classificarBloco(bloco) {
  const linhas728 = bloco.filter((l) => l.ref01 === COD_CLIENTE);
  const outras = bloco.filter((l) => l.ref01 !== COD_CLIENTE);
  const soma728 = linhas728.reduce((s, l) => s + l.cents, 0) / 100;
  const somaOutras = outras.reduce((s, l) => s + l.cents, 0) / 100;
  const start728 = linhas728[0]?.rowId;

  if (BLOCOS_PULAR.has(start728)) {
    return { tipo: 'MISTO', linhas728, outras, linhasCard: linhas728, soma728, somaOutras, start728 };
  }

  if (Math.abs(soma728) < 0.005 && outras.length === 0) {
    return { tipo: 'OK', linhas728, outras, linhasCard: linhas728, soma728, somaOutras, start728 };
  }

  const refsOutras = new Set(outras.map((l) => l.ref01).filter(Boolean));
  if (refsOutras.size > 1 || (refsOutras.size === 1 && !refsOutras.has(''))) {
    return { tipo: 'MISTO', linhas728, outras, linhasCard: linhas728, soma728, somaOutras, start728 };
  }

  if (Math.abs(soma728 + somaOutras) < 0.005) {
    return {
      tipo: 'ESPELHO',
      linhas728,
      outras,
      linhasCard: bloco,
      soma728,
      somaOutras,
      start728,
    };
  }

  return { tipo: 'ERRO', linhas728, outras, linhasCard: linhas728, soma728, somaOutras, start728 };
}

async function conectarDb() {
  const host = process.env.VILAREAL_IMPORT_DB_HOST || '127.0.0.1';
  const port = Number(process.env.VILAREAL_IMPORT_DB_PORT || 3307);
  const user = process.env.VILAREAL_IMPORT_DB_USER || 'root';
  const password = process.env.VILAREAL_IMPORT_DB_PASSWORD || 'root';
  const database = process.env.VILAREAL_IMPORT_DB_NAME || 'vilareal';
  return mysql.createConnection({ host, port, user, password, database });
}

async function carregarLancamentosPorRowId(db) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.grupo_compensacao, fl.processo_id, fl.cliente_id, fl.pessoa_ref_id,
            fl.ref_tipo, fl.natureza, fl.valor,
            CAST(fl.descricao_detalhada AS CHAR) det, pr.numero_interno
     FROM financeiro_lancamento fl
     LEFT JOIN processo pr ON pr.id = fl.processo_id
     WHERE fl.numero_banco = ? AND fl.status = 'ATIVO'
       AND fl.descricao_detalhada REGEXP '^[0-9]+'`,
    [NUMERO_BANCO_CZ],
  );
  const porRowId = new Map();
  for (const r of rows) {
    const m = String(r.det).match(/^(\d+)/);
    if (!m) continue;
    const rowId = Number(m[1]);
    if (!porRowId.has(rowId)) porRowId.set(rowId, []);
    porRowId.get(rowId).push(r);
  }
  return porRowId;
}

async function resolverProcessoId(db, numeroInterno) {
  if (!numeroInterno) return null;
  const [rows] = await db.query(
    `SELECT p.id FROM processo p
     JOIN cliente c ON c.pessoa_id = p.pessoa_id
     WHERE c.id = ? AND p.numero_interno = ?
     ORDER BY p.id LIMIT 1`,
    [CLIENTE_ID, numeroInterno],
  );
  return rows[0]?.id ?? null;
}

async function atualizarLancamento(ctx, db, lancId, linhaPlanilha, { vincularCliente = false } = {}) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${lancId}`);
  let processoId = atual.processoId ?? null;
  if (linhaPlanilha?.procPlanilha != null) {
    const pid = await resolverProcessoId(db, linhaPlanilha.procPlanilha);
    if (pid) processoId = pid;
  }
  const refTipo = linhaPlanilha?.refTipo ?? atual.refTipo ?? 'N';
  const clienteId =
    vincularCliente || linhaPlanilha?.ref01 === COD_CLIENTE ? CLIENTE_ID : (atual.clienteId ?? null);
  const precisa =
    (linhaPlanilha?.procPlanilha != null && Number(atual.processoId) !== Number(processoId)) ||
    (linhaPlanilha?.refTipo && atual.refTipo !== refTipo) ||
    (vincularCliente && Number(atual.clienteId) !== CLIENTE_ID);
  if (!precisa) return false;
  if (!ctx.executar) return true;
  await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${lancId}`, {
    contaContabilId: atual.contaContabilId,
    clienteId,
    processoId,
    pessoaRefId: vincularCliente ? null : (atual.pessoaRefId ?? null),
    bancoNome: atual.bancoNome,
    numeroBanco: atual.numeroBanco,
    numeroLancamento: atual.numeroLancamento,
    dataLancamento: atual.dataLancamento,
    dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
    descricao: atual.descricao,
    descricaoDetalhada: atual.descricaoDetalhada,
    valor: atual.valor,
    natureza: atual.natureza,
    refTipo,
    origem: atual.origem ?? 'MANUAL',
    status: atual.status ?? 'ATIVO',
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    grupoCompensacao: atual.grupoCompensacao ?? null,
  });
  return true;
}

function resolverLancamento(porRowId, linha, idsUsados) {
  const cands = (porRowId.get(linha.rowId) ?? []).filter((r) => !idsUsados.includes(r.id));
  if (cands.length === 0) return { erro: `rowId ${linha.rowId} sem match na conta ${NUMERO_BANCO_CZ}` };
  const lanc = cands[0];
  const signed = (lanc.natureza === 'CREDITO' ? 1 : -1) * Number(lanc.valor);
  if (Math.round(signed * 100) !== linha.cents) {
    return {
      erro: `rowId ${linha.rowId} valor diverge: planilha ${linha.cents / 100} vs banco ${signed}`,
    };
  }
  return { lanc, signed };
}

async function main() {
  const args = parseArgs(process.argv);
  const { caminho, blocos } = lerBlocos728();
  console.log(`Planilha: ${caminho}`);
  console.log(`${blocos.length} blocos zerados com cliente ${COD_CLIENTE}`);

  const db = await conectarDb();
  const porRowId = await carregarLancamentosPorRowId(db);
  const token = await login(args.baseUrl);
  const ctx = {
    ...args,
    token,
    stats: { refs: 0, pareados: 0, pulados: 0, erros: 0, ok: 0, espelho: 0, misto: 0 },
  };

  for (const bloco of blocos) {
    const info = classificarBloco(bloco);
    if (info.linhas728.length === 0) continue;

    const grupo = `${PREFIXO_GRUPO}-${info.start728}`;
    const titulo =
      info.linhas728.find((l) => l.comentario)?.comentario || `Bloco ${info.start728}`;
    const ids = [];
    let soma = 0;
    let falhou = false;

    console.log(
      `\n== [${info.tipo}] ${grupo} (${info.linhas728.length} linhas 728 / ${bloco.length} bloco) — ${titulo.slice(0, 55)} ==`,
    );

    if (info.tipo === 'MISTO') {
      console.warn(`  · pulado (multi-cliente ou bloco ${info.start728} aguardando revisão)`);
      ctx.stats.misto += 1;
      continue;
    }

    if (info.tipo === 'ERRO') {
      console.warn(`  ! soma728=${brl(info.soma728)} somaOutras=${brl(info.somaOutras)} — ERRO`);
      ctx.stats.erros += 1;
      continue;
    }

    for (const linha of info.linhasCard) {
      const eh728 = linha.ref01 === COD_CLIENTE;
      const res = resolverLancamento(porRowId, linha, ids);
      if (res.erro) {
        console.warn(`  ! ${res.erro}`);
        ctx.stats.erros += 1;
        falhou = true;
        break;
      }
      const { lanc, signed } = res;
      const vincularCliente = !eh728;
      if (
        await atualizarLancamento(ctx, db, lanc.id, eh728 ? linha : null, { vincularCliente })
      ) {
        ctx.stats.refs += 1;
        const tag = vincularCliente ? 'espelho→728' : `proc ${linha.procPlanilha ?? '—'}`;
        console.log(`  · refs rowId ${linha.rowId} (${tag})`);
      }
      ids.push(lanc.id);
      soma = round2(soma + signed);
    }

    if (falhou || ids.length !== info.linhasCard.length) {
      console.warn(`  ! bloco incompleto — pareamento pulado`);
      continue;
    }
    if (Math.abs(soma) >= 0.005) {
      console.warn(`  ! soma ${brl(soma)} ≠ 0 — pareamento pulado`);
      ctx.stats.erros += 1;
      continue;
    }

    const jaGrupo = ids.every((id) => {
      const r = [...porRowId.values()].flat().find((x) => x.id === id);
      return r?.grupo_compensacao === grupo;
    });
    if (jaGrupo) {
      console.log(`  — já pareado em ${grupo}`);
      ctx.stats.pulados += 1;
      continue;
    }

    if (!ctx.executar) {
      console.log(`  [dry-run] parearia ${ids.length} lanç. em ${grupo}`);
      ctx.stats[info.tipo.toLowerCase()] += 1;
      continue;
    }

    await apiSend(ctx, 'POST', '/api/financeiro/lancamentos/parear-grupo', {
      lancamentoIds: ids,
      grupoCompensacao: grupo,
    });
    ctx.stats.pareados += 1;
    ctx.stats[info.tipo.toLowerCase()] += 1;
    console.log(`  ✓ pareado ${grupo} (${ids.length} lanç.)`);
  }

  await db.end();
  console.log('\nResumo:', ctx.stats);
  if (!ctx.executar) console.log('Use --executar para aplicar.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
