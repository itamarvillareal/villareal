import { formatBRL } from '../../data/relatorioCalculosData.js';

export const CHAVES_ALERTAS_NUMERICOS = [
  'vencidos',
  'vencendoHoje',
  'proximos3Dias',
  'proximos7Dias',
  'agendadosAguardandoConfirmacao',
  'conferenciaPendente',
  'pagoSemComprovante',
  'altoValor',
  'urgentes',
];

export const ROTULO_ALERTA = {
  vencidos: 'Vencidos (não quitados)',
  vencendoHoje: 'Vencendo hoje',
  proximos3Dias: 'Próximos 3 dias',
  proximos7Dias: 'Próximos 7 dias',
  agendadosAguardandoConfirmacao: 'Agendados aguardando confirmação',
  conferenciaPendente: 'Aguard. confirmação (operacional)',
  pagoSemComprovante: 'Pagos sem comprovante',
  altoValor: 'Alto valor (≥ R$ 10.000)',
  urgentes: 'Prioridade urgente',
  pagosNaoConciliados: 'Pagos não conciliados',
  conferidosNaoAcertados: 'Conferidos sem acerto',
};

export function extrairAlertasLegados(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const k of CHAVES_ALERTAS_NUMERICOS) {
    const v = raw[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      out[k] = Number(v);
    }
  }
  return out;
}

export function badgeStatusClass(st) {
  switch (st) {
    case 'PENDENTE':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100';
    case 'AGENDADO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100';
    case 'PAGO_CONFIRMADO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
    case 'PAGO_SEM_COMPROVANTE':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 ring-1 ring-orange-300 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-orange-700';
    case 'CONFERIDO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white';
    case 'ACERTADO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white';
    case 'CONFERENCIA_PENDENTE':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-100';
    case 'VENCIDO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100';
    case 'CANCELADO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case 'SUBSTITUIDO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100';
    default:
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700';
  }
}

export function badgeStatusStyle(st) {
  if (st === 'CONFERIDO') return { backgroundColor: '#0F6E56' };
  if (st === 'ACERTADO') return { backgroundColor: '#534AB7' };
  return undefined;
}

export function isoAddDays(iso, days) {
  const base = String(iso || '').slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return base;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export const CATEGORIAS_PAGAMENTO = [
  'CONDOMINIO',
  'ALUGUEL',
  'TRIBUTO',
  'IMPOSTO',
  'ACORDO',
  'PARCELAMENTO',
  'CLIENTE',
  'FORNECEDOR',
  'PROCESSO_JUDICIAL',
  'FUNCIONARIO',
  'ENERGIA',
  'AGUA',
  'INTERNET',
  'SISTEMA_SOFTWARE',
  'ESCRITORIO',
  'VEICULO',
  'OBRA_REFORMA',
  'OUTROS',
];

const CORES_CATEGORIA = {
  CONDOMINIO: 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100',
  ALUGUEL: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100',
  TRIBUTO: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
  IMPOSTO: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
  ENERGIA: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-100',
  AGUA: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100',
  INTERNET: 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
  OUTROS: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

export function badgeCategoriaClass(categoria) {
  const c = String(categoria || '').toUpperCase();
  return `inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
    CORES_CATEGORIA[c] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  }`;
}

export function badgePrestacaoStatus(status) {
  switch (status) {
    case 'RASCUNHO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case 'ENVIADO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100';
    case 'APROVADO':
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
    default:
      return 'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600';
  }
}

export function tooltipConciliado(row) {
  if (row.financeiroLancamentoId == null) return '';
  let t = `Conciliado — Banco: ${formatBRL(Number(row.valorPagoBanco ?? row.valor ?? 0))}`;
  const diff = row.valorDiferenca != null ? Number(row.valorDiferenca) : null;
  if (diff != null && Number.isFinite(diff) && Math.abs(diff) > 0.001) {
    t += ` (diferença: ${formatBRL(diff)})`;
  }
  return t;
}
