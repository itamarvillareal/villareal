/**
 * Detecção de cards via padrão elo: bloco manual soma zero + linha E (col. M) → Conta Compensação.
 */

import XLSX from 'xlsx';
import { requireExtratoBancosPlanilhaXlsPath } from './resolve-extrato-bancos-planilha-xls.mjs';
import { parseValorPlanilha } from './extrato-bancos-planilha-parse.mjs';
import { isCodigoNumerico, prefixoGrupoCard, nomeGrupoCard } from './planilha-blocos-acerto.mjs';

export const ABA_LANC_MANUAIS_9 = 'LANÇ MANUAIS';
export const ABA_LANC_MANUAIS_18 = 'LANÇ MANUAIS (2)';
export const ABA_CONTA_COMPENSACAO = 'Conta Compensação';

export function slugCodigoCard(ref01) {
  const s = String(ref01 ?? '').trim();
  if (!s) return '0';
  if (isCodigoNumerico(s)) return s.replace(/^0+/, '') || s;
  return s.replace(/\s+/g, '_').slice(0, 24);
}

export function nomeGrupoCardElo(ref01, startRowId) {
  const cod = slugCodigoCard(ref01);
  if (isCodigoNumerico(cod)) return nomeGrupoCard(cod, startRowId);
  return `${prefixoGrupoCard(cod)}-${startRowId}`;
}

export function lerLinhasManual(wb, nomeAba) {
  const ws = wb.Sheets[nomeAba];
  if (!ws || !ws['!ref']) return [];
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const linhas = [];
  for (let r = 6; r <= range.e.r; r += 1) {
    const rawVal = cell(r, 7);
    const rawRow = cell(r, 4);
    const valor = typeof rawVal === 'number' ? rawVal : parseValorPlanilha(rawVal);
    const rowId = typeof rawRow === 'number' ? rawRow : Number(String(rawRow ?? '').replace(/\D/g, ''));
    if (!rowId || valor == null) continue;
    linhas.push({
      rowId,
      cents: Math.round(valor * 100),
      letra: String(cell(r, 1) ?? '').trim(),
      proc: cell(r, 12),
      ref01: String(cell(r, 11) ?? '').trim(),
      comentario: String(cell(r, 9) ?? '').trim(),
      linhaExcel: r + 1,
      aba: nomeAba,
    });
  }
  return linhas;
}

export function lerParesCompensacao(wb) {
  const ws = wb.Sheets[ABA_CONTA_COMPENSACAO];
  if (!ws || !ws['!ref']) return new Map();
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const byElo = new Map();
  for (let r = 6; r <= range.e.r; r += 1) {
    const eloRaw = cell(r, 10);
    const valorRaw = cell(r, 6);
    if (eloRaw == null || eloRaw === '') continue;
    const valor = typeof valorRaw === 'number' ? valorRaw : parseValorPlanilha(valorRaw);
    if (valor == null) continue;
    const elo = String(Math.trunc(Number(eloRaw)));
    if (!elo || elo === '0') continue;
    if (!byElo.has(elo)) byElo.set(elo, []);
    byElo.get(elo).push({
      banco: cell(r, 1),
      rowId: cell(r, 4),
      cents: Math.round(valor * 100),
      linhaExcel: r + 1,
      comentario: String(cell(r, 9) ?? '').trim(),
    });
  }
  return byElo;
}

export function detectarCardsPorElo(linhas, { maxBack = 8, eloMin = 1000, aba = '' } = {}) {
  const cards = [];
  const seen = new Set();
  for (let i = 0; i < linhas.length; i += 1) {
    const l = linhas[i];
    const eloNum = Number(l.proc);
    if (l.letra !== 'E' || !l.proc || !Number.isFinite(eloNum) || eloMin > eloNum) continue;
    let soma = 0;
    const bloco = [];
    for (let j = i; j >= Math.max(0, i - maxBack); j -= 1) {
      bloco.unshift(linhas[j]);
      soma += linhas[j].cents;
      if (soma === 0 && bloco.length >= 2) {
        const key = `${bloco[0].rowId}-${eloNum}`;
        if (!seen.has(key)) {
          seen.add(key);
          const codigo =
            bloco.find((x) => isCodigoNumerico(x.ref01))?.ref01 ||
            bloco.find((x) => x.ref01)?.ref01 ||
            '?';
          cards.push({
            elo: String(Math.trunc(eloNum)),
            startRowId: bloco[0].rowId,
            endRowId: l.rowId,
            rowIds: bloco.map((x) => x.rowId),
            linhas: bloco,
            aba: aba || linhas[0]?.aba || '',
            codigo,
            somaPlanilha: 0,
          });
        }
        break;
      }
    }
  }
  return cards;
}

export function carregarPlanilhaElo(caminho = requireExtratoBancosPlanilhaXlsPath()) {
  const wb = XLSX.readFile(caminho, { cellDates: false });
  const l9 = lerLinhasManual(wb, ABA_LANC_MANUAIS_9);
  const l18 = lerLinhasManual(wb, ABA_LANC_MANUAIS_18);
  const compByElo = lerParesCompensacao(wb);
  const cards9 = detectarCardsPorElo(l9, { aba: ABA_LANC_MANUAIS_9 });
  const cards18 = detectarCardsPorElo(l18, { aba: ABA_LANC_MANUAIS_18 });
  return { caminho, wb, l9, l18, compByElo, cards9, cards18 };
}

export function mesclarCards(cards9, cards18) {
  const map = new Map();
  for (const c of [...cards18, ...cards9]) {
    map.set(`${c.startRowId}-${c.elo}`, c);
  }
  return [...map.values()].sort((a, b) => a.startRowId - b.startRowId || Number(a.elo) - Number(b.elo));
}

export function signedLanc(r) {
  return (r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor);
}

export async function carregarLancamentosPorRowIdConta(db, numeroBanco) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.numero_banco, fl.grupo_compensacao, fl.processo_id, fl.cliente_id, fl.pessoa_ref_id,
            fl.ref_tipo, fl.natureza, fl.valor,
            CAST(fl.descricao AS CHAR) descricao,
            CAST(fl.descricao_detalhada AS CHAR) det
     FROM financeiro_lancamento fl
     WHERE fl.numero_banco = ? AND fl.status = 'ATIVO'
       AND fl.descricao_detalhada REGEXP '^[0-9]+'`,
    [numeroBanco],
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

export async function carregarElosCompensacaoDb(db) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.numero_banco, fl.grupo_compensacao, fl.natureza, fl.valor,
            CAST(fl.descricao AS CHAR) descricao,
            CAST(fl.descricao_detalhada AS CHAR) det
     FROM financeiro_lancamento fl
     WHERE fl.status = 'ATIVO'
       AND fl.grupo_compensacao IS NOT NULL
       AND TRIM(fl.grupo_compensacao) REGEXP '^[0-9]+$'`,
  );
  const byElo = new Map();
  for (const r of rows) {
    const elo = String(r.grupo_compensacao).trim();
    if (!byElo.has(elo)) byElo.set(elo, []);
    byElo.get(elo).push(r);
  }
  return byElo;
}

export function classificarCardNoDb(card, porRowId19, porRowId9, compByEloPlanilha, elosDb) {
  const grupoAlvo = nomeGrupoCardElo(card.codigo, card.startRowId);
  const parCompPlan = compByEloPlanilha.get(card.elo) ?? [];
  const somaCompPlan = parCompPlan.reduce((s, p) => s + p.cents, 0);
  const parCompDb = elosDb.get(card.elo) ?? [];
  const somaCompDb = parCompDb.reduce((s, r) => s + Math.round(signedLanc(r) * 100), 0);

  const ids19 = [];
  const ids9 = [];
  const grupos = new Set();
  const vinculos = new Set();
  let soma19 = 0;
  const missing19 = [];
  const valorDivergePlan9 = [];

  for (const rid of card.rowIds) {
    const planLinha = card.linhas.find((l) => l.rowId === rid);
    const c19 = porRowId19.get(rid) ?? [];
    const c9 = porRowId9.get(rid) ?? [];
    if (!c19.length) missing19.push(rid);
    else {
      const l = c19[0];
      ids19.push(l.id);
      soma19 += signedLanc(l);
      if (l.grupo_compensacao) grupos.add(String(l.grupo_compensacao).trim());
      if (l.cliente_id) vinculos.add(`cliente:${l.cliente_id}`);
      else if (l.pessoa_ref_id) vinculos.add(`pessoa:${l.pessoa_ref_id}`);
      else vinculos.add('sem_vinculo');
    }
    if (c9.length && planLinha) {
      const s9 = signedLanc(c9[0]);
      if (Math.round(s9 * 100) !== planLinha.cents) valorDivergePlan9.push(rid);
      ids9.push(c9[0].id);
    }
  }

  let status = 'PRONTO';
  let motivo = '';

  if (missing19.length === card.rowIds.length && ids9.length === card.rowIds.length) {
    status = 'MIGRAR_9';
    motivo = 'somente_conta_9';
  } else if (missing19.length > 0) {
    status = 'AUSENTE_19';
    motivo = `rowIds_sem_19:${missing19.join('+')}`;
  } else if (Math.abs(soma19) >= 0.005) {
    status = 'CONFLITO_SOMA';
    motivo = `soma_19=${soma19.toFixed(2)}`;
  } else if (vinculos.size > 1) {
    status = 'CONFLITO_VINCULO';
    motivo = `vinculos:${[...vinculos].join('+')}`;
  } else if (grupos.size === 1 && grupos.has(grupoAlvo)) {
    status = 'FEITO';
    motivo = 'ja_pareado';
  } else if (grupos.size > 0) {
    const fora = [...grupos].filter((g) => g !== grupoAlvo);
    if (fora.length) {
      status = 'CONFLITO';
      motivo = `grupos:${fora.join('+')}`;
    }
  }

  if (status === 'PRONTO' && valorDivergePlan9.length === card.rowIds.length) {
    motivo = `${motivo}${motivo ? ';' : ''}valores_19_diferem_aba9`;
  } else if (valorDivergePlan9.length > 0 && status === 'PRONTO') {
    motivo = `${motivo}${motivo ? ';' : ''}parcial_diverge_9:${valorDivergePlan9.join('+')}`;
  }

  if (parCompPlan.length && somaCompPlan !== 0) {
    status = status === 'PRONTO' ? 'ELO_COMP_INVALIDO' : status;
    motivo += `${motivo ? ';' : ''}comp_planilha_soma=${(somaCompPlan / 100).toFixed(2)}`;
  }

  return {
    ...card,
    grupoAlvo,
    status,
    motivo,
    ids19,
    ids9,
    soma19: Math.round(soma19 * 100) / 100,
    grupos: [...grupos],
    compPlanilha: parCompPlan.map((p) => ({ banco: p.banco, rowId: p.rowId, valor: p.cents / 100 })),
    compDb: parCompDb.map((r) => ({ id: r.id, numero_banco: r.numero_banco, valor: signedLanc(r) })),
    somaCompPlan: somaCompPlan / 100,
    somaCompDb: somaCompDb / 100,
    valorDivergePlan9,
  };
}

export function cardParaCsvRow(c) {
  return {
    status: c.status,
    elo: c.elo,
    startRowId: c.startRowId,
    endRowId: c.endRowId,
    rowIds: c.rowIds.join('+'),
    codigo: c.codigo,
    grupoAlvo: c.grupoAlvo,
    aba: c.aba,
    qtdLinhas: c.rowIds.length,
    soma19: c.soma19 ?? '',
    ids19: (c.ids19 ?? []).join('+'),
    grupos: (c.grupos ?? []).join('+'),
    compPlanilha: JSON.stringify(c.compPlanilha ?? []),
    compDb: JSON.stringify(c.compDb ?? []),
    motivo: c.motivo ?? '',
  };
}

export function linhasParaCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
