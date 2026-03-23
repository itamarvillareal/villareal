/** Alinha ao Cadastro de Clientes / Processos ao navegar com state. */
export function padCliente8Nav(val) {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) return s.padStart(8, '0');
  return String(Math.floor(n)).padStart(8, '0');
}
