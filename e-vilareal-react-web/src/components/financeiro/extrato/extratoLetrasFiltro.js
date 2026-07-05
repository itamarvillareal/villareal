export const LETRAS_MODO_INCLUIR = 'incluir';
export const LETRAS_MODO_EXCLUIR = 'excluir';

const LETRA_RE = /^[A-Z]$/;

/** Normaliza lista de letras (A–Z), sem duplicatas, ordenada. */
export function normalizarLetrasFiltro(letras) {
  const out = [];
  const seen = new Set();
  for (const raw of letras ?? []) {
    const cod = String(raw ?? '').trim().toUpperCase();
    if (!LETRA_RE.test(cod) || seen.has(cod)) continue;
    seen.add(cod);
    out.push(cod);
  }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Lê parâmetro URL `letras=A,E` (legado: `conta=A`). */
export function parseLetrasFiltroParam(params) {
  const raw = String(params.get('letras') ?? params.get('conta') ?? '').trim();
  const letras = raw
    ? normalizarLetrasFiltro(raw.split(','))
    : [];
  const letrasModo =
    String(params.get('letrasModo') ?? '').trim().toLowerCase() === LETRAS_MODO_EXCLUIR
      ? LETRAS_MODO_EXCLUIR
      : LETRAS_MODO_INCLUIR;
  return { letras, letrasModo };
}

export function letrasFiltroAtivo({ letras }) {
  return Array.isArray(letras) && letras.length > 0;
}

export function rotuloLetrasFiltro({ letras, letrasModo }) {
  if (!letrasFiltroAtivo({ letras })) return 'Letras';
  const lista = letras.join(', ');
  return letrasModo === LETRAS_MODO_EXCLUIR ? `Exceto ${lista}` : `Somente ${lista}`;
}

export function letrasParaQueryApi({ letras, letrasModo }) {
  if (!letrasFiltroAtivo({ letras })) {
    return { contaCodigos: undefined, contaCodigosExcluir: undefined };
  }
  return {
    contaCodigos: letras.join(','),
    contaCodigosExcluir: letrasModo === LETRAS_MODO_EXCLUIR ? true : undefined,
  };
}

/** Filtro client-side por letra da conta contábil (contaCodigo). */
export function linhaBateFiltroLetras(row, { letras, letrasModo } = {}) {
  if (!letrasFiltroAtivo({ letras })) return true;
  const cod = String(row?.contaCodigo ?? 'N').trim().toUpperCase() || 'N';
  const sel = new Set(normalizarLetrasFiltro(letras));
  const contem = sel.has(cod);
  return letrasModo === LETRAS_MODO_EXCLUIR ? !contem : contem;
}
