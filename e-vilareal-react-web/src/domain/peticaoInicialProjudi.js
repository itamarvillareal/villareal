/** Chave sintética de petição criada pela assinatura automática de iniciais (não é CNJ). */
export const PREFIXO_CHAVE_INICIAL = 'INICIAL-';

const RE_CHAVE_INICIAL = /^INICIAL-(\d{8})-(\d+)$/i;

/** @param {string|null|undefined} numeroProcesso */
export function isChavePeticaoInicialDistribuicao(numeroProcesso) {
  const raw = String(numeroProcesso ?? '').trim();
  return raw.toUpperCase().startsWith(PREFIXO_CHAVE_INICIAL);
}

/**
 * @param {string|null|undefined} numeroProcesso
 * @returns {{ codigoCliente: string, numeroInterno: number } | null}
 */
export function parseChavePeticaoInicial(numeroProcesso) {
  const raw = String(numeroProcesso ?? '').trim();
  const m = RE_CHAVE_INICIAL.exec(raw);
  if (!m) return null;
  const codigoCliente = String(Number.parseInt(m[1], 10)).padStart(8, '0');
  const numeroInterno = Number.parseInt(m[2], 10);
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;
  return { codigoCliente, numeroInterno };
}

/** @param {string|null|undefined} numeroProcesso */
export function rotuloProcessoInternoInicial(numeroProcesso) {
  const parsed = parseChavePeticaoInicial(numeroProcesso);
  if (!parsed) return String(numeroProcesso ?? '').trim() || '—';
  const cod = String(Number.parseInt(parsed.codigoCliente, 10));
  return `${cod}/${parsed.numeroInterno}`;
}

export const MSG_INICIAL_USE_DISTRIBUIR =
  'Anexos de distribuição de inicial não são protocolados aqui. Use Processos → Distribuir Inicial PROJUDI.';
