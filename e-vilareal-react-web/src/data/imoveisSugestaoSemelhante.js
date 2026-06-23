import {
  PAPEL_ALUGUEL,
  PAPEL_CREDITO,
  PAPEL_DEBITO,
  PAPEL_DESPESA_REPASSAR,
  PAPEL_OUTRO,
  PAPEL_REPASSE,
} from './imoveisAdministracaoFinanceiro.js';

/** Chave estável para agrupar lançamentos com o mesmo valor (centavos, com sinal). */
export function chaveValorSemelhante(valor) {
  const v = Number(valor);
  if (!Number.isFinite(v) || v === 0) return null;
  return v.toFixed(2);
}

function padraoDeVinculo(vinc) {
  if (!vinc?.papel) return null;
  switch (String(vinc.papel).toUpperCase()) {
    case 'ALUGUEL':
      return { prioridade: 3, classificacao: { papel: PAPEL_ALUGUEL, motivo: 'semelhante_valor', despesaRepassarAoLocador: false } };
    case 'REPASSE':
      return { prioridade: 3, classificacao: { papel: PAPEL_REPASSE, motivo: 'semelhante_valor', despesaRepassarAoLocador: false } };
    case 'DESPESA': {
      const rotulo = String(vinc.rotuloClassificacao ?? '').trim();
      if (rotulo === 'IPTU') {
        return {
          prioridade: 3,
          classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
          escolhaManual: 'IPTU',
        };
      }
      if (rotulo === 'Condomínio') {
        return {
          prioridade: 3,
          classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
          escolhaManual: 'CONDOMINIO',
        };
      }
      if (rotulo) {
        return {
          prioridade: 3,
          classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
          escolhaManual: 'OUTROS',
          descricaoOutros: rotulo,
        };
      }
      return {
        prioridade: 3,
        classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
        escolhaManual: 'IPTU',
      };
    }
    default:
      return null;
  }
}

function padraoDeEscolhaManual(escolhido, descricaoOutros) {
  const e = String(escolhido ?? '').trim();
  if (!e) return null;
  switch (e) {
    case 'ALUGUEL':
      return {
        prioridade: 2,
        classificacao: { papel: PAPEL_ALUGUEL, motivo: 'semelhante_valor', despesaRepassarAoLocador: false },
      };
    case 'REPASSE':
      return {
        prioridade: 2,
        classificacao: { papel: PAPEL_REPASSE, motivo: 'semelhante_valor', despesaRepassarAoLocador: false },
      };
    case 'IPTU':
      return {
        prioridade: 2,
        classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
        escolhaManual: 'IPTU',
      };
    case 'CONDOMINIO':
      return {
        prioridade: 2,
        classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
        escolhaManual: 'CONDOMINIO',
      };
    case 'OUTROS': {
      const txt = String(descricaoOutros ?? '').trim();
      if (!txt) return null;
      return {
        prioridade: 2,
        classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
        escolhaManual: 'OUTROS',
        descricaoOutros: txt,
      };
    }
    default:
      return null;
  }
}

function padraoDeClassificacaoExistente(classificacao) {
  const p = classificacao?.papel;
  if (p === PAPEL_ALUGUEL) {
    return {
      prioridade: 1,
      classificacao: { papel: PAPEL_ALUGUEL, motivo: 'semelhante_valor', despesaRepassarAoLocador: false },
    };
  }
  if (p === PAPEL_REPASSE) {
    return {
      prioridade: 1,
      classificacao: { papel: PAPEL_REPASSE, motivo: 'semelhante_valor', despesaRepassarAoLocador: false },
    };
  }
  if (p === PAPEL_DESPESA_REPASSAR) {
    return {
      prioridade: 1,
      classificacao: { papel: PAPEL_DESPESA_REPASSAR, motivo: 'semelhante_valor', despesaRepassarAoLocador: true },
      escolhaManual: 'IPTU',
    };
  }
  return null;
}

function registrarPadrao(mapa, chave, padrao) {
  if (!chave || !padrao) return;
  const atual = mapa.get(chave);
  if (!atual || padrao.prioridade >= atual.prioridade) {
    mapa.set(chave, padrao);
  }
}

/** Coleta padrões a partir de lançamentos já classificados (vínculo, escolha manual ou sugestão). */
export function coletarPadroesClassificadosPorValor({
  transacoes = [],
  vinculosPorLancamento,
  escolhasManuais = {},
  descricoesOutros = {},
  classificacoesExtras = {},
}) {
  const mapa = new Map();

  for (const t of transacoes) {
    const id = Number(t?.apiId);
    if (!Number.isFinite(id)) continue;
    const chave = chaveValorSemelhante(t?.valor);
    if (!chave) continue;

    const vinc = vinculosPorLancamento?.get?.(id);
    if (vinc) {
      registrarPadrao(mapa, chave, padraoDeVinculo(vinc));
      continue;
    }

    const escolhido = escolhasManuais[id];
    if (escolhido) {
      registrarPadrao(mapa, chave, padraoDeEscolhaManual(escolhido, descricoesOutros[id]));
      continue;
    }

    const classificacao =
      classificacoesExtras[id] != null
        ? { ...t.classificacao, ...classificacoesExtras[id] }
        : t.classificacao;
    registrarPadrao(mapa, chave, padraoDeClassificacaoExistente(classificacao));
  }

  return mapa;
}

export function linhaElegivelParaSugestaoSemelhante(t, vinculosPorLancamento, escolhasManuais = {}) {
  const id = Number(t?.apiId);
  if (!Number.isFinite(id)) return false;
  if (vinculosPorLancamento?.get?.(id)) return false;
  if (escolhasManuais[id]) return false;

  const p = t?.classificacao?.papel;
  if (p === PAPEL_ALUGUEL || p === PAPEL_REPASSE) return false;
  if (p === PAPEL_DESPESA_REPASSAR) {
    const motivo = t.classificacao?.motivo;
    if (motivo === 'heuristica' || motivo === 'tag') return false;
  }

  return p === PAPEL_DEBITO || p === PAPEL_CREDITO || p === PAPEL_OUTRO || p === PAPEL_DESPESA_REPASSAR;
}

/** Propaga sugestões para lançamentos com o mesmo valor ainda sem classificação. */
export function propagarSugestoesPorValorSemelhante({
  transacoes = [],
  padroes,
  vinculosPorLancamento,
  escolhasManuais = {},
  descricoesOutros = {},
  classificacoesExtras = {},
}) {
  const nextClassificacoes = { ...classificacoesExtras };
  const nextEscolhas = { ...escolhasManuais };
  const nextOutros = { ...descricoesOutros };
  let aplicadas = 0;

  for (const t of transacoes) {
    const id = Number(t?.apiId);
    if (!Number.isFinite(id)) continue;

    const classificacaoAtual =
      nextClassificacoes[id] != null
        ? { ...t.classificacao, ...nextClassificacoes[id] }
        : t.classificacao;
    const tEfetivo = { ...t, classificacao: classificacaoAtual };

    if (!linhaElegivelParaSugestaoSemelhante(tEfetivo, vinculosPorLancamento, nextEscolhas)) continue;

    const chave = chaveValorSemelhante(t?.valor);
    const padrao = chave ? padroes.get(chave) : null;
    if (!padrao) continue;

    nextClassificacoes[id] = padrao.classificacao;
    if (padrao.escolhaManual) {
      nextEscolhas[id] = padrao.escolhaManual;
      if (padrao.descricaoOutros) nextOutros[id] = padrao.descricaoOutros;
    } else {
      delete nextEscolhas[id];
      delete nextOutros[id];
    }
    aplicadas += 1;
  }

  return {
    classificacoesExtras: nextClassificacoes,
    escolhasManuais: nextEscolhas,
    descricoesOutros: nextOutros,
    aplicadas,
  };
}

export function aplicarSugestoesSemelhantes(ctx) {
  const padroes = coletarPadroesClassificadosPorValor(ctx);
  return propagarSugestoesPorValorSemelhante({ ...ctx, padroes });
}
