/** Texto normalizado para comparação (minúsculas, sem acentos). */
export function textoSemAcentoMin(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function haystackImovel(imovelApi) {
  const parts = [
    imovelApi?.condominio,
    imovelApi?.unidade,
    imovelApi?.titulo,
    imovelApi?.enderecoCompleto,
    imovelApi?.numeroPlanilha,
    imovelApi?.id,
  ];
  return textoSemAcentoMin(parts.filter((p) => p != null && String(p).trim() !== '').join(' '));
}

/**
 * Pesquisa em condomínio, unidade, título, endereço e nº da planilha:
 * cada palavra da query deve aparecer em qualquer um desses campos.
 */
export function imovelCorrespondeBusca(imovelApi, queryBruta) {
  const q = String(queryBruta ?? '').trim();
  if (!q || !imovelApi) return false;
  const hay = haystackImovel(imovelApi);
  const tokens = textoSemAcentoMin(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => hay.includes(t));
}

/** Mesma regra de tokens, aplicada a um texto livre. */
export function textoCorrespondeBusca(texto, queryBruta) {
  const q = String(queryBruta ?? '').trim();
  if (!q) return true;
  const hay = textoSemAcentoMin(texto);
  const tokens = textoSemAcentoMin(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => hay.includes(t));
}
