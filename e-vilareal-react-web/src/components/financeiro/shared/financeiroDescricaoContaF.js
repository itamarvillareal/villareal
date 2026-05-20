/** Alinhado a {@code FinanceiroDescricaoIndicaContaF} no backend. */

function textoCombinado(descricao, descricaoDetalhada) {
  return `${descricao ?? ''} ${descricaoDetalhada ?? ''}`.trim();
}

export function descricaoIndicaContaF(descricao, descricaoDetalhada) {
  const texto = textoCombinado(descricao, descricaoDetalhada);
  if (!texto) return false;
  const t = texto.toUpperCase();
  if (t.includes('COR JURS') || t.includes('CORJURS') || t.includes('JUROS')) return true;
  return /\bCRI\b/i.test(texto) || /\bLCA\b/i.test(texto) || /\bCDB\b/i.test(texto);
}

/** Na coluna Conta do extrato: exibe F sugerida enquanto o lançamento ainda está em N (importado). */
export function contaCodigoExtratoExibicao(row) {
  const codigo = String(row.contaCodigo ?? 'N').trim().toUpperCase() || 'N';
  const etapa = String(row.etapa ?? '').toUpperCase();
  if (codigo === 'N' && etapa === 'IMPORTADO' && descricaoIndicaContaF(row.descricao, row.descricaoDetalhada)) {
    return 'F';
  }
  return codigo;
}
