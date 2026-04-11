/**
 * Referências à **parametrização** do DataJud / **Painel de Estatísticas** do Poder Judiciário (CNJ).
 *
 * Isto é **distinto** da API pública `POST …/_search` (metadados por processo no índice do tribunal): o painel
 * consome **datamart** com **situações**, regras de **classes** por ramo, **indicadores** e dicionários de download,
 * alinhados aos movimentos parametrizados no **SGT** e às **TPU** (Res. CNJ 46/2007, Res. 331/2020).
 *
 * Documentação típica (actualizações mensais, ex. **12/2025**): botão «Parametrização / indicadores» no painel —
 * ficheiros como *Situações Datamart*, *Parametrização classes todos os ramos*, *Indicadores e dicionário*,
 * boletim de mudanças e guia *Como utilizar parametrização* (versão 3.1).
 *
 * @see https://www.cnj.jus.br/sistemas/datajud/parametrizacao/
 */

export const DATAJUD_URL_PARAMETRIZACAO =
  'https://www.cnj.jus.br/sistemas/datajud/parametrizacao/';

/**
 * Exemplos citados no **boletim de parametrização dez/2025** (regras negociais painel — não confundir com
 * domínios separados da TPU onde o mesmo dígito pode classificar entidades diferentes).
 * Útil para cruzar com `movimentos[].codigo` no `_source` da API pública.
 */
export const DATAJUD_BOLETIM_2025_12_EXEMPLOS = Object.freeze({
  /** Situação «Distribuído» — G1/JE: movimentação Distribuição. */
  situacaoDistribuido: 24,
  movimentoDistribuicao: 26,
  /** Situação «Recebido» — G1/JE: movimentações Recebimento. */
  situacaoRecebido: 38,
  movimentoRecebimento1: 132,
  movimentoRecebimento2: 981,
  /** G2, TR, SUP: Distribuição (26) → situação Recebido pelo Tribunal. */
  situacaoRecebidoPeloTribunal: 61,
});

/**
 * Legenda curta quando o código de movimento coincide com exemplos do boletim dez/2025 (painel).
 * @param {unknown} codigoMovimento — ex. `movimentos[].codigo`
 * @returns {string|null}
 */
export function datajudBoletimLegendaMovimento(codigoMovimento) {
  const n = Number(codigoMovimento);
  if (!Number.isFinite(n)) return null;
  if (n === DATAJUD_BOLETIM_2025_12_EXEMPLOS.movimentoDistribuicao) {
    return 'Mov. citado no painel (Distribuição → situação Distribuído em G1/JE).';
  }
  if (
    n === DATAJUD_BOLETIM_2025_12_EXEMPLOS.movimentoRecebimento1 ||
    n === DATAJUD_BOLETIM_2025_12_EXEMPLOS.movimentoRecebimento2
  ) {
    return 'Mov. citado no painel (Recebimento → situação Recebido em G1/JE).';
  }
  return null;
}
