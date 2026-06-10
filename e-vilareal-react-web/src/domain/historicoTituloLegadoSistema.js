/**
 * Títulos gerados automaticamente pelo sistema legado (VB) ao gravar histórico na pasta.
 *
 * - «Consultas Realizadas» (diagnóstico): exclui estes títulos na listagem do dia.
 * - «Processos Consultados» (popup Excel ao abrir): inclui o processo mesmo quando
 *   o único movimento do dia é automático (consulta PROJUDI gravou só JUNTAR PETIÇÃO…).
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

function codigoClienteChaveConsultas(val) {
  const n = Math.trunc(Number(String(val ?? '').replace(/\D/g, '')) || 0);
  if (!n) return '00000000';
  return String(n).padStart(8, '0');
}

/**
 * Chave cliente (8 dígitos) + nº interno — uma linha por processo no relatório «Consultas Realizadas» (legado VB).
 * @param {{ codCliente?: unknown, codigoCliente?: unknown, proc?: unknown, numeroInterno?: unknown }} item
 */
export function chaveProcessoConsultasRealizadas(item) {
  const cod = codigoClienteChaveConsultas(item?.codCliente ?? item?.codigoCliente);
  const proc = Math.trunc(Number(String(item?.proc ?? item?.numeroInterno ?? '').replace(/\D/g, '')) || 0);
  return `${cod}:${proc}`;
}

function ordemEntradaHistorico(item) {
  return Number(item?.indice ?? item?.id ?? item?.andamentoId) || 0;
}

/**
 * Mantém só a entrada mais recente (maior id/índice) por par código cliente + processo na mesma data.
 * @param {Array<Record<string, unknown>>} itens
 */
function agruparUmaLinhaPorProcesso(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return [];
  const melhor = new Map();
  for (const item of itens) {
    const k = chaveProcessoConsultasRealizadas(item);
    const prev = melhor.get(k);
    if (!prev || ordemEntradaHistorico(item) >= ordemEntradaHistorico(prev)) {
      melhor.set(k, item);
    }
  }
  const out = [...melhor.values()];
  out.sort((a, b) => {
    const na = Number(a.numero) || ordemEntradaHistorico(a);
    const nb = Number(b.numero) || ordemEntradaHistorico(b);
    if (nb !== na) return nb - na;
    return chaveProcessoConsultasRealizadas(a).localeCompare(chaveProcessoConsultasRealizadas(b));
  });
  return out;
}

/**
 * «Consultas Realizadas» — após excluir títulos automáticos do VB.
 * @param {Array<Record<string, unknown>>} itens
 */
export function agruparConsultasRealizadasPorProcesso(itens) {
  return agruparUmaLinhaPorProcesso(filtrarItensHistoricoConsultasRealizadas(itens));
}

/**
 * «Processos Consultados» (popup Excel) — inclui movimentos automáticos do dia.
 * @param {Array<Record<string, unknown>>} itens
 */
export function agruparProcessosConsultadosPorProcesso(itens) {
  if (!Array.isArray(itens)) return [];
  const comInfo = itens.filter((item) => String(item?.info ?? item?.titulo ?? '').trim());
  return agruparUmaLinhaPorProcesso(comInfo);
}
