/** Formato do parâmetro {{2}} do template lembrete_audiencia (backend). */
const PARAM_PROCESSO_RE =
  /^(.+?) — Cliente: (.+?); Parte autora: (.+)$/;

/**
 * Extrai CNJ, cliente e parte autora do parâmetro {{2}}.
 * @param {string} paramProcesso
 * @returns {{ numeroProcesso: string, parteCliente: string|null, parteAutora: string|null }}
 */
export function parseLembreteAudienciaParamProcesso(paramProcesso) {
  const raw = String(paramProcesso ?? '').trim();
  if (!raw) {
    return { numeroProcesso: '', parteCliente: null, parteAutora: null };
  }
  const match = raw.match(PARAM_PROCESSO_RE);
  if (!match) {
    return { numeroProcesso: raw, parteCliente: null, parteAutora: null };
  }
  const parteCliente = match[2].trim();
  const parteAutora = match[3].trim();
  return {
    numeroProcesso: match[1].trim(),
    parteCliente: parteCliente && parteCliente !== '—' ? parteCliente : null,
    parteAutora: parteAutora && parteAutora !== '—' ? parteAutora : null,
  };
}

export function isLembreteAudienciaTemplate(templateName) {
  return String(templateName ?? '').trim() === 'lembrete_audiencia';
}
