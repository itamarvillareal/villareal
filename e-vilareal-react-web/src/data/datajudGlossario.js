/**
 * Referência ao glossário da API pública DataJud (estrutura `_source`, tipos, campos de controlo).
 * O MTD **1.2** (CNJ) acrescenta campos ao cabeçalho e às partes — ver `datajudMtd12.js` e normalização em `datajudApiClient.js`.
 *
 * @see https://datajud-wiki.cnj.jus.br/api-publica/glossario/
 */

export const DATAJUD_WIKI_GLOSSARIO_URL = 'https://datajud-wiki.cnj.jus.br/api-publica/glossario/';

/**
 * Nomes de campos frequentes em Query DSL / `_source` (alinhados ao glossário CNJ).
 * `numeroProcesso`: numeração única **sem** pontuação.
 */
export const DATAJUD_CAMPO = Object.freeze({
  numeroProcesso: 'numeroProcesso',
  numeroProcessoKeyword: 'numeroProcesso.keyword',
  classeCodigo: 'classe.codigo',
  orgaoJulgadorCodigo: 'orgaoJulgador.codigo',
  /** Controlo interno no índice; usado no Ex. 3 (`sort` + `search_after`). */
  timestamp: '@timestamp',
});
