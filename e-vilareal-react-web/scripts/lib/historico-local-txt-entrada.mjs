/**
 * Avaliação de uma entrada de histórico (índice N) — regras alinhadas ao extrator/importador.
 */

import {
  extrairYmdParaPastasAno,
  formatIndice4,
  lerTextoTipoHistoricoEncadeado,
  lerTipo16PrincipalComMeta,
  parseDataHistoricoLocalMmDdYyyy,
  TIPO_INFO,
  TIPO_USUARIO,
  resolverAbsFicheiroTipoHistoricoEncadeado,
} from './historico-local-txt-paths.mjs';

/**
 * @param {string} base
 * @param {string} cod8
 * @param {number} codNum
 * @param {string} procStr
 * @param {number} indice — 1..N
 */
export function lerConteudoEntradaHistorico(base, cod8, codNum, procStr, indice) {
  const idx4 = formatIndice4(indice);
  const meta16 = lerTipo16PrincipalComMeta(base, cod8, codNum, procStr, idx4);
  const dataRaw = meta16.texto;
  const dataParsed = dataRaw != null ? parseDataHistoricoLocalMmDdYyyy(dataRaw) : null;
  /** @type {{ yyyy: number, mo: number } | null} */
  let pastaAnoMes =
    meta16.yyyyPasta != null && meta16.mmPasta != null
      ? { yyyy: meta16.yyyyPasta, mm: meta16.mmPasta }
      : null;
  if (!pastaAnoMes) {
    const flex = dataParsed ?? (dataRaw != null ? extrairYmdParaPastasAno(dataRaw) : null);
    if (flex) pastaAnoMes = { yyyy: flex.yyyy, mm: flex.mo };
  }

  const infoTrim =
    lerTextoTipoHistoricoEncadeado(base, cod8, codNum, procStr, TIPO_INFO, idx4, pastaAnoMes) ?? '';
  const infoArquivoAbs = resolverAbsFicheiroTipoHistoricoEncadeado(
    base,
    cod8,
    codNum,
    procStr,
    TIPO_INFO,
    idx4,
    pastaAnoMes
  );
  const userTrim =
    lerTextoTipoHistoricoEncadeado(base, cod8, codNum, procStr, TIPO_USUARIO, idx4, pastaAnoMes) ?? '';
  const dataTrim = dataRaw != null ? String(dataRaw).trim() : '';

  let valido = true;
  let motivoInvalido = null;
  if (!infoTrim && !dataTrim) {
    valido = false;
    motivoInvalido = 'vazio';
  } else if (dataTrim && !infoTrim) {
    valido = false;
    motivoInvalido = 'data_sem_informacao';
  }

  return {
    indice,
    idx4,
    valido,
    motivoInvalido,
    infoTrim,
    dataTrim,
    userTrim,
    infoArquivoAbs,
    yyyyPasta: meta16.yyyyPasta,
    mmPasta: meta16.mmPasta,
  };
}

/** Entrada válida para importação / renumeração (mesma regra do extrator). */
export function entradaHistoricoValida(conteudo) {
  return conteudo.valido === true;
}
