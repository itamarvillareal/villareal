/** Utilitários para editar cláusulas na prévia do contrato de honorários. */

const PREFIXO_CLAUSULA_RE = /^Cláusula\s+\d+ª\.?\s*/i;

/** Remove o prefixo «Cláusula Nª.» e devolve só o corpo. */
export function corpoClausula(texto) {
  return String(texto ?? '')
    .replace(PREFIXO_CLAUSULA_RE, '')
    .trim();
}

/** Formata cláusula com numeração ordinal (1ª, 2ª, …). */
export function formatarClausula(numero, corpo) {
  const texto = corpoClausula(corpo);
  return `Cláusula ${numero}ª. ${texto}`;
}

/** Renumera todas as cláusulas em sequência, preservando o texto de cada uma. */
export function renumerarClausulas(clausulas) {
  return (clausulas || []).map((c, i) => formatarClausula(i + 1, c));
}

export function moverClausula(clausulas, indice, direcao) {
  const list = [...(clausulas || [])];
  const alvo = indice + direcao;
  if (alvo < 0 || alvo >= list.length) return list;
  [list[indice], list[alvo]] = [list[alvo], list[indice]];
  return renumerarClausulas(list);
}

export function incluirClausula(clausulas, indiceDepois = null) {
  const list = [...(clausulas || [])];
  const insertAt =
    indiceDepois == null || indiceDepois < 0 || indiceDepois >= list.length
      ? list.length
      : indiceDepois + 1;
  list.splice(insertAt, 0, 'Texto da cláusula.');
  return renumerarClausulas(list);
}

export function excluirClausula(clausulas, indice) {
  const list = [...(clausulas || [])];
  if (list.length <= 1) return list;
  list.splice(indice, 1);
  return renumerarClausulas(list);
}

export function rotuloClausula(numero) {
  return `Cláusula ${numero}ª`;
}
