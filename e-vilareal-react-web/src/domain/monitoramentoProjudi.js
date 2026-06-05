/**
 * Interpreta ResultadoMonitoramentoResponse do backend (Fase 3 monitor).
 * @param {{
 *   status?: string,
 *   baseline?: boolean,
 *   novas?: number,
 *   totalListadas?: number,
 *   erro?: string|null,
 * }|null|undefined} r
 * @returns {{ erro: string|null, toast: string|null }}
 */
export function interpretarResultadoMonitoramento(r) {
  if (!r || typeof r !== 'object') {
    return { erro: 'Resposta vazia do monitor.', toast: null };
  }

  const status = String(r.status ?? '').trim();
  if (status === 'ERRO') {
    const msg = String(r.erro ?? '').trim();
    return {
      erro: msg || 'Falha ao monitorar movimentações do PROJUDI.',
      toast: null,
    };
  }

  if (status === 'PULADA_OCUPADO') {
    return { erro: null, toast: 'Consulta em andamento, tente em instantes' };
  }

  if (r.baseline === true) {
    const total = Number(r.totalListadas ?? 0);
    return {
      erro: null,
      toast: `Baseline registrado: ${total} movimentações monitoradas a partir de agora`,
    };
  }

  const novas = Number(r.novas ?? 0);
  if (novas > 0) {
    return {
      erro: null,
      toast: `${novas} nova(s) movimentação(ões) detectada(s)`,
    };
  }

  return { erro: null, toast: 'Nenhuma movimentação nova' };
}
