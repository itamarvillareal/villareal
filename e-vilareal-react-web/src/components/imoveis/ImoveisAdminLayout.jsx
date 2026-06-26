import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Droplets,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Flame,
  FolderOpen,
  Home,
  KeyRound,
  Landmark,
  MapPin,
  Phone,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { formatValorMoeda, formatValorMoedaCampo } from '../../utils/moneyBr.js';

export { formatValorMoeda, formatValorMoedaCampo };

export const imoveisInputClass =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#141c2c] text-gray-800 font-medium dark:text-slate-100 placeholder:text-gray-300 placeholder:italic placeholder:font-normal dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 dark:focus:ring-teal-400/30 dark:focus:border-teal-400/40 transition-[box-shadow,border-color] duration-200';

export const imoveisInputReadOnlyClass = `${imoveisInputClass} bg-slate-50/95 dark:bg-[#0f141f]/90 cursor-default focus:ring-0 focus:border-gray-200 dark:focus:border-white/[0.1]`;

export const imoveisBtnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 shadow-sm active:scale-[0.99] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

export const imoveisBtnSecondary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.18] active:scale-[0.99] transition-colors duration-150';

export const imoveisBtnGhost =
  'inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors duration-150';

export const imoveisBtnIconGhost =
  'p-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors duration-150 shrink-0';

/** Badges coloridos por seção (ícone 40×40 + cor do título). */
export const IMOVEIS_SECTION_ACCENTS = {
  identificacao: { iconBg: 'bg-teal-100 dark:bg-teal-500/20', iconColor: 'text-teal-600 dark:text-teal-400', titleColor: 'text-teal-800 dark:text-teal-200' },
  endereco: { iconBg: 'bg-blue-100 dark:bg-blue-500/20', iconColor: 'text-blue-600 dark:text-blue-400', titleColor: 'text-blue-800 dark:text-blue-200' },
  locacao: { iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', iconColor: 'text-emerald-600 dark:text-emerald-400', titleColor: 'text-emerald-800 dark:text-emerald-200' },
  contrato: { iconBg: 'bg-indigo-100 dark:bg-indigo-500/20', iconColor: 'text-indigo-600 dark:text-indigo-400', titleColor: 'text-indigo-800 dark:text-indigo-200' },
  utilidades: { iconBg: 'bg-orange-100 dark:bg-orange-500/20', iconColor: 'text-orange-600 dark:text-orange-400', titleColor: 'text-orange-800 dark:text-orange-200' },
  bancarios: { iconBg: 'bg-purple-100 dark:bg-purple-500/20', iconColor: 'text-purple-600 dark:text-purple-400', titleColor: 'text-purple-800 dark:text-purple-200' },
  partes: { iconBg: 'bg-pink-100 dark:bg-pink-500/20', iconColor: 'text-pink-600 dark:text-pink-400', titleColor: 'text-pink-800 dark:text-pink-200' },
  observacoes: { iconBg: 'bg-slate-100 dark:bg-white/[0.08]', iconColor: 'text-slate-600 dark:text-slate-400', titleColor: 'text-slate-800 dark:text-slate-200' },
};

const SUMMARY_VARIANTS = {
  aluguel: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    alertBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400',
    labelColor: 'text-emerald-700 dark:text-emerald-300',
    valueColor: 'text-emerald-900 dark:text-emerald-100',
    alertValueColor: 'text-emerald-800 dark:text-emerald-200',
    Icon: CircleDollarSign,
  },
  contrato: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    alertBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconWrap: 'bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400',
    labelColor: 'text-blue-700 dark:text-blue-300',
    valueColor: 'text-blue-900 dark:text-blue-100',
    alertValueColor: 'text-blue-800 dark:text-blue-200',
    Icon: Calendar,
  },
  proprietario: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    alertBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconWrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400',
    labelColor: 'text-amber-700 dark:text-amber-300',
    valueColor: 'text-amber-900 dark:text-amber-100',
    alertValueColor: 'text-amber-800 dark:text-amber-200',
    Icon: KeyRound,
  },
  inquilino: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    alertBg: 'bg-rose-100 dark:bg-rose-900/40',
    iconWrap: 'bg-rose-100 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400',
    labelColor: 'text-rose-700 dark:text-rose-300',
    valueColor: 'text-rose-900 dark:text-rose-100',
    alertValueColor: 'text-rose-800 dark:text-rose-200',
    Icon: Home,
    alertIcon: AlertTriangle,
  },
};

const UTILIDADE_META = {
  agua: { Icon: Droplets, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-500/20' },
  energia: { Icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-500/20' },
  gas: { Icon: Flame, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-500/20' },
  cond: { Icon: Building2, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-500/20' },
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

export function formatDocBrExibicao(digits) {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
}

export function iniciaisNome(nome) {
  const parts = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function enderecoUmaLinha(endereco, condominio, unidade) {
  const e = String(endereco ?? '').trim();
  if (e) return e.split(/\r?\n/)[0].slice(0, 120);
  const c = [condominio, unidade].filter(Boolean).join(' · ');
  return c || 'Endereço não informado';
}

/** Resumo exibido no cabeçalho fixo do cadastro (campo Unidade). */
export function unidadeResumoCabecalho(unidade, condominio) {
  const u = String(unidade ?? '').trim();
  if (u) return u;
  const c = String(condominio ?? '').trim();
  if (c) return c;
  return 'Unidade não informada';
}

function telHref(contato) {
  const d = String(contato ?? '').replace(/\D/g, '');
  return d.length >= 8 ? `tel:+55${d}` : null;
}

function valorParecePendente(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return !v || v === '—' || v.includes('não vinculado') || v.includes('não informado') || v.includes('sem datas');
}

/** @param {{ message: string, onClose?: () => void }} props */
export function ImoveisToast({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-teal-600 text-white text-sm font-medium shadow-lg shadow-teal-950/25 border border-teal-500/50 max-w-[min(100%,22rem)]"
    >
      <Check className="w-5 h-5 shrink-0" strokeWidth={2.5} aria-hidden />
      <span className="flex-1 leading-snug">{message}</span>
      {onClose ? (
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/15 transition-colors" aria-label="Fechar aviso">
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   id: string,
 *   title: string,
 *   subtitle?: string,
 *   defaultOpen?: boolean,
 *   variant?: 'primary' | 'secondary',
 *   icon?: import('react').ComponentType<{ className?: string }>,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AccordionSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  variant = 'primary',
  icon: Icon,
  accent,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `accordion-panel-${id}`;
  const btnId = `accordion-btn-${id}`;
  const accentResolved = accent ?? IMOVEIS_SECTION_ACCENTS.identificacao;
  void variant;

  return (
    <section className="imoveis-admin-section group/section rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md">
      <button
        type="button"
        id={btnId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-6 py-4 text-left transition-colors duration-200 border-b bg-white dark:bg-white/[0.02] hover:bg-slate-50/60 dark:hover:bg-white/[0.04] ${
          open ? 'border-slate-100 dark:border-white/[0.06]' : 'border-transparent'
        }`}
      >
        <div className="min-w-0 flex items-start gap-3">
          {Icon ? (
            <span
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentResolved.iconBg}`}
              aria-hidden
            >
              <Icon className={`h-5 w-5 ${accentResolved.iconColor}`} strokeWidth={2.25} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className={`text-lg font-semibold tracking-tight ${accentResolved.titleColor}`}>{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p> : null}
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-slate-500 transition-transform duration-300 ease-in-out ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="p-6 space-y-5 sm:space-y-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   imovelId: number,
 *   imovelOcupado: boolean,
 *   unidadeResumo: string,
 *   valorLocacao: string,
 *   inquilinoNome: string,
 *   apiSaving: boolean,
 *   onSalvar: () => void,
 *   onAbrirProc: () => void,
 *   onContaCorrente: () => void,
 *   contaCorrenteDisabled: boolean,
 *   contaCorrenteTitle?: string,
 *   onGerenciarIptu?: () => void,
 *   showGerenciarIptu?: boolean,
 *   onCatalogo?: () => void,
 *   showCatalogo?: boolean,
 *   catalogoDisabled?: boolean,
 *   catalogoTitle?: string,
 *   onRelatorio?: () => void,
 *   onGerarContratoLocacao?: () => void,
 *   showGerarContratoLocacao?: boolean,
 *   onFechar: () => void,
 * }} props
 */
export function ImoveisStickyHeader({
  imovelId,
  imovelOcupado,
  unidadeResumo,
  valorLocacao,
  inquilinoNome,
  apiSaving,
  onSalvar,
  onAbrirProc,
  onContaCorrente,
  contaCorrenteDisabled,
  contaCorrenteTitle,
  onGerenciarIptu,
  showGerenciarIptu,
  onCatalogo,
  showCatalogo,
  catalogoDisabled,
  catalogoTitle,
  onRelatorio,
  showRelatorio,
  onGerarContratoLocacao,
  showGerarContratoLocacao,
  onFechar,
}) {
  const { headerRef, scrolled } = useHeaderScrollShadow();
  const valorFormatado = formatValorMoeda(valorLocacao);

  return (
    <div
      ref={headerRef}
      className={`sticky top-0 z-20 -mx-5 sm:-mx-6 md:-mx-8 px-5 sm:px-6 md:px-8 py-5 mb-6 border-b-2 border-teal-400/70 dark:border-teal-500/40 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-black/40' : 'shadow-sm'
      } bg-gradient-to-br from-teal-50 via-sky-50 to-green-50 dark:from-[#121a28] dark:via-[#141f2e] dark:to-teal-950/25`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xl font-bold text-slate-900 dark:text-slate-50 tabular-nums tracking-tight">
              Imóvel #{imovelId}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                imovelOcupado
                  ? 'bg-green-500 text-white shadow-sm shadow-green-600/25'
                  : 'bg-slate-400 text-white dark:bg-slate-600'
              }`}
            >
              {imovelOcupado ? 'Ocupado' : 'Desocupado'}
            </span>
          </div>
          <p className="text-2xl sm:text-[1.65rem] font-bold text-teal-700 dark:text-teal-300 tabular-nums leading-tight">
            {valorFormatado}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5" title={unidadeResumo}>
            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
            {unidadeResumo}
          </p>
          {inquilinoNome?.trim() ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Inquilino: <span className="font-medium text-slate-700 dark:text-slate-200">{inquilinoNome}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-1 border-t border-slate-200/60 dark:border-white/[0.06] xl:border-t-0 xl:pt-0">
          <button type="button" onClick={onSalvar} disabled={apiSaving} className={imoveisBtnPrimary}>
            {apiSaving ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={onAbrirProc} className={imoveisBtnSecondary}>
            Abrir Proc.
          </button>
          <button
            type="button"
            onClick={onContaCorrente}
            disabled={contaCorrenteDisabled}
            title={contaCorrenteTitle}
            className={imoveisBtnSecondary}
          >
            <Landmark className="w-4 h-4 shrink-0" aria-hidden />
            Conta Corrente
          </button>
          {showGerenciarIptu && onGerenciarIptu ? (
            <button type="button" onClick={onGerenciarIptu} className={imoveisBtnSecondary}>
              Gerenciar IPTU
            </button>
          ) : null}
          {showCatalogo && onCatalogo ? (
            <button
              type="button"
              onClick={onCatalogo}
              disabled={catalogoDisabled}
              title={catalogoTitle}
              className={imoveisBtnSecondary}
            >
              <FolderOpen className="w-4 h-4 shrink-0" aria-hidden />
              Catálogo
            </button>
          ) : null}
          {showRelatorio && onRelatorio ? (
            <button type="button" onClick={onRelatorio} className={`${imoveisBtnSecondary} text-xs py-2 px-3`}>
              <FileSpreadsheet className="w-4 h-4" aria-hidden />
              Relatório
            </button>
          ) : null}
          {showGerarContratoLocacao && onGerarContratoLocacao ? (
            <button type="button" onClick={onGerarContratoLocacao} className={imoveisBtnSecondary}>
              <FileText className="w-4 h-4 shrink-0" aria-hidden />
              Contrato locação
            </button>
          ) : null}
          <button type="button" onClick={onFechar} className={imoveisBtnIconGhost} aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** @param {{ cards: { variant: keyof typeof SUMMARY_VARIANTS, label: string, value: string, alert?: boolean }[] }} props */
export function ImoveisSummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mb-8">
      {cards.map((c) => {
        const pendente = c.alert ?? valorParecePendente(c.value);
        const base = SUMMARY_VARIANTS[c.variant] ?? SUMMARY_VARIANTS.aluguel;
        const Icon = pendente && base.alertIcon ? base.alertIcon : base.Icon;
        const bg = pendente ? base.alertBg : base.bg;
        return (
          <div
            key={c.label}
            className={`rounded-xl border border-slate-200/60 dark:border-white/[0.07] border-l-4 ${base.border} ${bg} p-4 shadow-md hover:shadow-lg transition-shadow duration-200`}
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${base.iconWrap}`} aria-hidden>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${base.labelColor}`}>
                  {c.label}
                </p>
                <p
                  className={`text-base font-semibold leading-snug line-clamp-2 ${
                    pendente ? base.alertValueColor : base.valueColor
                  }`}
                >
                  {c.value}
                </p>
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
 *   rows: { key: string, label: string, numero: string, dataCons: string, debito: string, diaVenc: string, readOnlyDebito?: boolean }[],
 *   onChange: (key: string, field: string, value: string) => void,
 *   contratoExtra?: import('react').ReactNode,
 * }} props
 */
export function TabelaUtilidades({ rows, onChange, contratoExtra }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-white/[0.08]">
      <table className="w-full min-w-[640px] text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-white/[0.04] text-left border-b border-slate-200/90 dark:border-white/[0.08]">
            <th className="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Utilidade
            </th>
            <th className="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Nº conta
            </th>
            <th className="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Data cons.
            </th>
            <th className="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Débito autom.
            </th>
            <th className="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Dia venc.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const meta = UTILIDADE_META[row.key] ?? UTILIDADE_META.agua;
            const UIcon = meta.Icon;
            return (
              <tr
                key={row.key}
                className={`border-b border-slate-100 dark:border-white/[0.05] transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-white/[0.04] ${
                  idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.02]' : 'bg-white dark:bg-transparent'
                }`}
              >
                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md ${meta.bg}`} aria-hidden>
                      <UIcon className={`h-3.5 w-3.5 ${meta.color}`} strokeWidth={2.25} />
                    </span>
                    {row.label}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.numero}
                    onChange={(e) => onChange(row.key, 'numero', e.target.value)}
                    placeholder="—"
                    className={`${imoveisInputClass} py-2 text-xs`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.dataCons}
                    onChange={(e) => onChange(row.key, 'dataCons', e.target.value)}
                    placeholder="dd/mm/aaaa"
                    className={`${imoveisInputClass} py-2 text-xs`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.debito}
                    readOnly={row.readOnlyDebito}
                    onChange={(e) => onChange(row.key, 'debito', e.target.value)}
                    className={row.readOnlyDebito ? `${imoveisInputReadOnlyClass} py-2 text-xs` : `${imoveisInputClass} py-2 text-xs`}
                    placeholder={row.readOnlyDebito ? '—' : 'Sim / Não'}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.diaVenc}
                    onChange={(e) => onChange(row.key, 'diaVenc', e.target.value)}
                    placeholder="dia"
                    className={`${imoveisInputClass} py-2 text-xs`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {contratoExtra ? (
        <div className="p-4 border-t border-slate-200/90 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02]">
          {contratoExtra}
        </div>
      ) : null}
    </div>
  );
}

import { SeletorPessoaParteImovel } from './SeletorPessoaParteImovel.jsx';

/**
 * @param {{
 *   tipo: 'proprietario' | 'inquilino',
 *   titulo: string,
 *   numeroPessoa: string,
 *   nome: string,
 *   cpf: string,
 *   contato: string,
 *   carregando: boolean,
 *   erro: string,
 *   onSelecionarPessoa: (pessoa: { id: number, nome?: string, cpf?: string, telefone?: string }) => void,
 *   onLimparPessoa: () => void,
 *   removendo?: boolean,
 *   salvando?: boolean,
 * }} props
 */
function rotuloNomeComNumero(numeroPessoa, nome) {
  const n = String(numeroPessoa ?? '').trim();
  const nm = String(nome ?? '').trim();
  if (n && nm) return `#${n} · ${nm}`;
  if (nm) return nm;
  if (n) return `#${n}`;
  return '—';
}

export function CardParte({
  tipo,
  titulo,
  numeroPessoa,
  nome,
  cpf,
  contato,
  carregando,
  erro,
  onSelecionarPessoa,
  onLimparPessoa,
  removendo = false,
  salvando = false,
}) {
  const temNumero = Boolean(String(numeroPessoa ?? '').trim());
  const temNome = Boolean(String(nome ?? '').trim());
  const vinculado = (temNumero || temNome) && !erro;
  const vazio = !vinculado && !carregando;

  const border =
    tipo === 'proprietario'
      ? 'border-l-4 border-l-blue-500 dark:border-l-blue-400'
      : 'border-l-4 border-l-teal-500 dark:border-l-teal-400';

  const cardVinculadoBg =
    tipo === 'proprietario' ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'bg-teal-50/40 dark:bg-teal-950/20';

  const avatarVinculado = tipo === 'proprietario' ? 'bg-blue-500 text-white' : 'bg-teal-500 text-white';

  const href = telHref(contato);

  return (
    <div
      className={`rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${
        vazio
          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/25'
          : `border-slate-200/90 dark:border-white/[0.08] ${cardVinculadoBg} ${border}`
      }`}
    >
      {vazio ? (
        <div className="flex flex-col items-center text-center py-4 px-2">
          <div className="w-16 h-16 rounded-full bg-amber-100/80 dark:bg-amber-500/15 flex items-center justify-center mb-3" aria-hidden>
            <UserRound className="w-8 h-8 text-amber-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">{titulo}</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300/90 mt-1 max-w-xs">
            {erro ? erro : 'Nenhuma pessoa vinculada'}
          </p>
          <div className="mt-4 w-full max-w-xs">
            <SeletorPessoaParteImovel
              onChange={(p) => (p ? onSelecionarPessoa(p) : onLimparPessoa())}
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              vinculado ? avatarVinculado : 'bg-slate-200 text-slate-500 dark:bg-slate-600/40 dark:text-slate-300'
            }`}
            aria-hidden
          >
            {vinculado ? iniciaisNome(nome) : '?'}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
            {carregando ? <p className="text-xs text-slate-500">Carregando cadastro…</p> : null}
            {erro ? <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{erro}</p> : null}
            <div className="pt-1">
              <SeletorPessoaParteImovel
                onChange={(p) => (p ? onSelecionarPessoa(p) : onLimparPessoa())}
              />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-50 truncate">
                {rotuloNomeComNumero(numeroPessoa, nome)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                {cpf?.trim() ? formatDocBrExibicao(cpf.replace(/\D/g, '')) : cpf || '—'}
              </p>
              {href ? (
                <a
                  href={href}
                  className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:underline mt-1 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" aria-hidden />
                  {contato}
                </a>
              ) : (
                <p className="text-sm text-slate-400 italic mt-1">{contato?.trim() || 'Telefone não informado'}</p>
              )}
            </div>
            {vinculado ? (
              <button
                type="button"
                onClick={() => void onLimparPessoa()}
                disabled={removendo || salvando}
                className={`${imoveisBtnGhost}${removendo || salvando ? ' opacity-50 pointer-events-none' : ''}`}
              >
                {removendo ? 'Removendo…' : salvando ? 'Salvando…' : 'Remover vínculo'}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** @param {{ endereco: string, onChange: (v: string) => void, onCopy?: () => void, mapsUrl?: string | null }} props */
export function EnderecoComAcoes({ endereco, onChange, onCopy, mapsUrl }) {
  return (
    <div className="flex gap-2 items-start">
      <textarea
        value={endereco}
        onChange={(e) => onChange(e.target.value)}
        className={`${imoveisInputClass} flex-1 resize-y min-h-[4.5rem] leading-relaxed`}
        rows={3}
      />
      <div className="flex flex-col gap-1.5 shrink-0">
        {onCopy ? (
          <button type="button" onClick={onCopy} className={imoveisBtnIconGhost} title="Copiar endereço" aria-label="Copiar endereço">
            <Copy className="w-4 h-4" />
          </button>
        ) : null}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={imoveisBtnIconGhost} title="Abrir no Google Maps" aria-label="Abrir no Google Maps">
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
