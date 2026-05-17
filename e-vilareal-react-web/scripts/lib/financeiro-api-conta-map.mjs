/** Mapa nome da conta contábil → letra (codigo) a partir de GET /api/financeiro/contas. */
export function buildContaNomeParaLetra(contas) {
  const out = {};
  for (const c of contas || []) {
    const nome = String(c.nome ?? '').trim();
    if (!nome) continue;
    const letra = String(c.codigo ?? c.letra ?? '').trim().toUpperCase();
    if (letra) out[nome] = letra;
  }
  return out;
}
