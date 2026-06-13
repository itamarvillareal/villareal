/** CSS custom properties para borda/botão da letra contábil (financeiro-tokens.css). */
export function varsCorConta(codigo) {
  const letra = String(codigo ?? 'N').trim().toLowerCase() || 'n';
  const base = `--fin-conta-${letra}`;
  return {
    '--fin-btn-conta-bg': `var(${base}, var(--fin-conta-n))`,
    '--fin-borda-conta': `var(${base}, var(--fin-conta-n))`,
  };
}

export const CLASSE_BOTAO_APROVAR_CONTA = 'fin-btn-aprov-conta';
export const CLASSE_BORDA_CONTA = 'fin-borda-conta';
