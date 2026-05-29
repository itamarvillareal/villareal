export const DEMANDA_STATUS_OPTS = [
  { value: 'ABERTO', label: 'Aberto', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento', badge: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100' },
  { value: 'AGUARDANDO', label: 'Aguardando', badge: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200' },
  { value: 'CONCLUIDO', label: 'Concluído', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' },
  { value: 'CANCELADO', label: 'Cancelado', badge: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200' },
];

export const DEMANDA_CATEGORIAS_OPTS = [
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'REFORMA', label: 'Reforma' },
  { value: 'JURIDICO', label: 'Jurídico' },
  { value: 'DOCUMENTACAO', label: 'Documentação' },
  { value: 'VISTORIA', label: 'Vistoria' },
  { value: 'IMPOSTO_TAXA', label: 'Imposto / taxa' },
  { value: 'SEGURO', label: 'Seguro' },
  { value: 'CONDOMINIO', label: 'Condomínio' },
  { value: 'COBRANCA', label: 'Cobrança' },
  { value: 'OUTRO', label: 'Outro' },
];

export const STATUS_ATIVOS = new Set(['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO']);

export function labelStatus(status) {
  return DEMANDA_STATUS_OPTS.find((s) => s.value === status)?.label ?? status ?? '—';
}

export function badgeStatus(status) {
  return DEMANDA_STATUS_OPTS.find((s) => s.value === status)?.badge ?? 'bg-slate-100 text-slate-700';
}

export function labelCategoria(cat) {
  return DEMANDA_CATEGORIAS_OPTS.find((c) => c.value === cat)?.label ?? cat ?? '—';
}

export function isoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function demandaVencida(d) {
  if (!d?.prazoFinalizacao || !STATUS_ATIVOS.has(d.status)) return false;
  return String(d.prazoFinalizacao).slice(0, 10) < isoHoje();
}
