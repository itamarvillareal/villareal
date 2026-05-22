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

function idAndamentoConsultas(item) {
  return Number(item?.id ?? item?.andamentoId) || 0;
}

/**
 * Mantém só o andamento mais recente (maior id) por par código cliente + processo na mesma data.
 * @param {Array<Record<string, unknown>>} itens
 */
export function agruparConsultasRealizadasPorProcesso(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return [];
  const melhor = new Map();
  for (const item of itens) {
    const k = chaveProcessoConsultasRealizadas(item);
    const prev = melhor.get(k);
    if (!prev || idAndamentoConsultas(item) >= idAndamentoConsultas(prev)) {
      melhor.set(k, item);
    }
  }
  const out = [...melhor.values()];
  out.sort((a, b) => {
    const na = Number(a.numero) || idAndamentoConsultas(a);
    const nb = Number(b.numero) || idAndamentoConsultas(b);
    if (nb !== na) return nb - na;
    return chaveProcessoConsultasRealizadas(a).localeCompare(chaveProcessoConsultasRealizadas(b));
  });
  return out;
}
