import {
  CARTAO_TO_NUMERO,
  isNomeCartaoFinanceiro,
  isNumeroCartaoFinanceiro,
} from '../../../data/financeiroData.js';
import { dataCompraCartaoCorrigida } from '../../../utils/cartaoFaturaVencimento.js';
import { dataNoPeriodo } from '../shared/periodoFinanceiro.js';
import { formatDataBrCompleta, formatDataBrCompletaComDiaSemana } from '../shared/financeiroFormat.js';
import { mapApiLancamentoToExtratoRow } from '../extrato/extratoMappers.js';

/** Linha mínima de par de compensação ({@link ResumoLancamentoParResponse}). */
export function mapResumoParToExtratoRow(l) {
  const dataIso = String(l?.dataLancamento ?? '').slice(0, 10);
  const natureza = String(l?.natureza ?? '').toUpperCase() === 'DEBITO' ? 'DEBITO' : 'CREDITO';
  return {
    id: Number(l?.id),
    dataLancamento: dataIso,
    dataExibicao: formatDataBrCompletaComDiaSemana(dataIso),
    descricao: String(l?.descricao ?? ''),
    bancoNome: String(l?.banco ?? l?.bancoNome ?? ''),
    numeroBanco: l?.numeroBanco ?? null,
    valor: Math.abs(Number(l?.valor ?? 0)),
    natureza,
  };
}

function enriquecerLancamentoCartaoInbox(row, origem) {
  const numeroCartao =
    Number(row.numeroCartao) > 0
      ? Number(row.numeroCartao)
      : isNumeroCartaoFinanceiro(row.numeroBanco)
        ? Number(row.numeroBanco)
        : CARTAO_TO_NUMERO[String(row.bancoNome ?? '').trim()] ?? null;
  const ehCartao =
    row.origemExtrato === 'cartao' ||
    isNomeCartaoFinanceiro(row.bancoNome) ||
    isNumeroCartaoFinanceiro(numeroCartao);
  if (!ehCartao) return row;

  const dataCompetencia = String(origem?.dataCompetencia ?? row.dataCompetencia ?? '').slice(0, 10) || null;
  return {
    ...row,
    origemExtrato: 'cartao',
    numeroCartao,
    numeroBanco: numeroCartao ?? row.numeroBanco,
    dataCompetencia,
  };
}

export function mapLancamentoInbox(l) {
  if (l?.dataLancamento != null && l?.banco != null && l?.contaContabilNome == null) {
    return mapResumoParToExtratoRow(l);
  }
  const row = mapApiLancamentoToExtratoRow(l);
  const dataLancamento =
    dataCompraCartaoCorrigida(l) || String(row.dataLancamento ?? '').slice(0, 10);
  const base = {
    ...row,
    dataLancamento,
    dataExibicao: formatDataBrCompleta(dataLancamento),
    dataCompetencia: l?.dataCompetencia ? String(l.dataCompetencia).slice(0, 10) : null,
  };
  return enriquecerLancamentoCartaoInbox(base, l);
}

export function textoOrigemSugestao(sug) {
  if (!sug) return '';
  const origem = String(sug.origem ?? '').toUpperCase();
  if (origem === 'REGRA' && sug.descricaoRegra) {
    return `regra: ${sug.descricaoRegra}`;
  }
  if (origem === 'HISTORICO' && sug.ocorrencias != null) {
    return `histórico: ${sug.ocorrencias} ocorrências`;
  }
  if (origem === 'HISTORICO_POSTERIOR' && sug.ocorrencias != null) {
    return `histórico posterior: ${sug.ocorrencias} ocorrências`;
  }
  if (origem === 'RECORRENCIA') {
    return 'recorrência mensal';
  }
  if (origem === 'RECORRENCIA_POSTERIOR') {
    return 'recorrência posterior';
  }
  if (origem === 'RECORRENCIA_NOME') {
    return 'mesmo estabelecimento (valor divergente)';
  }
  if (origem === 'DEPOSITO_IDENTIFICADO' && sug.descricaoRegra) {
    return sug.descricaoRegra;
  }
  if (origem === 'PESSOA_PROCESSO') {
    if (sug.rotuloVinculo) return `cliente: ${sug.rotuloVinculo}`;
    if (sug.descricaoRegra) return sug.descricaoRegra;
  }
  return origem.toLowerCase();
}

export function parKey(par) {
  const a = par?.lancamentoA?.id ?? par?.lancamentoIdA;
  const b = par?.lancamentoB?.id ?? par?.lancamentoIdB;
  return `${a}-${b}`;
}

export function valorAssinadoLancamento(l) {
  if (!l) return 0;
  const v = Math.abs(Number(l.valor ?? 0));
  return String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -v : v;
}

export function somaParCompensacao(par) {
  const a = valorAssinadoLancamento(par.lancamentoA);
  const b = valorAssinadoLancamento(par.lancamentoB);
  return Math.round((a + b) * 100) / 100;
}

export function labelTipoPar(tipo) {
  const t = String(tipo ?? '').toUpperCase();
  if (t === 'INTERBANCARIO') return 'Interbancário';
  if (t === 'MESMO_BANCO') return 'Mesmo banco';
  return tipo || '—';
}

export function labelDiaPar(par) {
  const da = dataCalendarioPar(par?.lancamentoA);
  const db = dataCalendarioPar(par?.lancamentoB);
  if (da && db && da === db) return 'Mesmo dia';
  if (da && db) return 'Dia divergente';
  return '—';
}

function dataCalendarioPar(lanc) {
  return String(lanc?.dataLancamento ?? '').slice(0, 10);
}

/**
 * Garante que a lista obedece aos filtros da UI (tipo banco / dia calendário),
 * mesmo se a API ignorar parâmetros ou devolver resposta de requisição antiga.
 */
export function parPassaFiltrosCompensacao(
  par,
  { tipoPar = 'TODOS', tipoDia = 'TODOS', periodo = null } = {},
) {
  const t = String(par?.tipo ?? '').toUpperCase();
  if (tipoPar === 'INTERBANCARIO' && t !== 'INTERBANCARIO') return false;
  if (tipoPar === 'MESMO_BANCO' && t !== 'MESMO_BANCO') return false;

  const da = dataCalendarioPar(par?.lancamentoA);
  const db = dataCalendarioPar(par?.lancamentoB);
  if (!da || !db) return false;
  const mesmoDia = da === db;
  if (tipoDia === 'MESMO_DIA' && !mesmoDia) return false;
  if (tipoDia === 'DIVERGENTE' && mesmoDia) return false;

  if (periodo) {
    if (
      !dataNoPeriodo(par?.lancamentoA?.dataLancamento, periodo) ||
      !dataNoPeriodo(par?.lancamentoB?.dataLancamento, periodo)
    ) {
      return false;
    }
  }
  return true;
}

export function filtrarParesCompensacao(pares, filtros) {
  const lista = Array.isArray(pares) ? pares : [];
  return lista.filter((p) => parPassaFiltrosCompensacao(p, filtros));
}

const TOLERANCIA_PAR = 0.01;

/**
 * Pré-processa par para a UI (evita mapLancamentoInbox a cada render).
 * @param {object} par
 */
export function mapParCompensacaoParaUi(par) {
  const deb =
    String(par.lancamentoA?.natureza ?? '').toUpperCase() === 'DEBITO'
      ? par.lancamentoA
      : par.lancamentoB;
  const cred =
    String(par.lancamentoA?.natureza ?? '').toUpperCase() === 'CREDITO'
      ? par.lancamentoA
      : par.lancamentoB;
  const soma = somaParCompensacao(par);
  const zero = Math.abs(soma) < TOLERANCIA_PAR;
  const dentroTolerancia = !zero && Math.abs(soma) <= 1;

  return {
    key: parKey(par),
    par,
    debRow: mapLancamentoInbox(deb ?? par.lancamentoA),
    credRow: mapLancamentoInbox(cred ?? par.lancamentoB),
    soma,
    zero,
    dentroTolerancia,
    tipoLabel: labelTipoPar(par.tipo),
    diaLabel: labelDiaPar(par),
  };
}

export function acaoInconsistencia(sugestao, soma) {
  const s = String(sugestao ?? '').toUpperCase();
  const v = Number(soma);
  switch (s) {
    case 'DIFERENCA_TAXA':
      return { label: `Criar ajuste R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, informativo: true };
    case 'DUPLICADO':
      return { label: 'Revisar duplicatas', informativo: true };
    case 'INCOMPLETO':
      return { label: 'Buscar par', link: '/financeiro/inbox/compensar', informativo: true };
    default:
      return { label: 'Revisar manualmente', informativo: true };
  }
}
