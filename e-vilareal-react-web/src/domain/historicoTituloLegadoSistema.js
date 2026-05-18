/**
 * Títulos gerados automaticamente pelo sistema legado (VB) ao gravar histórico na pasta.
 * O relatório «Consultas Realizadas» do legado não os inclui na listagem do dia.
 */

function normalizarTituloLegado(titulo) {
  return String(titulo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {unknown} titulo
 * @returns {boolean}
 */
export function ehTituloHistoricoSistemaLegado(titulo) {
  const t = normalizarTituloLegado(titulo);
  if (!t) return false;
  if (/^JUNTAR PETI.{0,4} INSERIDA NA PASTA EM\b/.test(t)) return true;
  if (/^PETI.{0,4} DA INF.{0,16} ANTERIOR JUNTADA EM\b/.test(t)) return true;
  return false;
}

/**
 * @param {Array<{ info?: unknown, titulo?: unknown }>} itens
 * @returns {typeof itens}
 */
export function filtrarItensHistoricoConsultasRealizadas(itens) {
  if (!Array.isArray(itens)) return [];
  return itens.filter((item) => {
    const texto = String(item?.info ?? item?.titulo ?? '').trim();
    if (!texto) return false;
    return !ehTituloHistoricoSistemaLegado(texto);
  });
}
