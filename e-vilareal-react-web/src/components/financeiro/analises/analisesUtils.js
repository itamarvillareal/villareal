/** Percentual de lançamentos fora de IMPORTADO (N). */
export function pctClassificado(totalLancamentos, pendentesImportado) {
  const total = Number(totalLancamentos) || 0;
  const pendentes = Number(pendentesImportado) || 0;
  if (total <= 0) return 0;
  return Math.round(((total - pendentes) / total) * 100);
}

export function rotuloConfianca(confianca) {
  const c = String(confianca ?? '').toUpperCase();
  if (c === 'ALTA') return 'Alta';
  if (c === 'MEDIA') return 'Média';
  if (c === 'BAIXA') return 'Baixa';
  return c || '—';
}

export function chavePadraoRecorrencia(p) {
  return `${p?.descricaoNorm ?? ''}|${p?.numeroBanco ?? ''}`;
}
