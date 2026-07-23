/**
 * Ordenação da lista de anexos .p7s na distribuição inicial PROJUDI:
 * menor → maior (prefixo numérico `01.`, `02.`, `10.`…; sem prefixo no fim; desempate alfabético natural).
 */

/** Prefixo numérico do nome (ex.: `12.Anexo.pdf.p7s` → 12). Sem prefixo → null. */
export function prefixoNumericoNomeArquivo(nome) {
  const m = String(nome ?? '')
    .trim()
    .match(/^(\d+)\./);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ file?: { name?: string } }[]} linhas
 * @returns {{ file?: { name?: string } }[]}
 */
export function ordenarLinhasP7s(linhas) {
  return [...(linhas || [])].sort((a, b) => {
    const nomeA = String(a?.file?.name ?? '').trim();
    const nomeB = String(b?.file?.name ?? '').trim();
    const pa = prefixoNumericoNomeArquivo(nomeA);
    const pb = prefixoNumericoNomeArquivo(nomeB);

    if (pa != null && pb != null && pa !== pb) return pa - pb;
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;

    return nomeA.localeCompare(nomeB, 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}
