/** Normaliza lista de números de banco (dedupe, ordem crescente). */
export function normalizarBancosFiltro(numeros) {
  const set = new Set();
  for (const raw of numeros ?? []) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** Lê `?banco=1` ou `?banco=1,12` da URL. */
export function parseBancosFiltroParam(params) {
  const raw = params.get('banco');
  if (!raw) return [];
  return normalizarBancosFiltro(
    String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function bancosFiltroAtivo(bancos) {
  return Array.isArray(bancos) && bancos.length > 0;
}

/** Rótulo compacto do botão (nomes quando couber, senão quantidade). */
export function rotuloBancosFiltro(bancos, bancosCatalogo = []) {
  const nums = normalizarBancosFiltro(bancos);
  if (!nums.length) return 'Todos os bancos';
  const nomes = nums
    .map((n) => bancosCatalogo.find((b) => Number(b.numero) === n)?.nome ?? String(n))
    .filter(Boolean);
  const texto = nomes.join(', ');
  if (texto.length <= 36) return texto;
  return `${nums.length} bancos`;
}
