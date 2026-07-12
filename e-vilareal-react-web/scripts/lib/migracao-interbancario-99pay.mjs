/**
 * Migração elos Itaú-only (planilha) → par interbancário Itaú (1) ↔ 99 Pay (30).
 */

import {
  lerElosContaCompensacao,
  classificarInterbancario99Pay,
  isPlanSomenteItau,
  NUMERO_BANCO_ITAU,
  NUMERO_BANCO_99PAY,
  CORTE_PADRAO,
} from './reconciliar-elos-compensacao.mjs';

export const CORTE_99PAY_EXTRATO = '2025-11-01';

export function signedCentsLanc(r) {
  return Math.round((r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor) * 100);
}

export function diasEntre(a, b) {
  if (!a || !b) return 9999;
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

export function eloNumerico(grupo) {
  const g = String(grupo ?? '').trim();
  return /^\d{4,}$/.test(g) ? g : null;
}

export async function carregarMembrosElos(db, { corte = CORTE_PADRAO } = {}) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.grupo_compensacao elo, fl.numero_banco, fl.valor, fl.natureza,
            DATE_FORMAT(fl.data_lancamento, '%Y-%m-%d') data_lancamento,
            cc.codigo conta_codigo
     FROM financeiro_lancamento fl
     LEFT JOIN financeiro_conta_contabil cc ON cc.id = fl.conta_contabil_id
     WHERE fl.grupo_compensacao IS NOT NULL
       AND TRIM(fl.grupo_compensacao) REGEXP '^[0-9]{4,}$'
       AND fl.status = 'ATIVO'
       AND fl.data_lancamento <= ?`,
    [corte],
  );

  const byElo = new Map();
  for (const r of rows) {
    const elo = String(r.elo).trim();
    if (!byElo.has(elo)) {
      byElo.set(elo, {
        bancos: new Set(),
        detalhes: [],
        valores: [],
        soma: 0,
        qtd: 0,
        ids: [],
        maxData: r.data_lancamento,
      });
    }
    const g = byElo.get(elo);
    const cents = signedCentsLanc(r);
    g.bancos.add(String(r.numero_banco));
    g.detalhes.push({
      id: r.id,
      banco: Number(r.numero_banco),
      cents,
      data: r.data_lancamento,
      conta: r.conta_codigo,
    });
    g.valores.push(cents);
    g.soma += cents;
    g.qtd += 1;
    g.ids.push(r.id);
    if (r.data_lancamento > g.maxData) g.maxData = r.data_lancamento;
  }
  return byElo;
}

export async function carregarPool99Pay(db) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.valor, fl.natureza,
            DATE_FORMAT(fl.data_lancamento, '%Y-%m-%d') data_lancamento,
            fl.grupo_compensacao
     FROM financeiro_lancamento fl
     WHERE fl.numero_banco = ? AND fl.status = 'ATIVO'`,
    [NUMERO_BANCO_99PAY],
  );
  return rows.map((r) => ({
    id: r.id,
    cents: signedCentsLanc(r),
    data: r.data_lancamento,
    grupo: String(r.grupo_compensacao ?? '').trim(),
  }));
}

export function escolherLinhaItau(plan, sys) {
  const itauLines = sys?.detalhes?.filter((d) => d.banco === NUMERO_BANCO_ITAU) ?? [];
  if (!itauLines.length) return null;

  if (plan?.qtd === 1) {
    const pv = plan.valores[0];
    const hit = itauLines.find((l) => l.cents === pv || l.cents === -pv);
    return hit ?? itauLines[0];
  }

  if (plan?.soma === 0 && plan?.qtd >= 2) {
    const hit = itauLines.find((l) => plan.valores.includes(l.cents));
    return hit ?? itauLines[0];
  }

  return itauLines[0];
}

export function buscarCandidato99Pay(needCents, refDate, pool, usedIds, { maxDias = 120 } = {}) {
  let cands = pool.filter((p) => {
    if (usedIds.has(p.id)) return false;
    if (p.cents !== needCents) return false;
    if (eloNumerico(p.grupo)) return false;
    if (p.grupo && p.grupo.startsWith('COMP-')) return false;
    return true;
  });

  if (!cands.length) return { candidato: null, motivo: 'sem_candidato_99pay' };

  cands = cands
    .map((p) => ({ ...p, dias: diasEntre(p.data, refDate) }))
    .filter((p) => p.dias <= maxDias)
    .sort((a, b) => a.dias - b.dias || a.id - b.id);

  if (!cands.length) {
    cands = pool
      .filter((p) => !usedIds.has(p.id) && p.cents === needCents && !eloNumerico(p.grupo))
      .sort((a, b) => diasEntre(a.data, refDate) - diasEntre(b.data, refDate) || a.id - b.id);
  }

  if (!cands.length) return { candidato: null, motivo: 'sem_candidato_99pay' };
  if (cands.length === 1) return { candidato: cands[0], motivo: '' };

  const best = cands[0];
  const second = cands[1];
  if (best.dias != null && second.dias != null && best.dias === second.dias && best.cents === second.cents) {
    return { candidato: null, motivo: `ambiguo_99pay_${cands.length}` };
  }
  return { candidato: best, motivo: '' };
}

export function planejarMigracaoElo(elo, plan, sys, pool99, used99Ids, opts = {}) {
  const desde = opts.desde ?? CORTE_99PAY_EXTRATO;
  const row = {
    elo,
    dataMax: plan?.maxData ?? sys?.maxData ?? '',
    subtipoPlan: '',
    status: 'IGNORAR',
    motivo: '',
    itauId: '',
    pay99Id: '',
    idsDesparear: '',
    somaPlan: plan ? plan.soma / 100 : '',
    bancosSys: sys ? [...sys.bancos].join('+') : '',
  };

  if (!plan || !sys || !isPlanSomenteItau(plan)) {
    row.motivo = 'nao_itau_only';
    return row;
  }

  const ib = classificarInterbancario99Pay(plan, sys);
  row.subtipoPlan = ib?.subtipo ?? ib?.status ?? '';

  if (ib?.subtipo === 'INTERBANCARIO_99PAY') {
    row.status = 'JA_OK';
    row.motivo = 'ja_interbancario_99pay';
    return row;
  }

  if (!ib?.subtipo?.startsWith('INTERBANCARIO_99PAY')) {
    row.motivo = 'fora_escopo_interbancario';
    return row;
  }

  if (plan.maxData < desde) {
    row.status = 'IGNORAR';
    row.motivo = 'antes_extrato_99pay';
    return row;
  }

  if (sys.bancos.has(String(NUMERO_BANCO_99PAY))) {
    row.status = 'JA_OK';
    row.motivo = 'db_ja_tem_99pay';
    return row;
  }

  const itau = escolherLinhaItau(plan, sys);
  if (!itau) {
    row.status = 'ERRO';
    row.motivo = 'sem_linha_itau';
    return row;
  }

  const needCents = -itau.cents;
  const refDate = itau.data ?? plan.maxData;
  const { candidato, motivo: motivo99 } = buscarCandidato99Pay(needCents, refDate, pool99, used99Ids, opts);

  if (!candidato) {
    row.status = 'SEM_CANDIDATO';
    row.motivo = motivo99;
    row.itauId = itau.id;
    return row;
  }

  row.status = opts.executar ? 'MIGRAR' : 'PRONTO';
  row.motivo = ib.subtipo;
  row.itauId = itau.id;
  row.pay99Id = candidato.id;
  row.idsDesparear = sys.ids.join('+');
  used99Ids.add(candidato.id);
  return row;
}

export function planejarMigracoes(planByElo, sysByElo, pool99, opts = {}) {
  const used99Ids = new Set();
  const rows = [];
  const elosAlvo = opts.elo ? [opts.elo] : [...planByElo.keys()].sort((a, b) => Number(a) - Number(b));

  for (const elo of elosAlvo) {
    rows.push(planejarMigracaoElo(elo, planByElo.get(elo), sysByElo.get(elo), pool99, used99Ids, opts));
  }
  return rows;
}

export function resumoMigracao(rows) {
  const out = {};
  for (const r of rows) {
    out[r.status] = (out[r.status] ?? 0) + 1;
  }
  return out;
}

export function linhasMigracaoParaCsv(rows) {
  const headers = [
    'elo',
    'status',
    'motivo',
    'subtipoPlan',
    'dataMax',
    'itauId',
    'pay99Id',
    'idsDesparear',
    'bancosSys',
    'somaPlan',
  ];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
