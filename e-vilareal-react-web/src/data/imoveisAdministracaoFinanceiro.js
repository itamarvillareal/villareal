/**
 * Camada de Administração de Imóveis × Financeiro / Conta Corrente.
 * Fonte única: mesmos lançamentos dos extratos (Cod. Cliente + Proc.) usados em Processos.
 */

import {
  getTransacoesContaCorrenteCompleto,
  LETRA_TO_CONTA,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
} from './financeiroData.js';
import { getImovelMock, getImoveisMockTotal } from './imoveisMockData.js';

export const PAPEL_ALUGUEL = 'aluguel';
export const PAPEL_REPASSE = 'repasse';
export const PAPEL_DESPESA_REPASSAR = 'despesa_repassar';
export const PAPEL_OUTRO = 'outro';

/** Marcadores opcionais na descrição detalhada / categoria (classificação no Financeiro). */
export const TAG_ADM_ALUGUEL = '[ADM_IMOVEL:ALUGUEL]';
export const TAG_ADM_REPASSE = '[ADM_IMOVEL:REPASSE]';
export const TAG_ADM_DESPESA = '[ADM_IMOVEL:DESPESA_REPASSAR]';

export function imovelIdPorCodigoProc(codigoCliente, proc) {
  const c = normalizarCodigoClienteFinanceiro(codigoCliente);
  const p = normalizarProcFinanceiro(proc);
  if (!c || !p) return null;
  const cn = Number(c);
  const pn = Number(p);
  if (!Number.isFinite(cn) || !Number.isFinite(pn)) return null;
  const total = getImoveisMockTotal();
  for (let id = 1; id <= total; id++) {
    const m = getImovelMock(id);
    if (!m) continue;
    if (Number(m.codigo) === cn && Number(m.proc) === pn) return id;
  }
  return null;
}

/** Mock: par cliente+proc coincide com algum imóvel cadastrado ⇒ processo de administração de imóvel. */
export function processoEhAdministracaoImovel(codigoCliente, proc) {
  return imovelIdPorCodigoProc(codigoCliente, proc) != null;
}

function textoClassificacao(t) {
  return `${t.descricao ?? ''} ${t.descricaoDetalhada ?? ''} ${t.categoria ?? ''}`.toUpperCase();
}

function papelPorTag(txt) {
  if (txt.includes(TAG_ADM_ALUGUEL.toUpperCase()) || txt.includes('ADM_IMOVEL:ALUGUEL')) return PAPEL_ALUGUEL;
  if (txt.includes(TAG_ADM_REPASSE.toUpperCase()) || txt.includes('ADM_IMOVEL:REPASSE')) return PAPEL_REPASSE;
  if (txt.includes(TAG_ADM_DESPESA.toUpperCase()) || txt.includes('ADM_IMOVEL:DESPESA_REPASSAR')) {
    return PAPEL_DESPESA_REPASSAR;
  }
  return null;
}

/**
 * Classifica um lançamento para a visão de locação (não cria lançamentos novos).
 * Heurísticas só aplicam quando o processo é reconhecido como administração de imóvel.
 */
export function classificarLancamentoAdministracaoImovel(t, codigoCliente, proc) {
  const txt = textoClassificacao(t);
  const porTag = papelPorTag(txt);
  if (porTag) {
    return {
      papel: porTag,
      motivo: 'tag',
      despesaRepassarAoLocador: porTag === PAPEL_DESPESA_REPASSAR,
    };
  }

  const ehAdm = processoEhAdministracaoImovel(codigoCliente, proc);
  if (!ehAdm) {
    return { papel: PAPEL_OUTRO, motivo: 'generico', despesaRepassarAoLocador: false };
  }

  const v = Number(t.valor);
  if (v > 0 && /\b(ALUG|ALUGUEL|LOCA|LOCAÇ|LOCAC)\b/.test(txt)) {
    return { papel: PAPEL_ALUGUEL, motivo: 'heuristica', despesaRepassarAoLocador: false };
  }
  if (v < 0 && /\b(REPASSE|REPAS\.|LOCADOR|PROPRIET|PIX.*LOCAD)\b/.test(txt)) {
    return { papel: PAPEL_REPASSE, motivo: 'heuristica', despesaRepassarAoLocador: false };
  }
  if (
    v < 0 &&
    (/\b(MANUT|TAXA|SERVI|SERVIÇ|CONDOM|ENCARG|DESP|IPTU|CONDOMIN)\b/.test(txt) ||
      String(t.letra ?? '').trim().toUpperCase() === 'I')
  ) {
    return { papel: PAPEL_DESPESA_REPASSAR, motivo: 'heuristica', despesaRepassarAoLocador: true };
  }

  return { papel: PAPEL_OUTRO, motivo: 'generico', despesaRepassarAoLocador: false };
}

export function nomeContaPorLetra(letra) {
  const L = String(letra ?? '').trim().toUpperCase();
  return LETRA_TO_CONTA[L] || L || '—';
}

export function mesReferenciaDataBr(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr ?? '').trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return {
    chave: `${yyyy}-${mm}`,
    label: `${mm}/${yyyy}`,
    dia: Number(dd),
    sortKey: `${yyyy}${mm}${dd}`,
  };
}

/**
 * @returns {{
 *   transacoes: Array<object & { classificacao: ReturnType<classificarLancamentoAdministracaoImovel> }>,
 *   porMes: Map<string, {
 *     chave: string,
 *     label: string,
 *     totalRecebido: number,
 *     totalRepasse: number,
 *     totalDespesasRepassar: number,
 *     liquidoAposDespesas: number,
 *     remuneracaoEscritorio: number,
 *     valorLiquidoRepassarLocador: number,
 *   }>,
 *   mesesOrdenados: string[],
 * }}
 */
export function montarPainelAdministracaoImovel(codigoCliente, proc) {
  const raw = getTransacoesContaCorrenteCompleto(codigoCliente, proc);
  const transacoes = raw.map((t) => ({
    ...t,
    classificacao: classificarLancamentoAdministracaoImovel(t, codigoCliente, proc),
  }));

  const porMes = new Map();

  for (const t of transacoes) {
    const mes = mesReferenciaDataBr(t.data);
    if (!mes) continue;
    if (!porMes.has(mes.chave)) {
      porMes.set(mes.chave, {
        chave: mes.chave,
        label: mes.label,
        totalRecebido: 0,
        totalRepasse: 0,
        totalDespesasRepassar: 0,
        remuneracaoEscritorio: 0,
        valorLiquidoRepassarLocador: 0,
      });
    }
    const row = porMes.get(mes.chave);
    const { papel } = t.classificacao;
    const v = Number(t.valor) || 0;

    if (papel === PAPEL_ALUGUEL && v > 0) {
      row.totalRecebido += v;
    } else if (papel === PAPEL_REPASSE && v < 0) {
      row.totalRepasse += Math.abs(v);
    } else if (papel === PAPEL_DESPESA_REPASSAR && v < 0) {
      row.totalDespesasRepassar += Math.abs(v);
    }
  }

  for (const row of porMes.values()) {
    row.liquidoAposDespesas = row.totalRecebido - row.totalDespesasRepassar;
    /** Não é lançamento à parte no extrato: diferença entre o líquido após despesas e o repasse efetivo. */
    row.remuneracaoEscritorio = row.liquidoAposDespesas - row.totalRepasse;
    row.valorLiquidoRepassarLocador = row.totalRepasse;
  }

  const mesesOrdenados = [...porMes.keys()].sort();

  return { transacoes, porMes, mesesOrdenados };
}

/** Alertas operacionais (aluguel / repasse ausentes no extrato). */
export function gerarAlertasAdministracaoImovel(imovelMock, porMes, mesesOrdenados) {
  const alertas = [];
  if (!imovelMock || !imovelMock.imovelOcupado) return alertas;

  const valorRef = Number(String(imovelMock.valorLocacao ?? '').replace(',', '.')) || 0;
  const diaPag = Number(String(imovelMock.diaPagAluguel ?? '').replace(/\D/g, '')) || null;
  const diaRep = Number(String(imovelMock.diaRepasse ?? '').replace(/\D/g, '')) || null;

  for (const chave of mesesOrdenados) {
    const row = porMes.get(chave);
    if (!row) continue;

    if (valorRef > 0 && row.totalRecebido <= 0) {
      alertas.push({
        tipo: 'aluguel',
        severidade: 'atencao',
        mes: row.label,
        texto: `Mês ${row.label}: não há recebimento de aluguel identificado na conta corrente (esperado vínculo Cod. cliente + Proc.).${diaPag ? ` Referência pagamento: dia ${String(diaPag).padStart(2, '0')}.` : ''}`,
      });
    }

    if (row.totalRecebido > 0 && row.totalRepasse <= 0) {
      alertas.push({
        tipo: 'repasse',
        severidade: 'atencao',
        mes: row.label,
        texto: `Mês ${row.label}: aluguel recebido, mas não há repasse ao locador identificado no extrato.${diaRep ? ` Verificar repasse previsto (dia ${String(diaRep).padStart(2, '0')}).` : ''} Despesas a repassar ao locador reduzem o valor líquido do repasse.`,
      });
    }
  }

  return alertas;
}

export function rotuloPapelAdministracao(papel) {
  switch (papel) {
    case PAPEL_ALUGUEL:
      return 'Aluguel recebido';
    case PAPEL_REPASSE:
      return 'Repasse ao locador';
    case PAPEL_DESPESA_REPASSAR:
      return 'Despesa a repassar ao locador';
    default:
      return 'Outros (extrato)';
  }
}
