import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export const processosInputClass =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 font-medium placeholder:text-gray-300 placeholder:italic focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-[box-shadow,border-color] duration-200';

export const processosInputReadOnlyClass = `${processosInputClass} bg-slate-50/95 cursor-default focus:ring-0 focus:border-gray-200`;

export const processosInputDenseClass =
  'w-full px-2.5 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-[box-shadow,border-color] duration-200';

export const processosInputDenseReadOnlyClass = `${processosInputDenseClass} bg-slate-50 cursor-default focus:ring-0 focus:border-gray-200`;

export const processosBtnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

export const processosBtnIndigo =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

export const processosBtnSecondary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

export const processosBtnOutlineIndigo =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-indigo-300 text-indigo-600 bg-white hover:bg-indigo-50 transition-colors duration-150';

export const processosBtnGhost =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-colors duration-150';

export const processosLinkClass =
  'text-sm font-medium text-teal-600 hover:text-teal-800 hover:underline bg-transparent border-0 p-0 cursor-pointer';

export const PROCESSOS_SECTION_ACCENTS = {
  identificacao: { iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', titleColor: 'text-indigo-800' },
  partes: { iconBg: 'bg-amber-100', iconColor: 'text-amber-600', titleColor: 'text-amber-800' },
  fase: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', titleColor: 'text-blue-800' },
  dados: { iconBg: 'bg-teal-100', iconColor: 'text-teal-600', titleColor: 'text-teal-800' },
  periodicidade: { iconBg: 'bg-orange-100', iconColor: 'text-orange-600', titleColor: 'text-orange-800' },
  imovel: { iconBg: 'bg-purple-100', iconColor: 'text-purple-600', titleColor: 'text-purple-800' },
};

const SUMMARY_VARIANTS = {
  prazo: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    alertBg: 'bg-red-100 ring-2 ring-red-300',
    iconWrap: 'bg-red-100 text-red-600',
    labelColor: 'text-red-700',
    valueClass: 'text-lg font-bold text-red-700',
    mutedClass: 'text-sm text-gray-400 font-normal',
  },
  audiencia: {
    border: 'border-l-violet-500',
    bg: 'bg-violet-50',
    alertBg: 'bg-violet-50',
    iconWrap: 'bg-violet-100 text-violet-600',
    labelColor: 'text-violet-700',
    valueClass: 'text-base font-semibold text-violet-900',
    mutedClass: 'text-sm text-gray-400',
  },
  fase: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50',
    alertBg: 'bg-blue-50',
    iconWrap: 'bg-blue-100 text-blue-600',
    labelColor: 'text-blue-700',
    valueClass: 'text-base font-semibold text-blue-900',
    mutedClass: 'text-sm text-gray-400',
  },
  valor: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50',
    alertBg: 'bg-emerald-50',
    iconWrap: 'bg-emerald-100 text-emerald-600',
    labelColor: 'text-emerald-700',
    valueClass: 'text-lg font-bold text-emerald-900',
    mutedClass: 'text-lg text-gray-400 font-normal',
  },
};

function useHeaderScrollShadow() {
  const headerRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;

    let scrollRoot = header.parentElement;
    while (scrollRoot && scrollRoot !== document.documentElement) {
      const style = getComputedStyle(scrollRoot);
      const scrollable =
        scrollRoot.scrollHeight > scrollRoot.clientHeight &&
        /auto|scroll|overlay/.test(style.overflowY);
      if (scrollable) break;
      scrollRoot = scrollRoot.parentElement;
    }

    const target = scrollRoot && scrollRoot !== document.documentElement ? scrollRoot : window;
    const read = () => {
      const y = target === window ? window.scrollY : target.scrollTop;
      setScrolled(y > 6);
    };
    read();
    target.addEventListener('scroll', read, { passive: true });
    return () => target.removeEventListener('scroll', read);
  }, []);

  return { headerRef, scrolled };
}

export function diasAteDataBr(dataBr) {
  const norm = String(dataBr ?? '').trim();
  const m = norm.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

export function formatValorCausaExibicao(valor) {
  const s = String(valor ?? '').trim();
  if (!s) return 'R$ 0,00';
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  if (Number.isFinite(n)) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return s.startsWith('R$') ? s : `R$ ${s}`;
}

/** @param {{ message: string, onClose?: () => void }} props */
export function ProcessosToast({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-teal-600 text-white text-sm font-medium shadow-lg border border-teal-500/50 max-w-[min(100%,22rem)]"
    >
      <Check className="w-5 h-5 shrink-0" strokeWidth={2.5} aria-hidden />
      <span className="flex-1 leading-snug">{message}</span>
      {onClose ? (
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/15 transition-colors" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}

/** @param {{ cards: { variant: keyof typeof SUMMARY_VARIANTS, label: string, value: string, muted?: boolean, alert?: boolean, extra?: import('react').ReactNode, Icon: import('react').ComponentType<{ className?: string }> }[] }} props */
export function ProcessosSummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => {
        const base = SUMMARY_VARIANTS[c.variant] ?? SUMMARY_VARIANTS.prazo;
        const Icon = c.Icon;
        const bg = c.alert ? base.alertBg : base.bg;
        return (
          <div
            key={c.label}
            className={`rounded-xl border border-slate-200/60 border-l-4 ${base.border} ${bg} p-4 shadow-md hover:shadow-lg transition-shadow duration-200`}
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${base.iconWrap}`} aria-hidden>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${base.labelColor}`}>{c.label}</p>
                <p className={c.muted ? base.mutedClass : base.valueClass}>{c.value}</p>
                {c.extra ?? null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   id: string,
 *   title: string,
 *   subtitle?: string,
 *   defaultOpen?: boolean,
 *   accentKey?: keyof typeof PROCESSOS_SECTION_ACCENTS,
 *   icon?: import('react').ComponentType<{ className?: string }>,
 *   children: import('react').ReactNode,
 * }} props
 */
export function ProcessosAccordionSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  accentKey = 'identificacao',
  icon: Icon,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `proc-panel-${id}`;
  const btnId = `proc-btn-${id}`;
  const accent = PROCESSOS_SECTION_ACCENTS[accentKey] ?? PROCESSOS_SECTION_ACCENTS.identificacao;

  return (
    <section className="rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md mb-4">
      <button
        type="button"
        id={btnId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 border-b hover:bg-slate-50/60 ${
          open ? 'border-slate-100' : 'border-transparent'
        }`}
      >
        <div className="min-w-0 flex items-start gap-3">
          {Icon ? (
            <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent.iconBg}`} aria-hidden>
              <Icon className={`h-5 w-5 ${accent.iconColor}`} strokeWidth={2.25} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className={`text-lg font-semibold tracking-tight ${accent.titleColor}`}>{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="p-5 sm:p-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   numeroCnj: string,
 *   cliente: string,
 *   statusAtivo: boolean,
 *   faseSelecionada: string,
 *   actions?: import('react').ReactNode,
 *   onFechar: () => void,
 * }} props
 */
export function ProcessosStickyHeader({ numeroCnj, cliente, statusAtivo, faseSelecionada, actions, onFechar }) {
  const { headerRef, scrolled } = useHeaderScrollShadow();
  const cnj = String(numeroCnj ?? '').trim() || '—';
  const fase = String(faseSelecionada ?? '').trim();

  return (
    <div
      ref={headerRef}
      className={`sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-4 mb-5 border-b border-indigo-200/60 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? 'shadow-lg' : 'shadow-sm'
      } bg-gradient-to-br from-indigo-50 via-slate-50 to-slate-100`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600/90">Número CNJ</p>
          <p className="font-mono text-2xl font-bold text-indigo-900 break-all leading-tight" title={cnj !== '—' ? cnj : undefined}>
            {cnj}
          </p>
          <p className="text-lg text-slate-600 truncate" title={cliente || undefined}>
            {cliente || '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
              statusAtivo ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-gray-100 text-gray-500 border-gray-300'
            }`}
          >
            {statusAtivo ? 'Ativo' : 'Inativo'}
          </span>
          {fase ? (
            <span className="inline-flex max-w-[14rem] truncate px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300" title={fase}>
              {fase}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-indigo-200/40">
        {actions}
        <button type="button" onClick={onFechar} className="ml-auto p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors shrink-0" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/** @param {{ id: string, label: string, active: boolean, count?: number, onClick: () => void }} props */
export function ProcessosTabButton({ id, label, active, count, onClick }) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative px-4 py-3 text-sm font-medium rounded-t-xl transition-colors ${
        active
          ? 'bg-white text-teal-700 font-semibold shadow-sm border-b-[3px] border-teal-500 -mb-px z-[1]'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
      {count != null && count > 0 ? (
        <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700">
          {count}
        </span>
      ) : null}
    </button>
  );
}
