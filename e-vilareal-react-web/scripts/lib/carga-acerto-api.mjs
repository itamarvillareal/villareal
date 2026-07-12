/**
 * API/DB helpers para carga de cards de acerto (Etapa 5e).
 */

import mysql from 'mysql2/promise';
import { nomeGrupoCard } from './planilha-blocos-acerto.mjs';

export const NUMERO_BANCO_CZ = 19;
export const CONTA_18 = 18;
export const BANCO_NOME_CZ = 'CONTA ZERO';
export const MARCA_MIGRACAO = 'migrado da conta 18';
export const PESSOA_ESCRITORIO_NOME = 'ESCRITORIO - CONCILIACOES INTERNAS (CONTA ZERO)';

export function isLocalBackend(baseUrl) {
  try {
    const h = new URL(baseUrl).hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function brl(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function login(baseUrl) {
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

export async function apiGet(ctx, path) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${ctx.token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function apiSend(ctx, method, path, body) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${(await res.text()).slice(0, 400)}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function conectarDb() {
  const host = process.env.VILAREAL_IMPORT_DB_HOST || '127.0.0.1';
  const port = Number(process.env.VILAREAL_IMPORT_DB_PORT || 3307);
  const user = process.env.VILAREAL_IMPORT_DB_USER || 'root';
  const password = process.env.VILAREAL_IMPORT_DB_PASSWORD || 'root';
  const database = process.env.VILAREAL_IMPORT_DB_NAME || 'vilareal';
  return mysql.createConnection({ host, port, user, password, database });
}

export async function carregarMapaClientes(db) {
  const map = new Map();
  if (!db) return map;
  const [rows] = await db.query(`SELECT id, codigo_cliente FROM cliente`);
  for (const r of rows) {
    const digits = String(r.codigo_cliente ?? '').replace(/\D/g, '');
    const cod = digits.replace(/^0+/, '') || digits;
    if (cod) map.set(cod, r.id);
    map.set(digits, r.id);
  }
  return map;
}

export async function carregarLancamentosPorRowIdApi(ctx) {
  const porRowId = new Map();
  let page = 0;
  for (;;) {
    const res = await apiGet(
      ctx,
      `/api/financeiro/lancamentos/extrato/paginada?numeroBanco=${NUMERO_BANCO_CZ}&page=${page}&size=500&sort=dataLancamento,asc`,
    );
    const content = Array.isArray(res?.content) ? res.content : [];
    for (const l of content) {
      const det = String(l.descricaoDetalhada ?? '');
      const m = det.match(/^(\d+)/);
      if (!m) continue;
      const rowId = Number(m[1]);
      const row = {
        id: l.id,
        grupo_compensacao: l.grupoCompensacao ?? null,
        processo_id: l.processoId ?? null,
        cliente_id: l.clienteId ?? null,
        natureza: l.natureza,
        valor: l.valor,
        det,
      };
      if (!porRowId.has(rowId)) porRowId.set(rowId, []);
      porRowId.get(rowId).push(row);
    }
    if (content.length < 500) break;
    page += 1;
    if (page > 200) break;
  }
  return porRowId;
}

export async function carregarLancamentosPorRowIdDb(db) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.grupo_compensacao, fl.processo_id, fl.cliente_id, fl.pessoa_ref_id,
            fl.ref_tipo, fl.natureza, fl.valor,
            CAST(fl.descricao_detalhada AS CHAR) det
     FROM financeiro_lancamento fl
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

export async function carregarLancamentosPorRowId(ctx, db) {
  if (isLocalBackend(ctx.baseUrl) && db) {
    return carregarLancamentosPorRowIdDb(db);
  }
  console.log('Carregando lançamentos via API (destino remoto)…');
  return carregarLancamentosPorRowIdApi(ctx);
}

export async function resolverProcessoId(db, clienteId, numeroInterno) {
  if (!db || !numeroInterno || !clienteId) return null;
  const [rows] = await db.query(
    `SELECT p.id FROM processo p
     JOIN cliente c ON c.pessoa_id = p.pessoa_id
     WHERE c.id = ? AND p.numero_interno = ?
     ORDER BY p.id LIMIT 1`,
    [clienteId, numeroInterno],
  );
  return rows[0]?.id ?? null;
}

export function findLancById(porRowId, id) {
  for (const arr of porRowId.values()) {
    const r = arr.find((x) => x.id === id);
    if (r) return r;
  }
  return null;
}

export function resolverLancamento(porRowId, linha, idsUsados) {
  const cands = (porRowId.get(linha.rowId) ?? []).filter((r) => !idsUsados.includes(r.id));
  if (cands.length === 0) {
    return { status: 'AUSENTE', erro: `rowId ${linha.rowId} sem match na conta ${NUMERO_BANCO_CZ}` };
  }
  const lanc = cands[0];
  const signed = (lanc.natureza === 'CREDITO' ? 1 : -1) * Number(lanc.valor);
  if (Math.round(signed * 100) !== linha.cents) {
    return {
      status: 'ERRO',
      erro: `rowId ${linha.rowId} valor diverge: planilha ${linha.cents / 100} vs banco ${signed}`,
    };
  }
  return { status: 'OK', lanc, signed };
}

function isGrupoLegadoCz(g) {
  return /^CZ18/.test(String(g ?? ''));
}

function rowIdFromDet(det) {
  const m = String(det ?? '').match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function isLinhaCliente(linha, codigo) {
  return linha?.ref01 === codigo;
}

/**
 * Política de conflitos CZ18/CZ18B vs CZ-B*.
 * @returns {{ status: 'FEITO'|'OK'|'CONFLITO'|'RENOMEAVEL'|'DESPAREAR_LEGADO', grupos?: string[], motivo?: string }}
 */
export function analisarConflitosGrupo(ids, porRowId, grupoAlvo, rowIdsCard, { linhasCard = [], codigo = null } = {}) {
  const rowIdCliente = new Set(
    linhasCard.filter((l) => isLinhaCliente(l, codigo)).map((l) => l.rowId),
  );
  const grupos = new Set();
  const gruposCliente = new Set();
  const gruposEspelho = new Set();

  for (const id of ids) {
    const r = findLancById(porRowId, id);
    const g = String(r?.grupo_compensacao ?? '').trim();
    if (!g) continue;
    grupos.add(g);
    const rid = rowIdFromDet(r.det);
    if (rid != null && rowIdCliente.has(rid)) gruposCliente.add(g);
    else gruposEspelho.add(g);
  }

  if (grupos.size === 0) return { status: 'OK' };
  if (grupos.size === 1 && grupos.has(grupoAlvo)) return { status: 'FEITO' };

  const rowIdSet = new Set(rowIdsCard);
  const cz18bEsperado = `CZ18B-${rowIdsCard[0]}`;

  if (grupos.size === 1 && grupos.has(cz18bEsperado)) {
    return { status: 'RENOMEAVEL', grupos: [...grupos], motivo: 'CZ18B_mesmo_bloco' };
  }

  if (grupos.size === 1 && [...grupos][0].startsWith('CZ18B-')) {
    const g = [...grupos][0];
    const membros = [...porRowId.values()]
      .flat()
      .filter((x) => x.grupo_compensacao === g)
      .map((x) => rowIdFromDet(x.det))
      .filter(Boolean);
    const sameMembers =
      membros.length === rowIdsCard.length && membros.every((rid) => rowIdSet.has(rid));
    if (sameMembers) return { status: 'RENOMEAVEL', grupos: [...grupos], motivo: 'CZ18B_membros_iguais' };
  }

  if (gruposCliente.size > 0) {
    const fora = [...gruposCliente].filter((g) => g !== grupoAlvo);
    if (fora.length > 0) {
      if (fora.every(isGrupoLegadoCz)) {
        return {
          status: 'DESPAREAR_LEGADO',
          grupos: fora,
          motivo: 'cliente_em_grupo_legado',
        };
      }
      return {
        status: 'CONFLITO',
        grupos: fora,
        motivo: fora.some(isGrupoLegadoCz) ? 'linha_cliente_em_grupo_legado' : 'linha_cliente_em_outro_grupo',
      };
    }
  }

  const legadoEspelho = [...gruposEspelho].filter(isGrupoLegadoCz);
  if (legadoEspelho.length > 0) {
    return {
      status: 'DESPAREAR_LEGADO',
      grupos: legadoEspelho,
      motivo: 'espelho_em_grupo_legado',
    };
  }

  const numericoEspelho = [...gruposEspelho].filter((g) => /^\d+$/.test(String(g ?? '')));
  if (numericoEspelho.length > 0) {
    return {
      status: 'DESPAREAR_LEGADO',
      grupos: numericoEspelho,
      motivo: 'espelho_em_grupo_numerico',
    };
  }

  if (grupos.size > 1) {
    return { status: 'CONFLITO', grupos: [...grupos], motivo: 'multiplos_grupos' };
  }

  const g = [...grupos][0];
  if (g !== grupoAlvo && isGrupoLegadoCz(g)) {
    return { status: 'CONFLITO', grupos: [g], motivo: 'grupo_legado_CZ18' };
  }

  return { status: 'CONFLITO', grupos: [...grupos], motivo: 'grupo_diferente' };
}

export async function desparearGrupo(ctx, grupo) {
  if (!ctx.executar) return;
  await apiSend(ctx, 'DELETE', `/api/financeiro/lancamentos/parear/${encodeURIComponent(grupo)}`);
  if (ctx.porRowId) {
    for (const arr of ctx.porRowId.values()) {
      for (const r of arr) {
        if (r.grupo_compensacao === grupo) r.grupo_compensacao = null;
      }
    }
  }
}

/** Renomeia grupo legado CZ18B-* → CZ-B* via SQL (local) ou desparear+parear (remoto). */
export async function renomearGrupoLegado(ctx, db, grupoLegado, grupoAlvo, ids) {
  if (!ctx.executar) return true;
  if (db && isLocalBackend(ctx.baseUrl)) {
    await db.query(
      `UPDATE financeiro_lancamento SET grupo_compensacao = ? WHERE grupo_compensacao = ? AND numero_banco = ?`,
      [grupoAlvo, grupoLegado, NUMERO_BANCO_CZ],
    );
    for (const id of ids) {
      const r = findLancById(ctx.porRowId, id);
      if (r) r.grupo_compensacao = grupoAlvo;
    }
    return true;
  }
  await desparearGrupo(ctx, grupoLegado);
  return false;
}

export async function atualizarLancamento(ctx, db, lancId, linhaPlanilha, clienteId, { vincularCliente = false } = {}) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${lancId}`);
  let processoId = atual.processoId ?? null;
  if (linhaPlanilha?.procPlanilha != null && db) {
    const pid = await resolverProcessoId(db, clienteId, linhaPlanilha.procPlanilha);
    if (pid) processoId = pid;
  }
  const refTipo = linhaPlanilha?.refTipo ?? atual.refTipo ?? 'N';
  const cid =
    vincularCliente || linhaPlanilha?.ref01 === String(ctx.codigoJob)
      ? clienteId
      : (atual.clienteId ?? null);
  const precisa =
    (linhaPlanilha?.procPlanilha != null && Number(atual.processoId) !== Number(processoId)) ||
    (linhaPlanilha?.refTipo && atual.refTipo !== refTipo) ||
    (vincularCliente && Number(atual.clienteId) !== Number(clienteId));
  if (!precisa) return false;
  if (!ctx.executar) return true;
  await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${lancId}`, {
    contaContabilId: atual.contaContabilId,
    clienteId: cid,
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

export async function putLancamentoVinculo(ctx, lancId, { clienteId = null, pessoaRefId = null, grupoCompensacao = undefined } = {}) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${lancId}`);
  const cid = clienteId ?? null;
  const pid = cid ? null : (pessoaRefId ?? null);
  const grupo =
    grupoCompensacao !== undefined ? grupoCompensacao : (atual.grupoCompensacao ?? null);
  if (!ctx.executar) return true;
  await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${lancId}`, {
    contaContabilId: atual.contaContabilId,
    clienteId: cid,
    processoId: atual.processoId ?? null,
    pessoaRefId: pid,
    bancoNome: atual.bancoNome,
    numeroBanco: atual.numeroBanco,
    numeroLancamento: atual.numeroLancamento,
    dataLancamento: atual.dataLancamento,
    dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
    descricao: atual.descricao,
    descricaoDetalhada: atual.descricaoDetalhada,
    valor: atual.valor,
    natureza: atual.natureza,
    refTipo: atual.refTipo ?? 'N',
    origem: atual.origem ?? 'MANUAL',
    status: atual.status ?? 'ATIVO',
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    grupoCompensacao: grupo,
  });
  const r = findLancById(ctx.porRowId, lancId);
  if (r) {
    r.cliente_id = cid;
    r.pessoa_ref_id = pid;
    if (grupoCompensacao !== undefined) r.grupo_compensacao = grupo;
  }
  return true;
}

export async function unificarVinculoEscritorio(ctx, db, ids) {
  const escritorioId = await garantirPessoaEscritorio(db, ctx);
  if (!escritorioId) return false;
  await desparearGrupoSeSubconjunto(ctx, db, ids);
  for (const id of ids) {
    await putLancamentoVinculo(ctx, id, { clienteId: null, pessoaRefId: escritorioId, grupoCompensacao: null });
  }
  return true;
}

export async function desparearGrupoSeSubconjunto(ctx, db, ids) {
  const idSet = new Set(ids);
  const grupos = new Set();
  for (const id of ids) {
    const r = findLancById(ctx.porRowId, id);
    const g = String(r?.grupo_compensacao ?? '').trim();
    if (g) grupos.add(g);
  }
  for (const g of grupos) {
    if (!db || !ctx.executar) continue;
    const [membros] = await db.query(
      `SELECT id FROM financeiro_lancamento WHERE status='ATIVO' AND grupo_compensacao=?`,
      [g],
    );
    if (membros.every((m) => idSet.has(m.id))) {
      await desparearGrupo(ctx, g);
    }
  }
}

export async function parearGrupo(ctx, grupoAlvo, ids) {
  if (!ctx.executar) return;
  await apiSend(ctx, 'POST', '/api/financeiro/lancamentos/parear-grupo', {
    lancamentoIds: ids,
    grupoCompensacao: grupoAlvo,
  });
  for (const id of ids) {
    const r = findLancById(ctx.porRowId, id);
    if (r) r.grupo_compensacao = grupoAlvo;
  }
}

function rowIdFromDetalhe(det) {
  const m = String(det ?? '').match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function listarLancamentosConta18(db, rowIdsAlvo) {
  const alvo = rowIdsAlvo instanceof Set ? rowIdsAlvo : new Set(rowIdsAlvo);
  if (!db || alvo.size === 0) return [];
  const [rows] = await db.query(
    `SELECT fl.id, fl.grupo_compensacao, fl.processo_id, fl.cliente_id, fl.pessoa_ref_id,
            fl.ref_tipo, fl.natureza, fl.valor,
            CAST(fl.descricao_detalhada AS CHAR) det
     FROM financeiro_lancamento fl
     WHERE fl.numero_banco = ? AND fl.status = 'ATIVO'
       AND fl.descricao_detalhada REGEXP '^[0-9]+'`,
    [CONTA_18],
  );
  return rows.filter((r) => {
    const rowId = rowIdFromDetalhe(r.det);
    return rowId != null && alvo.has(rowId);
  });
}

export async function garantirPessoaEscritorio(db, ctx) {
  const [rows] = await db.query(`SELECT id FROM pessoa WHERE nome = ? LIMIT 1`, [PESSOA_ESCRITORIO_NOME]);
  if (rows.length) return rows[0].id;
  if (!ctx.executar) return null;
  const [res] = await db.query(`INSERT INTO pessoa (nome) VALUES (?)`, [PESSOA_ESCRITORIO_NOME]);
  return res.insertId;
}

export function resolverVinculoMigracao(lanc, linhaPlanilha, mapaClientes, escritorioId) {
  if (lanc.cliente_id) return { clienteId: lanc.cliente_id, pessoaRefId: null };
  const ref01 = linhaPlanilha?.ref01;
  if (ref01 && /^\d+$/.test(String(ref01))) {
    const cod = String(ref01).replace(/^0+/, '') || String(ref01);
    const clienteId = mapaClientes.get(cod) ?? mapaClientes.get(String(ref01).padStart(7, '0'));
    if (clienteId) return { clienteId, pessoaRefId: null };
  }
  return { clienteId: null, pessoaRefId: escritorioId };
}

export async function migrarUmLancamento18Para19(ctx, id, { clienteId = null, pessoaRefId = null } = {}) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${id}`);
  if (Number(atual.numeroBanco) === NUMERO_BANCO_CZ) {
    return { status: 'PULADO', id };
  }
  if (!ctx.executar) {
    return { status: 'DRY_RUN', id };
  }
  const detalheBase = atual.descricaoDetalhada ?? '';
  const detalhe = detalheBase.includes(MARCA_MIGRACAO)
    ? detalheBase
    : `${detalheBase}${detalheBase ? ' · ' : ''}${MARCA_MIGRACAO}`.slice(0, 2000);
  const cid = clienteId ?? atual.clienteId ?? null;
  const pid = pessoaRefId ?? atual.pessoaRefId ?? null;
  await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${id}`, {
    contaContabilId: atual.contaContabilId,
    clienteId: cid,
    processoId: atual.processoId ?? null,
    pessoaRefId: cid ? null : pid,
    bancoNome: BANCO_NOME_CZ,
    numeroBanco: NUMERO_BANCO_CZ,
    numeroLancamento: atual.numeroLancamento,
    dataLancamento: atual.dataLancamento,
    dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
    descricao: atual.descricao,
    descricaoDetalhada: detalhe,
    valor: atual.valor,
    natureza: atual.natureza,
    refTipo: atual.refTipo ?? 'N',
    origem: atual.origem ?? 'MANUAL',
    status: atual.status ?? 'ATIVO',
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    grupoCompensacao: atual.grupoCompensacao ?? null,
  });
  return { status: 'MIGRADO', id, rowId: rowIdFromDetalhe(detalheBase) };
}

/**
 * Migra lançamentos da conta 18 para CONTA ZERO (19) cujo rowId está no recorte alvo.
 * @returns {{ total: number, migrados: number, pulados: number, dryRun: number }}
 */
export async function migrarConta18ParaCz(ctx, db, rowIdsAlvo, { linhasPorRowId = null, mapaClientes = null } = {}) {
  const alvo = rowIdsAlvo instanceof Set ? rowIdsAlvo : new Set(rowIdsAlvo);
  const lancamentos = await listarLancamentosConta18(db, alvo);
  const stats = { total: lancamentos.length, migrados: 0, pulados: 0, dryRun: 0 };
  const escritorioId =
    ctx.executar && db && mapaClientes ? await garantirPessoaEscritorio(db, ctx) : null;

  for (const lanc of lancamentos) {
    const rowId = rowIdFromDetalhe(lanc.det);
    const linhaPlanilha = rowId != null && linhasPorRowId ? linhasPorRowId.get(rowId) : null;
    const vinculo = resolverVinculoMigracao(lanc, linhaPlanilha, mapaClientes ?? new Map(), escritorioId);
    const res = await migrarUmLancamento18Para19(ctx, lanc.id, vinculo);
    if (res.status === 'MIGRADO') {
      stats.migrados += 1;
      const rowId = rowIdFromDetalhe(lanc.det);
      if (rowId != null && ctx.porRowId) {
        const row = {
          id: lanc.id,
          grupo_compensacao: lanc.grupo_compensacao ?? null,
          processo_id: lanc.processo_id ?? null,
          cliente_id: lanc.cliente_id ?? null,
          natureza: lanc.natureza,
          valor: lanc.valor,
          det: lanc.det,
        };
        if (!ctx.porRowId.has(rowId)) ctx.porRowId.set(rowId, []);
        ctx.porRowId.get(rowId).push(row);
      }
    } else if (res.status === 'PULADO') {
      stats.pulados += 1;
    } else {
      stats.dryRun += 1;
    }
  }

  return stats;
}
