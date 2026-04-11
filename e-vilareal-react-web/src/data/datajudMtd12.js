/**
 * MTD (Modelo de Transferência de Dados) **1.2** — campos que podem aparecer no `_source` DataJud
 * quando o tribunal alinha o envio ao MTD (cabeçalho processual, partes).
 *
 * Novidades V1.2 (resumo): `numeroBoletimOcorrencia`, `numeroInqueritoPolicial` no cabeçalho;
 * `parte.prioridade` (`prioridadeProcessoParte`: tipo, dataConcessao, dataFim); atributo `racaCor` em pessoa.
 * Recomendação CNJ: para prioridade **ID** (idoso), preencher `dataConcessao` com detalhe.
 *
 * Schema: `targetNamespace` http://www.cnj.jus.br/modelo-de-transferencia-de-dados-1.2
 * (ficheiro XSD distribuído pelo CNJ junto à documentação MTD).
 */

/** Códigos `tipoRacaCorPessoa` (atributo `racaCor` em pessoa) — MTD 1.2. */
export const MTD_RACA_COR = Object.freeze({
  BC: 'Branco(a)',
  PD: 'Pardo(a)',
  PR: 'Preto(a)',
  IN: 'Indígena',
  AM: 'Amarelo(a)',
  QL: 'Quilombola',
  ND: 'Não declarado',
});

/** Valor `tipo` para prioridade de pessoa idosa (recomenda-se `dataConcessao` preenchida). */
export const MTD_PRIORIDADE_IDOSO = 'ID';

/**
 * Normaliza elementos MTD `maxOccurs="unbounded"` quando a API devolve string única ou array.
 * @param {unknown} v
 * @returns {string[]|null}
 */
export function mtdNormalizarListaString(v) {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const out = v.map((x) => String(x ?? '').trim()).filter(Boolean);
    return out.length ? out : null;
  }
  const s = String(v).trim();
  return s ? [s] : null;
}

/**
 * Rótulo legível para código `racaCor`, se conhecido.
 * @param {string|null|undefined} codigo
 * @returns {string|null}
 */
export function mtdDescricaoRacaCor(codigo) {
  const c = String(codigo ?? '').trim().toUpperCase();
  if (!c) return null;
  return MTD_RACA_COR[c] ?? codigo;
}
