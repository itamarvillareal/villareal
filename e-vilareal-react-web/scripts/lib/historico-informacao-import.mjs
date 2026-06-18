/**
 * Normalização da informação (tipo 15) do histórico local — separador de parágrafos legado VBA
 * e repartição entre `titulo` (≤500) e `detalhe` (texto integral).
 */
import { normalizarTextoPlanilha } from './normalizar-texto-planilha.mjs';

/** Marcador legado (`Gerenciar_Paragrafos` / tópicos). */
export const SEPARADOR_BLOCO_HISTORICO = '8*&*@&#(*@&93837942';

export const TITULO_ANDAMENTO_MAX = 500;
export const DETALHE_INFORMACAO_MAX = 65000;

/**
 * Substitui o separador VBA por quebra de parágrafo e normaliza espaços.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizarInformacaoHistorico(raw) {
  let s = normalizarTextoPlanilha(raw);
  if (!s) return '';
  const sep = SEPARADOR_BLOCO_HISTORICO;
  while (s.includes(sep)) {
    s = s.split(sep).join('\n\n');
  }
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * @param {string | null | undefined} responsavel
 * @returns {string | null}
 */
function prefixoConsultorDetalhe(responsavel) {
  const r = String(responsavel ?? '').trim();
  if (!r) return null;
  return `Consultor: ${r}`;
}

/**
 * Reparte informação normalizada entre título (lista/dedupe) e detalhe (texto integral).
 * @param {string} informacaoNorm
 * @param {string | null | undefined} responsavelNorm
 * @returns {{ titulo: string, detalhe: string | null, detalhePlanilhaColG: string | null }}
 */
export function montarCamposAndamentoHistorico(informacaoNorm, responsavelNorm) {
  let info = String(informacaoNorm ?? '').trim();
  if (!info) info = 'Andamento';

  const titulo = info.length > TITULO_ANDAMENTO_MAX ? info.slice(0, TITULO_ANDAMENTO_MAX) : info;
  const textoLongo = info.length > TITULO_ANDAMENTO_MAX;

  if (!textoLongo) {
    return {
      titulo,
      detalhe: responsavelNorm ?? null,
      detalhePlanilhaColG: null,
    };
  }

  let corpo = info.length > DETALHE_INFORMACAO_MAX ? info.slice(0, DETALHE_INFORMACAO_MAX) : info;
  const consultor = prefixoConsultorDetalhe(responsavelNorm);
  const detalhe = consultor ? `${consultor}\n\n${corpo}` : corpo;

  return {
    titulo,
    detalhe,
    detalhePlanilhaColG: detalhe,
  };
}

/**
 * @param {unknown} informacaoBruta
 * @param {string | null | undefined} responsavelNorm
 */
export function montarCamposAndamentoFromInformacaoBruta(informacaoBruta, responsavelNorm) {
  return montarCamposAndamentoHistorico(normalizarInformacaoHistorico(informacaoBruta), responsavelNorm);
}

/**
 * Entrada de histórico que exige reimportação com texto completo (truncamento antigo ou separador legado).
 * @param {unknown} informacaoBruta
 * @returns {{ motivos: string[], tamanhoBruto: number, tamanhoNormalizado: number, perdaTituloAntigo: number } | null}
 */
export function analisarInformacaoHistoricoParaReimport(informacaoBruta) {
  const bruto = normalizarTextoPlanilha(informacaoBruta);
  if (!bruto) return null;
  const temSeparador = bruto.includes(SEPARADOR_BLOCO_HISTORICO);
  const norm = normalizarInformacaoHistorico(informacaoBruta);
  const textoLongo = norm.length > TITULO_ANDAMENTO_MAX;
  if (!temSeparador && !textoLongo) return null;
  /** @type {string[]} */
  const motivos = [];
  if (textoLongo) motivos.push('texto_maior_500');
  if (temSeparador) motivos.push('separador_legado');
  return {
    motivos,
    tamanhoBruto: bruto.length,
    tamanhoNormalizado: norm.length,
    perdaTituloAntigo: Math.max(0, norm.length - TITULO_ANDAMENTO_MAX),
  };
}
