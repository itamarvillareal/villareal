/**
 * Reconciliação Conta Compensação (planilha) × grupo_compensacao numérico (DB).
 */

import XLSX from 'xlsx';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireExtratoBancosPlanilhaXlsPath } from './resolve-extrato-bancos-planilha-xls.mjs';
import { parseValorPlanilha, excelSerialParaISO } from './extrato-bancos-planilha-parse.mjs';
import { ABA_CONTA_COMPENSACAO, carregarPlanilhaElo } from './resgate-cards-elo.mjs';
import { NUMERO_BANCO_CZ } from './carga-acerto-api.mjs';
import { BANCOS_API_SEM_PLANILHA_COMP } from './extrato-bancos-planilha-constantes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CORTE_PADRAO = '2026-12-31';
export const RECENTE_PADRAO = '2020-01-01';

/** Contas manuais legadas substituídas pela CONTA ZERO (19) na API. */
export const BANCOS_MANUAL_LEGADO = new Set([9, 17, 18]);

/** Na planilha Comp, muitos elos só Itaú compensavam implicitamente com 99 Pay (API banco 30). */
export const NUMERO_BANCO_ITAU = 1;
export const NUMERO_BANCO_99PAY = 30;

export function normalizarBancoPlanilhaParaApi(banco) {
  const n = Number(banco);
  if (!Number.isFinite(n)) return null;
  return BANCOS_MANUAL_LEGADO.has(n) ? NUMERO_BANCO_CZ : n;
}

export function bancosDistintos(detalhes) {
  return [...new Set((detalhes ?? []).map((d) => String(d.banco)))].sort((a, b) => Number(a) - Number(b));
}

/** Mapa numero_banco → nome para contas da API sem aba Conta Compensação na planilha. */
export async function carregarBancosApiSemPlanilha(db, bancosPlanilhaComp) {
  const out = new Map(Object.entries(BANCOS_API_SEM_PLANILHA_COMP).map(([k, v]) => [Number(k), v]));
  if (!db) return out;
  const [rows] = await db.query(
    `SELECT numero_banco, banco_nome FROM conta_bancaria WHERE ativo = 1 ORDER BY numero_banco`,
  );
  for (const r of rows) {
    const nb = Number(r.numero_banco);
    if (!bancosPlanilhaComp.has(String(nb))) {
      out.set(nb, r.banco_nome || BANCOS_API_SEM_PLANILHA_COMP[nb] || `banco ${nb}`);
    }
  }
  return out;
}

export function isBancoApiSemPlanilhaComp(banco, bancosPlanilhaComp, bancosApiSemPlanilha) {
  const n = Number(banco);
  if (!Number.isFinite(n)) return false;
  if (bancosApiSemPlanilha?.has(n)) return true;
  return !bancosPlanilhaComp.has(String(n));
}

export function rotuloBancosApi(bancos, bancosApiSemPlanilha) {
  return bancos
    .map((b) => {
      const n = Number(b);
      const nome = bancosApiSemPlanilha?.get(n);
      return nome ? `${n}(${nome})` : String(b);
    })
    .join('+');
}

export function centsParaBrl(cents) {
  return Math.round(cents) / 100;
}

export function lerElosContaCompensacao(caminho = requireExtratoBancosPlanilhaXlsPath(), corte = CORTE_PADRAO) {
  const wb = XLSX.readFile(caminho, { cellDates: false });
  const ws = wb.Sheets[ABA_CONTA_COMPENSACAO];
  if (!ws?.['!ref']) return { byElo: new Map(), linhas: [] };

  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const byElo = new Map();
  const linhas = [];

  for (let r = 6; r <= range.e.r; r += 1) {
    const eloRaw = cell(r, 10);
    const valorRaw = cell(r, 6);
    if (eloRaw == null || eloRaw === '') continue;
    const elo = String(Math.trunc(Number(eloRaw)));
    if (!/^\d{4,}$/.test(elo)) continue;
    const valor = typeof valorRaw === 'number' ? valorRaw : parseValorPlanilha(valorRaw);
    if (valor == null) continue;
    const dataIso = excelSerialParaISO(cell(r, 3)) || '1900-01-01';
    if (dataIso > corte) continue;

    const cents = Math.round(valor * 100);
    const rowIdRaw = cell(r, 4);
    const rowId = typeof rowIdRaw === 'number' ? rowIdRaw : Number(String(rowIdRaw ?? '').replace(/\D/g, '')) || null;

    const det = {
      elo,
      cents,
      dataIso,
      linhaExcel: r + 1,
      banco: cell(r, 1),
      rowId,
      comentario: String(cell(r, 9) ?? '').trim(),
    };
    linhas.push(det);

    if (!byElo.has(elo)) {
      byElo.set(elo, {
        soma: 0,
        qtd: 0,
        valores: [],
        detalhes: [],
        minData: dataIso,
        maxData: dataIso,
        rowIds: new Set(),
        bancos: new Set(),
      });
    }
    const g = byElo.get(elo);
    g.soma += cents;
    g.qtd += 1;
    g.valores.push(cents);
    g.detalhes.push({ cents, banco: det.banco, rowId: det.rowId, linhaExcel: det.linhaExcel });
    if (det.banco != null && det.banco !== '') g.bancos.add(String(det.banco));
    if (rowId) g.rowIds.add(rowId);
    if (dataIso < g.minData) g.minData = dataIso;
    if (dataIso > g.maxData) g.maxData = dataIso;
  }

  return { byElo, linhas, caminho };
}

export async function lerElosDb(db, { corte = CORTE_PADRAO, canonico = true } = {}) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.grupo_compensacao elo, fl.valor, fl.natureza, fl.status, fl.numero_banco,
            DATE_FORMAT(fl.data_lancamento, '%Y-%m-%d') data_lancamento,
            cc.codigo conta_codigo,
            CAST(fl.descricao_detalhada AS CHAR) det
     FROM financeiro_lancamento fl
     LEFT JOIN financeiro_conta_contabil cc ON cc.id = fl.conta_contabil_id
     WHERE fl.grupo_compensacao IS NOT NULL
       AND TRIM(fl.grupo_compensacao) REGEXP '^[0-9]{4,}$'
       AND fl.data_lancamento <= ?
       ${canonico ? "AND fl.status = 'ATIVO' AND fl.numero_banco NOT IN (9, 17, 18)" : ''}`,
    [corte],
  );

  const byElo = new Map();
  for (const r of rows) {
    const elo = String(r.elo).trim();
    const cents = Math.round((r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor) * 100);
    const dataIso = r.data_lancamento;
    if (!byElo.has(elo)) {
      byElo.set(elo, {
        soma: 0,
        qtd: 0,
        valores: [],
        detalhes: [],
        ids: [],
        bancos: new Set(),
        ativo: 0,
        aposentado: 0,
        minData: dataIso,
        maxData: dataIso,
      });
    }
    const g = byElo.get(elo);
    g.soma += cents;
    g.qtd += 1;
    g.valores.push(cents);
    g.detalhes.push({ cents, banco: r.numero_banco, id: r.id, status: r.status });
    g.ids.push(r.id);
    g.bancos.add(String(r.numero_banco));
    if (r.status === 'ATIVO') g.ativo += 1;
    else g.aposentado += 1;
    if (dataIso < g.minData) g.minData = dataIso;
    if (dataIso > g.maxData) g.maxData = dataIso;
  }
  return byElo;
}

export function chaveParBancoValor(d) {
  const banco = normalizarBancoPlanilhaParaApi(d.banco) ?? d.banco;
  return `${banco}:${Math.abs(d.cents)}:${Math.sign(d.cents) || 0}`;
}

export function multisetPares(detalhes) {
  return [...(detalhes ?? [])].map(chaveParBancoValor).sort().join('|');
}

export function multisetAbs(valores) {
  return [...valores].map((v) => Math.abs(v)).sort((a, b) => a - b);
}

export function multisetIgual(a, b) {
  const sa = multisetAbs(a).join(',');
  const sb = multisetAbs(b).join(',');
  return sa === sb;
}

export function valoresBatemSemantico(plan, sys) {
  if (!plan || !sys) return false;
  if (plan.soma === sys.soma && plan.qtd === sys.qtd) return true;
  if (plan.soma === sys.soma) return true;

  if (plan.detalhes?.length && sys.detalhes?.length && multisetPares(plan.detalhes) === multisetPares(sys.detalhes)) {
    return true;
  }

  if (plan.qtd === 1 && sys.qtd >= 2 && sys.soma === 0) {
    const pv = plan.valores[0];
    return sys.valores.includes(pv) || sys.valores.includes(-pv);
  }
  if (plan.qtd >= 2 && plan.soma === 0 && sys.qtd === 1) {
    const sv = sys.valores[0];
    return plan.valores.includes(sv) || plan.valores.includes(-sv);
  }
  return multisetIgual(plan.valores, sys.valores);
}

export function subtipoEstrutural(plan, sys) {
  if (plan.detalhes?.length && sys.detalhes?.length && multisetPares(plan.detalhes) === multisetPares(sys.detalhes)) {
    return 'migracaoConta';
  }
  if (isPlanSomenteItau(plan) && plan.qtd === 1 && sys.qtd >= 2 && sys.soma === 0) {
    return 'planItau1_dbPar';
  }
  if (plan.qtd === 1 && sys.qtd >= 2 && sys.soma === 0) return 'plan1_dbPar';
  if (plan.qtd >= 2 && plan.soma === 0 && sys.qtd === 1) return 'planPar_db1';
  if (plan.soma === sys.soma && plan.qtd !== sys.qtd) return 'somaIgual_qtdDif';
  return 'multiset';
}

export function isPlanSomenteItau(plan) {
  if (!plan?.bancos?.size) return false;
  return [...plan.bancos].every((b) => Number(b) === NUMERO_BANCO_ITAU);
}

/** Planilha só registrou o lado Itaú; par esperado na API é Itaú (1) ↔ 99 Pay (30). */
export function classificarInterbancario99Pay(plan, sys) {
  if (!isPlanSomenteItau(plan) || !sys) return null;

  const bancosSys = [...sys.bancos].map(Number).filter(Number.isFinite);
  const temItau = bancosSys.includes(NUMERO_BANCO_ITAU);
  const tem99 = bancosSys.includes(NUMERO_BANCO_99PAY);
  const outros = bancosSys.filter((b) => b !== NUMERO_BANCO_ITAU);
  const soItauNoDb = bancosSys.length === 1 && bancosSys[0] === NUMERO_BANCO_ITAU;

  const planCompativelComParDb = () => {
    if (sys.soma !== 0) return false;
    if (valoresBatemSemantico(plan, sys)) return true;
    if (plan.qtd === 1) {
      const pv = plan.valores[0];
      return sys.valores.includes(pv) || sys.valores.includes(-pv);
    }
    if (plan.soma === 0 && plan.qtd >= 2) {
      return multisetIgual(plan.valores, sys.valores);
    }
    return false;
  };

  if (temItau && tem99 && outros.length === 1 && planCompativelComParDb()) {
    return { status: 'BATE', subtipo: 'INTERBANCARIO_99PAY' };
  }
  if (temItau && tem99 && valoresBatemSemantico(plan, sys)) {
    return { status: 'BATE', subtipo: 'INTERBANCARIO_99PAY' };
  }

  if (soItauNoDb && sys.qtd >= 2 && planCompativelComParDb()) {
    return { status: 'ESTRUTURAL', subtipo: 'INTERBANCARIO_99PAY_SAME_BANK' };
  }

  if (temItau && !tem99 && outros.length >= 1 && planCompativelComParDb()) {
    const destKey = outros.sort((a, b) => a - b).join('+');
    return { status: 'ESTRUTURAL', subtipo: `INTERBANCARIO_99PAY_DESTINO_${destKey}` };
  }

  if (temItau && !tem99 && isPlanSomenteItau(plan)) {
    return { status: 'PENDENTE_INTERBANCARIO', subtipo: 'INTERBANCARIO_99PAY_SEM_99PAY' };
  }

  return null;
}

export function filtrarElosItauInterbancario99Pay(rows) {
  return rows.filter(
    (r) =>
      r.bancosPlan === String(NUMERO_BANCO_ITAU) &&
      (r.subtipo?.startsWith('INTERBANCARIO_99PAY') || r.status === 'PENDENTE_INTERBANCARIO'),
  );
}

export function bancosSomenteApi(sys, { bancosPlanilhaComp, bancosApiSemPlanilha } = {}) {
  const bancosSys = [...(sys?.bancos ?? [])].map(Number).filter(Number.isFinite);
  if (!bancosSys.length) return false;
  return bancosSys.every((b) => isBancoApiSemPlanilhaComp(b, bancosPlanilhaComp, bancosApiSemPlanilha));
}

export function classificarElo(elo, plan, sys, { bancosPlanilhaComp, bancosApiSemPlanilha } = {}) {
  if (!plan && sys) {
    const soApi = bancosPlanilhaComp && bancosSomenteApi(sys, { bancosPlanilhaComp, bancosApiSemPlanilha });
    return {
      elo,
      status: soApi ? 'API_NOVA_CONTA' : 'SO_SISTEMA',
      subtipo: soApi ? rotuloBancosApi([...sys.bancos], bancosApiSemPlanilha) : '',
      dataMax: sys.maxData,
      somaPlan: '',
      qtdPlan: '',
      somaSys: centsParaBrl(sys.soma),
      qtdSys: sys.qtd,
      diffAbs: Math.abs(sys.soma),
      bancosSys: [...sys.bancos].join('+'),
      idsDb: sys.ids.join('+'),
    };
  }
  if (plan && !sys) {
    return {
      elo,
      status: 'SO_PLANILHA',
      subtipo: '',
      dataMax: plan.maxData,
      somaPlan: centsParaBrl(plan.soma),
      qtdPlan: plan.qtd,
      somaSys: '',
      qtdSys: '',
      diffAbs: Math.abs(plan.soma),
      idsDb: '',
      rowIdsPlan: [...plan.rowIds].join('+'),
      bancosPlan: [...plan.bancos].join('+'),
    };
  }

  const base = {
    elo,
    dataMax: plan.maxData >= sys.maxData ? plan.maxData : sys.maxData,
    somaPlan: centsParaBrl(plan.soma),
    qtdPlan: plan.qtd,
    somaSys: centsParaBrl(sys.soma),
    qtdSys: sys.qtd,
    diffAbs: Math.abs(plan.soma - sys.soma),
    idsDb: sys.ids.join('+'),
    rowIdsPlan: [...plan.rowIds].join('+'),
    bancosPlan: [...plan.bancos].join('+'),
    bancosSys: [...sys.bancos].join('+'),
    ativoSys: sys.ativo,
    aposentadoSys: sys.aposentado,
  };

  const ib99 = classificarInterbancario99Pay(plan, sys);
  if (ib99) {
    return { ...base, ...ib99 };
  }

  if (plan.soma === sys.soma && plan.qtd === sys.qtd) {
    return { ...base, status: 'BATE', subtipo: 'EXATO' };
  }
  if (plan.soma === sys.soma) {
    return { ...base, status: 'BATE', subtipo: 'SOMA' };
  }
  if (valoresBatemSemantico(plan, sys)) {
    return { ...base, status: 'ESTRUTURAL', subtipo: subtipoEstrutural(plan, sys) };
  }
  return { ...base, status: 'GAP', subtipo: 'valores' };
}

export function reconciliar(planByElo, sysByElo, { bancosPlanilhaComp, bancosApiSemPlanilha } = {}) {
  const todosElos = new Set([...planByElo.keys(), ...sysByElo.keys()]);
  const rows = [];
  const resumo = {
    BATE: 0,
    ESTRUTURAL: 0,
    GAP: 0,
    SO_PLANILHA: 0,
    SO_SISTEMA: 0,
    API_NOVA_CONTA: 0,
    PENDENTE_INTERBANCARIO: 0,
  };

  for (const elo of [...todosElos].sort((a, b) => Number(a) - Number(b))) {
    const row = classificarElo(elo, planByElo.get(elo), sysByElo.get(elo), {
      bancosPlanilhaComp,
      bancosApiSemPlanilha,
    });
    rows.push(row);
    resumo[row.status] = (resumo[row.status] ?? 0) + 1;
  }

  const intersecao = rows.filter(
    (r) =>
      r.status !== 'SO_PLANILHA' &&
      r.status !== 'SO_SISTEMA' &&
      r.status !== 'API_NOVA_CONTA' &&
      r.status !== 'PENDENTE_INTERBANCARIO',
  );
  const batem = intersecao.filter(
    (r) => r.status === 'BATE' || r.status === 'ESTRUTURAL' || r.subtipo?.startsWith('INTERBANCARIO_99PAY'),
  ).length;

  return {
    rows,
    resumo,
    intersecao: intersecao.length,
    pctSemantico: intersecao.length ? ((batem / intersecao.length) * 100).toFixed(1) : '0',
    bancosPlanilhaComp,
  };
}

export function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function linhasParaCsv(rows, headers) {
  const cols = headers ?? (rows.length ? Object.keys(rows[0]) : []);
  return [cols.join(','), ...rows.map((r) => cols.map((h) => csvEscape(r[h])).join(','))].join('\n');
}

export function carregarHistoricoCarga(dir = resolve(__dirname, '../..')) {
  const byRowId = new Map();
  if (!existsSync(dir)) return byRowId;

  for (const nome of readdirSync(dir)) {
    if (!nome.startsWith('carga-acerto-blocos') || !nome.endsWith('.csv')) continue;
    const path = join(dir, nome);
    const txt = readFileSync(path, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;
    const headers = lines[0].split(',');
    const idxRow = headers.indexOf('rowId');
    const idxStatus = headers.indexOf('status');
    const idxGrupo = headers.indexOf('grupoAlvo');
    if (idxRow < 0) continue;

    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
      const rowId = Number(cols[idxRow]);
      if (!rowId) continue;
      if (!byRowId.has(rowId)) byRowId.set(rowId, []);
      byRowId.get(rowId).push({
        arquivo: nome,
        status: cols[idxStatus] ?? '',
        grupoAlvo: cols[idxGrupo] ?? '',
      });
    }
  }
  return byRowId;
}

export function indexarCardsPorElo(caminhoPlanilha) {
  const { cards9, cards18 } = carregarPlanilhaElo(caminhoPlanilha);
  const byElo = new Map();
  for (const c of [...cards9, ...cards18]) {
    if (!byElo.has(c.elo)) byElo.set(c.elo, []);
    byElo.get(c.elo).push({
      startRowId: c.startRowId,
      rowIds: c.rowIds,
      aba: c.aba,
      codigo: c.codigo,
    });
  }
  return byElo;
}

export async function cruzarRowIdsDb(db, rowIds) {
  if (!rowIds.length) return [];
  const patterns = rowIds.map((id) => `${id}%`);
  const [rows] = await db.query(
    `SELECT fl.id, fl.grupo_compensacao, fl.status, fl.numero_banco,
            CAST(fl.descricao_detalhada AS CHAR) det,
            cc.codigo conta_codigo
     FROM financeiro_lancamento fl
     LEFT JOIN financeiro_conta_contabil cc ON cc.id = fl.conta_contabil_id
     WHERE fl.descricao_detalhada REGEXP '^[0-9]+'
       AND (${rowIds.map(() => 'fl.descricao_detalhada LIKE ?').join(' OR ')})`,
    patterns,
  );

  const out = [];
  for (const r of rows) {
    const m = String(r.det).match(/^(\d+)/);
    if (!m) continue;
    const rid = Number(m[1]);
    if (rowIds.includes(rid)) out.push({ rowId: rid, ...r });
  }
  return out;
}

export async function analisarSoPlanilha(db, planByElo, { recente = RECENTE_PADRAO, caminhoPlanilha, dirCarga } = {}) {
  const cargaByRowId = carregarHistoricoCarga(dirCarga);
  const cardsByElo = indexarCardsPorElo(caminhoPlanilha);
  const rows = [];

  for (const [elo, plan] of planByElo) {
    if (plan.maxData < recente) continue;

    const rowIds = [...plan.rowIds];
    const dbPorRowId = rowIds.length ? await cruzarRowIdsDb(db, rowIds) : [];
    const cards = cardsByElo.get(elo) ?? [];

    let motivo = 'nao_importado';
    const detalhes = [];

    if (dbPorRowId.length) {
      const comElo = dbPorRowId.filter((r) => String(r.grupo_compensacao ?? '').trim() === elo);
      const comOutroElo = dbPorRowId.filter((r) => {
        const g = String(r.grupo_compensacao ?? '').trim();
        return g && g !== elo;
      });
      const semElo = dbPorRowId.filter((r) => !r.grupo_compensacao);

      if (comElo.length) motivo = 'rowId_com_elo_outro_status';
      else if (comOutroElo.length) motivo = 'rowId_grupo_diferente';
      else if (semElo.length) motivo = 'rowId_sem_grupo_compensacao';
      else motivo = 'rowId_parcial_db';

      detalhes.push(`db_rowIds:${dbPorRowId.map((r) => `${r.rowId}->id${r.id}/${r.grupo_compensacao ?? 'null'}`).join('+')}`);
    } else if (rowIds.length) {
      motivo = 'rowId_ausente_db';
    }

    if (cards.length) {
      detalhes.push(`card_elo:${cards.map((c) => `${c.aba}:${c.startRowId}`).join('+')}`);
      if (motivo === 'nao_importado') motivo = 'tem_card_manual_sem_db';
    }

    const cargaHits = [];
    for (const rid of rowIds) {
      const hits = cargaByRowId.get(rid) ?? [];
      for (const h of hits) cargaHits.push(`${rid}:${h.status}@${h.arquivo}`);
    }
    if (cargaHits.length) detalhes.push(`carga:${cargaHits.join('|')}`);

    rows.push({
      elo,
      dataMax: plan.maxData,
      somaPlan: centsParaBrl(plan.soma),
      qtdPlan: plan.qtd,
      rowIds: rowIds.join('+'),
      temCardManual: cards.length ? 'sim' : 'nao',
      qtdRowIdDb: dbPorRowId.length,
      motivo,
      detalhes: detalhes.join('; '),
    });
  }

  return rows.sort((a, b) => b.dataMax.localeCompare(a.dataMax) || Number(a.elo) - Number(b.elo));
}

export function priorizarGaps(gapRows) {
  return [...gapRows]
    .map((r) => ({
      ...r,
      prioridade: r.diffAbs,
      ano: r.dataMax?.slice(0, 4) ?? '',
    }))
    .sort((a, b) => {
      if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade;
      return b.dataMax.localeCompare(a.dataMax);
    });
}
