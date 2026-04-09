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

export const PAPEL_ALUGUEL = 'aluguel';
export const PAPEL_REPASSE = 'repasse';
export const PAPEL_DESPESA_REPASSAR = 'despesa_repassar';
export const PAPEL_OUTRO = 'outro';

/** Marcadores opcionais na descrição detalhada / categoria (classificação no Financeiro). */
export const TAG_ADM_ALUGUEL = '[ADM_IMOVEL:ALUGUEL]';
export const TAG_ADM_REPASSE = '[ADM_IMOVEL:REPASSE]';
export const TAG_ADM_DESPESA = '[ADM_IMOVEL:DESPESA_REPASSAR]';

export function imovelIdPorCodigoProc() {
  return null;
}

/** Sem cadastro legado local — classificação só com dados reais da API de imóveis (quando existir). */
export function processoEhAdministracaoImovel() {
  return false;
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

function parseDiaCadastroImovel(v) {
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

function lancamentosDoMesOrdenados(transacoes, chaveMes) {
  return transacoes
    .filter((t) => {
      const mr = mesReferenciaDataBr(t.data);
      return mr && mr.chave === chaveMes;
    })
    .sort((a, b) => {
      const ma = mesReferenciaDataBr(a.data);
      const mb = mesReferenciaDataBr(b.data);
      return String(ma.sortKey).localeCompare(String(mb.sortKey));
    });
}

function primeiroLancamentoComPapel(list, papel, credito) {
  for (const t of list) {
    if (t.classificacao?.papel !== papel) continue;
    const v = Number(t.valor) || 0;
    if (credito && v > 0) return t;
    if (!credito && v < 0) return t;
  }
  return null;
}

/** Compara o dia civil do lançamento com o dia limite cadastrado no imóvel (pagamento até / repasse até). */
function classificarPrazoVersusCadastro(dataBrLanc, diaLimite) {
  if (!dataBrLanc) return 'ausente';
  if (diaLimite == null) return 'sem_prazo_cadastrado';
  const mr = mesReferenciaDataBr(dataBrLanc);
  if (!mr) return 'ausente';
  if (mr.dia <= diaLimite) return 'ok';
  return 'atraso';
}

/**
 * Monta linhas do relatório consolidado (todos os imóveis × um mês de referência).
 * Dados: mesmos lançamentos do Financeiro com Cod. cliente + Proc. do imóvel; classificação aluguel/repasse
 * (tags `[ADM_IMOVEL:ALUGUEL]` / `[ADM_IMOVEL:REPASSE]` ou heurísticas em `classificarLancamentoAdministracaoImovel`).
 *
 * @param {string} chaveMesYYYYMM ex. `2026-03`
 * @param {{ soOcupados?: boolean }} opts
 */
export function buildRelatorioFinanceiroImoveisMes(chaveMesYYYYMM, opts = {}) {
  void chaveMesYYYYMM;
  void opts;
  return [];
}

function montarLinhaRelatorioFinanceiroImovelMes(imovelMock, chaveMes) {
  const cod = imovelMock.codigo;
  const proc = imovelMock.proc;
  const { transacoes, porMes } = montarPainelAdministracaoImovel(cod, proc);
  const row = porMes.get(chaveMes);
  const listaMes = lancamentosDoMesOrdenados(transacoes, chaveMes);
  const aluguel = primeiroLancamentoComPapel(listaMes, PAPEL_ALUGUEL, true);
  const repasse = primeiroLancamentoComPapel(listaMes, PAPEL_REPASSE, false);
  const diaPagCad = parseDiaCadastroImovel(imovelMock.diaPagAluguel);
  const diaRepCad = parseDiaCadastroImovel(imovelMock.diaRepasse);
  const valorRef = Number(String(imovelMock.valorLocacao ?? '').replace(',', '.')) || 0;
  const ocupado = Boolean(imovelMock.imovelOcupado);

  const totalAluguel = row?.totalRecebido ?? 0;
  const totalRepasse = row?.totalRepasse ?? 0;

  let statusAluguel = '—';
  let legendaAluguel = '';
  if (!ocupado) {
    statusAluguel = 'n_a';
    legendaAluguel = 'Imóvel desocupado';
  } else if (valorRef <= 0) {
    statusAluguel = 'sem_ref';
    legendaAluguel = 'Sem valor de locação no cadastro';
  } else if (!aluguel || totalAluguel <= 0) {
    statusAluguel = 'pendente';
    legendaAluguel = diaPagCad
      ? `Referência: receber até o dia ${String(diaPagCad).padStart(2, '0')}`
      : 'Nenhum crédito classificado como aluguel no Financeiro neste mês';
  } else if (diaPagCad == null) {
    statusAluguel = 'ok_sem_prazo';
    legendaAluguel = 'Recebido; cadastro sem dia de pagamento de aluguel';
  } else {
    statusAluguel = classificarPrazoVersusCadastro(aluguel.data, diaPagCad);
    legendaAluguel = `Prazo no cadastro: dia ${String(diaPagCad).padStart(2, '0')}`;
  }

  let statusRepasse = '—';
  let legendaRepasse = '';
  if (!ocupado) {
    statusRepasse = 'n_a';
    legendaRepasse = 'Imóvel desocupado';
  } else if (valorRef <= 0) {
    statusRepasse = 'sem_ref';
    legendaRepasse = 'Sem valor de locação no cadastro';
  } else if (!aluguel || totalAluguel <= 0) {
    statusRepasse = 'aguarda_aluguel';
    legendaRepasse = 'Repasse só é avaliado após identificar aluguel no mês';
  } else if (!repasse || totalRepasse <= 0) {
    statusRepasse = 'pendente';
    legendaRepasse = diaRepCad
      ? `Referência: repasse até o dia ${String(diaRepCad).padStart(2, '0')}`
      : 'Nenhum débito classificado como repasse no Financeiro neste mês';
  } else if (diaRepCad == null) {
    statusRepasse = 'ok_sem_prazo';
    legendaRepasse = 'Repasse identificado; cadastro sem dia de repasse';
  } else {
    statusRepasse = classificarPrazoVersusCadastro(repasse.data, diaRepCad);
    legendaRepasse = `Prazo no cadastro: dia ${String(diaRepCad).padStart(2, '0')}`;
  }

  return {
    unidade: String(imovelMock.unidade ?? ''),
    codigo: cod,
    proc: proc,
    valorReferenciaLocacao: valorRef,
    totalAluguel,
    totalRepasse,
    dataPrimeiroAluguel: aluguel?.data ?? null,
    dataPrimeiroRepasse: repasse?.data ?? null,
    diaPagCad,
    diaRepCad,
    statusAluguel,
    statusRepasse,
    legendaAluguel,
    legendaRepasse,
  };
}
