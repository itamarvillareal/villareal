/** Utilitários para editar cláusulas HTML na prévia do contrato de locação. */

const PREFIXO_CLAUSULA_HTML_RE = /^<strong>\s*Cláusula\s+\d+ª\.?\s*<\/strong>\s*/i;

/** Remove o prefixo «Cláusula Nª.» e devolve só o corpo HTML. */
export function corpoClausulaHtml(clausula) {
  return String(clausula ?? '')
    .replace(PREFIXO_CLAUSULA_HTML_RE, '')
    .trim();
}

/** Formata cláusula com numeração ordinal (1ª, 2ª, …). */
export function formatarClausulaHtml(numero, htmlCorpo) {
  const corpo = corpoClausulaHtml(htmlCorpo);
  return `<strong>Cláusula ${numero}ª.</strong> ${corpo}`;
}

/** Renumera todas as cláusulas em sequência, preservando o HTML de cada uma. */
export function renumerarClausulasHtml(clausulas) {
  return (clausulas || []).map((c, i) => formatarClausulaHtml(i + 1, c));
}

export function moverClausulaHtml(clausulas, indice, direcao) {
  const list = [...(clausulas || [])];
  const alvo = indice + direcao;
  if (alvo < 0 || alvo >= list.length) return list;
  [list[indice], list[alvo]] = [list[alvo], list[indice]];
  return renumerarClausulasHtml(list);
}

export function incluirClausulaHtml(clausulas, indiceDepois = null) {
  const list = [...(clausulas || [])];
  const insertAt =
    indiceDepois == null || indiceDepois < 0 || indiceDepois >= list.length
      ? list.length
      : indiceDepois + 1;
  list.splice(insertAt, 0, '<strong>Cláusula 0ª.</strong> Texto da cláusula.');
  return renumerarClausulasHtml(list);
}

export function excluirClausulaHtml(clausulas, indice) {
  const list = [...(clausulas || [])];
  if (list.length <= 1) return list;
  list.splice(indice, 1);
  return renumerarClausulasHtml(list);
}

export function rotuloClausula(numero) {
  return `Cláusula ${numero}ª`;
}
