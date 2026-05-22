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
import { getRegistroProcesso } from './processosHistoricoData.js';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';

export const PAPEL_ALUGUEL = 'aluguel';
export const PAPEL_REPASSE = 'repasse';
export const PAPEL_DESPESA_REPASSAR = 'despesa_repassar';
/** Crédito vinculado ao processo — papel sugerido; o usuário reclassifica na tela do imóvel. */
export const PAPEL_CREDITO = 'credito';
/** Débito vinculado ao processo — papel sugerido; o usuário reclassifica na tela do imóvel. */
export const PAPEL_DEBITO = 'debito';
export const PAPEL_OUTRO = 'outro';

/** Marcadores opcionais na descrição detalhada / categoria (classificação no Financeiro). */
export const TAG_ADM_ALUGUEL = '[ADM_IMOVEL:ALUGUEL]';
export const TAG_ADM_REPASSE = '[ADM_IMOVEL:REPASSE]';
export const TAG_ADM_DESPESA = '[ADM_IMOVEL:DESPESA_REPASSAR]';

export function imovelIdPorCodigoProc() {
  return null;
}

export function numeroImovelCampoProcessoValido(valor) {
  const n = Math.trunc(Number(String(valor ?? '').replace(/\D/g, '')));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function chaveParCodProc(codigoCliente, proc) {
  const cod = normalizarCodigoClienteFinanceiro(codigoCliente);
  const procNorm = normalizarProcFinanceiro(proc);
  if (!cod || procNorm === '') return '';
  return `${cod}|${procNorm}`;
}

export function parCodProcDeLancamentoUi(t) {
  const cod = normalizarCodigoClienteFinanceiro(t?.codCliente ?? t?.codigo);
  const procNorm = normalizarProcFinanceiro(t?.proc);
  if (!cod || procNorm === '') return null;
  const procNum = Number(procNorm);
  return {
    codigoNorm: cod,
    procNorm,
    codigoNum: Number(cod),
    procNum: Number.isFinite(procNum) ? procNum : null,
  };
}

/** Pares distintos (cod. cliente + proc.) com pelo menos um lançamento no mês de referência. */
export function paresCodProcComLancamentosNoMes(lancamentos, chaveMesYYYYMM) {
  const pares = new Map();
  for (const t of lancamentos || []) {
    if (mesReferenciaLancamentoParaRelatorio(t)?.chave !== chaveMesYYYYMM) continue;
    const par = parCodProcDeLancamentoUi(t);
    if (!par) continue;
    pares.set(chaveParCodProc(par.codigoNorm, par.procNorm), par);
  }
  return [...pares.values()];
}

export function intervaloIsoMesReferencia(chaveMesYYYYMM) {
  const [ys, ms] = String(chaveMesYYYYMM).split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m) return null;
  const ultimoDia = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    dataInicio: `${y}-${mm}-01`,
    dataFim: `${y}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

/**
 * Índice cod.+proc. → cadastro UI do imóvel (extras, contrato, unidade).
 * @param {object[]} itensCadastro
 */
export function construirIndiceImoveisPorCodProc(itensCadastro) {
  const map = new Map();
  for (const item of itensCadastro || []) {
    const chave = chaveParCodProc(item.codigo, item.proc);
    if (!chave) continue;
    map.set(chave, item);
  }
  return map;
}

/**
 * Nº do imóvel (campo Imóvel em Processos / col. A): cadastro do imóvel ou histórico local do processo.
 */
export function resolverNumeroImovelParCodProc(par, indicePorCodProc) {
  if (!par) return null;
  const chave = chaveParCodProc(par.codigoNorm, par.procNorm);
  const doCadastro = numeroImovelCampoProcessoValido(indicePorCodProc?.get(chave)?.imovelId);
  if (doCadastro) return doCadastro;
  const reg = getRegistroProcesso(par.codigoNorm, par.procNorm);
  return numeroImovelCampoProcessoValido(reg?.imovelId);
}

export function itemCadastroMinimoRelatorioImovel(par, numeroImovel) {
  return {
    imovelId: numeroImovel,
    imovelOcupado: true,
    codigo: par.codigoNum,
    proc: String(par.procNorm),
    unidade: '',
    condominio: '',
    endereco: '',
    inquilino: '',
    valorLocacao: '',
    diaPagAluguel: '',
    diaRepasse: '',
  };
}

/**
 * Heurísticas de classificação (aluguel/repasse/despesa) na tela de administração de imóveis.
 * @param {string} [_codigoCliente]
 * @param {string|number} [_proc]
 * @param {{ assumirAdm?: boolean, naturezaAcao?: string }} [opts]
 */
export function processoEhAdministracaoImovel(_codigoCliente, _proc, opts = {}) {
  if (opts.assumirAdm === true) return true;
  const n = String(opts.naturezaAcao ?? '').toUpperCase();
  return /ADMINISTRA/.test(n) && /IM[OÓ]VEL/.test(n);
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

  const ehAdm = processoEhAdministracaoImovel(codigoCliente, proc, { assumirAdm: true });
  if (!ehAdm) {
    return { papel: PAPEL_OUTRO, motivo: 'generico', despesaRepassarAoLocador: false };
  }

  const v = Number(t.valor);
  if (v > 0 && /\b(ALUG|ALUGUEL|LOCA|LOCAÇ|LOCAC)\b/.test(txt)) {
    return { papel: PAPEL_ALUGUEL, motivo: 'heuristica', despesaRepassarAoLocador: false };
  }
  const pareceRepasse =
    v < 0 &&
    (/\b(REPASSE|REPAS\.|LOCADOR|PROPRIET|PROPRIETÁRIO|PROPRIETARIO)\b/.test(txt) ||
      /\bPIX\s*TRANSF\b/.test(txt) ||
      /\bTRANSF(?:ER[ÊE]NCIA)?\b/.test(txt));
  if (pareceRepasse) {
    return { papel: PAPEL_REPASSE, motivo: 'heuristica', despesaRepassarAoLocador: false };
  }
  if (
    v < 0 &&
    (/\b(MANUT|TAXA|SERVI|SERVIÇ|CONDOM|ENCARG|DESP|IPTU|CONDOMIN)\b/.test(txt) ||
      String(t.letra ?? '').trim().toUpperCase() === 'I')
  ) {
    return { papel: PAPEL_DESPESA_REPASSAR, motivo: 'heuristica', despesaRepassarAoLocador: true };
  }

  if (v > 0) {
    return { papel: PAPEL_CREDITO, motivo: 'padrao_credito', despesaRepassarAoLocador: false };
  }
  if (v < 0) {
    return { papel: PAPEL_DEBITO, motivo: 'padrao_debito', despesaRepassarAoLocador: false };
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

/** Mês do relatório / painel: data do lançamento no extrato; se ausente, competência. */
export function mesReferenciaLancamentoParaRelatorio(t) {
  return mesReferenciaDataBr(t?.data) || mesReferenciaDataBr(t?.dataCompetencia);
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
 *   fonte?: 'api' | 'local',
 * }}
 */
export function montarPainelAdministracaoImovelDeTransacoes(transacoesRaw, codigoCliente, proc, opts = {}) {
  const transacoes = (transacoesRaw || []).map((t) => ({
    ...t,
    classificacao: classificarLancamentoAdministracaoImovel(t, codigoCliente, proc),
  }));

  const porMes = new Map();

  for (const t of transacoes) {
    const mes = mesReferenciaLancamentoParaRelatorio(t);
    if (!mes) continue;
    if (!porMes.has(mes.chave)) {
      porMes.set(mes.chave, {
        chave: mes.chave,
        label: mes.label,
        totalCreditos: 0,
        totalDebitos: 0,
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

    if (v > 0) row.totalCreditos += v;
    if (v < 0) row.totalDebitos += Math.abs(v);

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

  transacoes.sort((a, b) => {
    const ka = mesReferenciaLancamentoParaRelatorio(a)?.sortKey ?? '';
    const kb = mesReferenciaLancamentoParaRelatorio(b)?.sortKey ?? '';
    return kb.localeCompare(ka);
  });

  return { transacoes, porMes, mesesOrdenados, fonte: opts.fonte };
}

/** Extrato local (localStorage) — fallback quando a API financeira está desligada. */
export function montarPainelAdministracaoImovel(codigoCliente, proc) {
  const raw = getTransacoesContaCorrenteCompleto(codigoCliente, proc);
  return montarPainelAdministracaoImovelDeTransacoes(raw, codigoCliente, proc, { fonte: 'local' });
}

/** Alertas operacionais (aluguel / repasse ausentes no extrato). */
export function gerarAlertasAdministracaoImovel(imovelMock, porMes, mesesOrdenados) {
  const alertas = [];
  if (!imovelMock || !imovelMock.imovelOcupado) return alertas;

  const valorRef = parseValorMonetarioBr(imovelMock.valorLocacao) ?? 0;
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
    case PAPEL_CREDITO:
      return 'Crédito (classificar)';
    case PAPEL_DEBITO:
      return 'Débito (classificar)';
    default:
      return 'Outros (extrato)';
  }
}

function parseDiaCadastro(diaCadastro) {
  const n = Number(String(diaCadastro ?? '').replace(/\D/g, ''));
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

function dataLimitePrazoNoMes(chaveMesYYYYMM, dia) {
  const [ys, ms] = String(chaveMesYYYYMM).split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m) return null;
  const ultimoDia = new Date(y, m, 0).getDate();
  const d = Math.min(dia, ultimoDia);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Situação de aluguel ou repasse em um mês (cadastro do dia + totais do extrato). */
export function avaliarSituacaoFluxoMes({
  totalNoMes,
  dataPrimeiroNoMes,
  diaCadastro,
  chaveMesYYYYMM,
  hoje = new Date(),
}) {
  const total = Number(totalNoMes) || 0;
  const dia = parseDiaCadastro(diaCadastro);

  if (total > 0) {
    const legenda = dataPrimeiroNoMes ? `Recebido em ${dataPrimeiroNoMes}` : '';
    if (!dia) return { status: 'ok_sem_prazo', legenda };
    return { status: 'ok', legenda };
  }

  if (!dia) {
    return { status: 'sem_prazo_cadastrado', legenda: 'Cadastre o dia no contrato do imóvel.' };
  }

  const [ys, ms] = String(chaveMesYYYYMM).split('-');
  const y = Number(ys);
  const m = Number(ms);
  const fimMes = new Date(y, m, 0, 23, 59, 59, 999);
  const limite = dataLimitePrazoNoMes(chaveMesYYYYMM, dia);

  if (hoje > fimMes) {
    return {
      status: 'ausente',
      legenda: `Sem lançamento no mês (prazo dia ${String(dia).padStart(2, '0')}).`,
    };
  }

  if (limite && hoje > limite) {
    return { status: 'atraso', legenda: `Previsto até dia ${String(dia).padStart(2, '0')}.` };
  }

  return { status: 'pendente', legenda: `Previsto dia ${String(dia).padStart(2, '0')}.` };
}

export function avaliarSituacaoRepasseMes({
  totalRepasse,
  totalAluguel,
  diaCadastro,
  chaveMesYYYYMM,
  dataPrimeiroRepasse,
  hoje = new Date(),
}) {
  const repasse = Number(totalRepasse) || 0;
  const aluguel = Number(totalAluguel) || 0;

  if (repasse > 0) {
    return avaliarSituacaoFluxoMes({
      totalNoMes: repasse,
      dataPrimeiroNoMes: dataPrimeiroRepasse,
      diaCadastro,
      chaveMesYYYYMM,
      hoje,
    });
  }

  if (aluguel > 0) {
    const base = avaliarSituacaoFluxoMes({
      totalNoMes: 0,
      dataPrimeiroNoMes: null,
      diaCadastro,
      chaveMesYYYYMM,
      hoje,
    });
    if (base.status === 'pendente' || base.status === 'atraso' || base.status === 'ausente') {
      return {
        status: 'aguarda_aluguel',
        legenda: 'Aluguel no mês; repasse ainda não identificado no extrato.',
      };
    }
    return base;
  }

  return avaliarSituacaoFluxoMes({
    totalNoMes: 0,
    dataPrimeiroNoMes: null,
    diaCadastro,
    chaveMesYYYYMM,
    hoje,
  });
}

export function extrairTotaisFinanceirosMes(lancamentos, codigoCliente, proc, chaveMesYYYYMM) {
  const doMes = (lancamentos || []).filter(
    (t) => mesReferenciaLancamentoParaRelatorio(t)?.chave === chaveMesYYYYMM,
  );
  const marcados = doMes.map((t) => ({
    ...t,
    classificacao: classificarLancamentoAdministracaoImovel(t, codigoCliente, proc),
  }));
  const aluguel = marcados.find((t) => t.classificacao?.papel === 'aluguel' && Number(t.valor) > 0);
  const repasse = marcados.find((t) => t.classificacao?.papel === 'repasse' && Number(t.valor) < 0);
  return {
    totalAluguel: marcados
      .filter((t) => t.classificacao?.papel === 'aluguel' && Number(t.valor) > 0)
      .reduce((s, t) => s + Number(t.valor || 0), 0),
    totalRepasse: Math.abs(
      marcados
        .filter((t) => t.classificacao?.papel === 'repasse' && Number(t.valor) < 0)
        .reduce((s, t) => s + Number(t.valor || 0), 0),
    ),
    dataPrimeiroAluguel: aluguel?.data ?? null,
    dataPrimeiroRepasse: repasse?.data ?? null,
  };
}

export function linhaRelatorioFinanceiroFromCadastro(item, chaveMesYYYYMM, totaisFinanceiros = {}) {
  const codigoNum = Number(String(item.codigo ?? '').replace(/\D/g, ''));
  const procStr = item.proc != null && String(item.proc).trim() !== '' ? String(item.proc).trim() : '';
  const temVinculo = codigoNum > 0 && procStr !== '';

  const {
    totalAluguel = 0,
    totalRepasse = 0,
    dataPrimeiroAluguel = null,
    dataPrimeiroRepasse = null,
  } = totaisFinanceiros;

  const valorReferenciaLocacao = parseValorMonetarioBr(item.valorLocacao) ?? 0;
  const alug = avaliarSituacaoFluxoMes({
    totalNoMes: totalAluguel,
    dataPrimeiroNoMes: dataPrimeiroAluguel,
    diaCadastro: item.diaPagAluguel,
    chaveMesYYYYMM,
  });
  const rep = avaliarSituacaoRepasseMes({
    totalRepasse,
    totalAluguel,
    diaCadastro: item.diaRepasse,
    chaveMesYYYYMM,
    dataPrimeiroRepasse,
  });

  const locatario = String(item.inquilino ?? '').trim();

  return {
    imovelId: item.imovelId,
    unidade: String(item.unidade || item.condominio || item.endereco || '').trim() || '—',
    locatario: locatario || '—',
    codigo: codigoNum > 0 ? codigoNum : item.codigo || '—',
    proc: procStr || '—',
    valorReferenciaLocacao,
    totalAluguel,
    totalRepasse,
    dataPrimeiroAluguel,
    dataPrimeiroRepasse,
    statusAluguel: temVinculo ? alug.status : 'n_a',
    legendaAluguel: temVinculo ? alug.legenda : 'Vincule Cod. cliente e Proc. no cadastro.',
    statusRepasse: temVinculo ? rep.status : 'n_a',
    legendaRepasse: temVinculo ? rep.legenda : '',
  };
}

/**
 * Monta linhas do relatório a partir do cadastro (sem filtro por extrato).
 * Preferir {@link montarLinhasRelatorioFinanceiroImoveisExtrato}.
 *
 * @param {object[]} itens cadastro UI (`mapApiToUi`)
 * @param {string} chaveMesYYYYMM ex. `2026-03`
 * @param {{ soOcupados?: boolean }} opts
 */
export function buildRelatorioFinanceiroImoveisMes(itens, chaveMesYYYYMM, opts = {}) {
  const { soOcupados = true } = opts;
  return (itens || [])
    .filter((item) => !soOcupados || item.imovelOcupado)
    .map((item) => linhaRelatorioFinanceiroFromCadastro(item, chaveMesYYYYMM))
    .sort((a, b) => (Number(a.imovelId) || 0) - (Number(b.imovelId) || 0));
}

/**
 * Relatório orientado ao extrato: só pares com lançamento no mês e nº de imóvel (Processos ou cadastro).
 *
 * @param {object[]} itensCadastro
 * @param {Array<{ codigoNorm: string, procNorm: string, codigoNum: number, procNum: number|null }>} paresCodProc
 * @param {string} chaveMesYYYYMM
 * @param {{ soOcupados?: boolean, totaisPorPar?: Map<string, object> }} opts
 */
export function montarLinhasRelatorioFinanceiroImoveisExtrato(
  itensCadastro,
  paresCodProc,
  chaveMesYYYYMM,
  opts = {},
) {
  const { soOcupados = true, totaisPorPar = new Map() } = opts;
  const indice = construirIndiceImoveisPorCodProc(itensCadastro);
  const porNumero = new Map();
  for (const item of itensCadastro || []) {
    const np = numeroImovelCampoProcessoValido(item.imovelId);
    if (np) porNumero.set(np, item);
  }

  const linhas = [];
  for (const par of paresCodProc || []) {
    const numeroImovel = resolverNumeroImovelParCodProc(par, indice);
    if (!numeroImovel) continue;

    const chave = chaveParCodProc(par.codigoNorm, par.procNorm);
    let item = indice.get(chave) || porNumero.get(numeroImovel);
    if (!item) item = itemCadastroMinimoRelatorioImovel(par, numeroImovel);
    if (soOcupados && !item.imovelOcupado) continue;

    const totais = totaisPorPar.get(chave) || {};
    linhas.push(linhaRelatorioFinanceiroFromCadastro(item, chaveMesYYYYMM, totais));
  }

  return linhas.sort((a, b) => (Number(a.imovelId) || 0) - (Number(b.imovelId) || 0));
}
