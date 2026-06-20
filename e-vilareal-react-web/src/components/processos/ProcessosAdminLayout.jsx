import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

const STORAGE_PROCESSOS_ACOES_EXPANDIDAS = 'vilareal:processos-acoes-toolbar-expandida';
const STORAGE_PROCESSOS_BANNER_MOBILE = 'vilareal:processos-banner-mobile-expandido';
const MOBILE_BANNER_MQ = '(max-width: 767px)';

function lerPreferenciaAcoesExpandidas() {
  try {
    const raw = localStorage.getItem(STORAGE_PROCESSOS_ACOES_EXPANDIDAS);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function lerPreferenciaBannerMobileExpandido() {
  try {
    const raw = localStorage.getItem(STORAGE_PROCESSOS_BANNER_MOBILE);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    /* ignore */
  }
  return false;
}

function detectarViewportMobile() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_BANNER_MQ).matches;
}

/** Controle de expansão: no mobile recolhe o banner inteiro; no desktop só as ações. */
export function useProcessosBannerExpandido() {
  const [isMobile, setIsMobile] = useState(detectarViewportMobile);
  const [mobileExpandido, setMobileExpandido] = useState(lerPreferenciaBannerMobileExpandido);
  const [desktopAcoesExpandidas, setDesktopAcoesExpandidas] = useState(lerPreferenciaAcoesExpandidas);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BANNER_MQ);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    try {
      localStorage.setItem(STORAGE_PROCESSOS_BANNER_MOBILE, mobileExpandido ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [isMobile, mobileExpandido]);

  useEffect(() => {
    if (isMobile) return;
    try {
      localStorage.setItem(STORAGE_PROCESSOS_ACOES_EXPANDIDAS, desktopAcoesExpandidas ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [isMobile, desktopAcoesExpandidas]);

  const expandido = isMobile ? mobileExpandido : desktopAcoesExpandidas;
  const setExpandido = isMobile ? setMobileExpandido : setDesktopAcoesExpandidas;

  return { isMobile, expandido, setExpandido, alternarExpandido: () => setExpandido((v) => !v) };
}

export const processosInputClass =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 font-medium placeholder:text-gray-300 placeholder:italic focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-[box-shadow,border-color] duration-200';

export const processosInputReadOnlyClass = `${processosInputClass} bg-slate-50/95 cursor-default focus:ring-0 focus:border-gray-200`;

export const processosInputDenseClass =
  'w-full px-2.5 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-[box-shadow,border-color] duration-200';

export const processosInputDenseReadOnlyClass = `${processosInputDenseClass} bg-slate-50 cursor-default focus:ring-0 focus:border-gray-200`;

export const processosBtnPrimary =
  'inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-green-800 hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/25 ring-1 ring-white/15 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none';

export const processosBtnIndigo =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

export const processosBtnSecondary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

export const processosBtnOutlineIndigo =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-indigo-300 text-indigo-600 bg-white hover:bg-indigo-50 transition-colors duration-150';

export const processosBtnGhost =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-colors duration-150';

const processosToolbarBtnBase =
  'inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-xl text-sm font-semibold text-white shadow-md ring-1 ring-white/15 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none';

/** Barra de ações do processo — botões sólidos com gradiente (modelo portal). */
export const processosBtnToolbarPurple =
  `${processosToolbarBtnBase} bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 shadow-violet-500/25`;

export const processosBtnToolbarTeal =
  `${processosToolbarBtnBase} bg-gradient-to-r from-teal-700 to-cyan-800 hover:from-teal-600 hover:to-cyan-700 shadow-teal-500/25`;

export const processosBtnToolbarAmber =
  `${processosToolbarBtnBase} bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 shadow-amber-500/25`;

export const processosBtnToolbarGreen =
  `${processosToolbarBtnBase} bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 shadow-emerald-500/25`;

export const processosBtnToolbarOrange =
  `${processosToolbarBtnBase} bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 shadow-orange-500/25`;

export const processosBtnToolbarIndigo =
  `${processosToolbarBtnBase} bg-gradient-to-r from-indigo-700 to-slate-800 hover:from-indigo-600 hover:to-slate-700 shadow-indigo-500/25`;

export const processosBtnToolbarSky =
  `${processosToolbarBtnBase} bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-sky-500/25`;

export const processosBtnToolbarRose =
  `${processosToolbarBtnBase} bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-600 hover:to-red-700 shadow-rose-500/25`;

export const processosBtnToolbarCyan =
  `${processosToolbarBtnBase} bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-500 hover:to-teal-600 shadow-cyan-500/25`;

export const processosBtnToolbarRed =
  `${processosToolbarBtnBase} bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow-red-500/25`;

export const processosBtnToolbarRedacao =
  `${processosToolbarBtnBase} bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 shadow-red-500/25`;

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

const TOAST_VARIANTS = {
  success: {
    role: 'status',
    className:
      'bg-teal-600 text-white border-teal-500/50',
    Icon: Check,
    iconStroke: 2.5,
  },
  error: {
    role: 'alert',
    className:
      'bg-red-600 text-white border-red-500/50',
    Icon: AlertCircle,
    iconStroke: 2,
  },
  warning: {
    role: 'status',
    className:
      'bg-amber-600 text-white border-amber-500/50',
    Icon: AlertCircle,
    iconStroke: 2,
  },
};

/** @param {{ message: string, variant?: 'success'|'error'|'warning', onClose?: () => void }} props */
export function ProcessosToast({ message, variant = 'success', onClose }) {
  if (!message) return null;
  const cfg = TOAST_VARIANTS[variant] ?? TOAST_VARIANTS.success;
  const Icon = cfg.Icon;
  return (
    <div
      role={cfg.role}
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border max-w-[min(100%,22rem)] ${cfg.className}`}
    >
      <Icon className="w-5 h-5 shrink-0" strokeWidth={cfg.iconStroke} aria-hidden />
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
 *   edicaoDesabilitada?: boolean,
 *   onEdicaoDesabilitadaChange?: (checked: boolean) => void,
 *   actions?: import('react').ReactNode,
 *   onFechar: () => void,
 *   isMobile?: boolean,
 *   bannerExpandido?: boolean,
 *   onBannerExpandidoChange?: (expandido: boolean) => void,
 *   observacaoFase?: string,
 * }} props
 */
export function ProcessosStickyHeader({
  numeroCnj,
  cliente,
  statusAtivo,
  faseSelecionada,
  edicaoDesabilitada,
  onEdicaoDesabilitadaChange,
  actions,
  onFechar,
  isMobile = false,
  bannerExpandido: bannerExpandidoProp,
  onBannerExpandidoChange,
  observacaoFase = '',
}) {
  const { headerRef, scrolled } = useHeaderScrollShadow();
  const [acoesExpandidasLocal, setAcoesExpandidasLocal] = useState(lerPreferenciaAcoesExpandidas);
  const bannerExpandido = bannerExpandidoProp ?? acoesExpandidasLocal;
  const setBannerExpandido = onBannerExpandidoChange ?? setAcoesExpandidasLocal;
  const cnj = String(numeroCnj ?? '').trim() || '—';
  const fase = String(faseSelecionada ?? '').trim();
  const obsFase = String(observacaoFase ?? '').trim();
  const temAcoes = actions != null;
  const bannerCompactoMobile = isMobile && !bannerExpandido;

  const toggleBanner = () => setBannerExpandido(!bannerExpandido);
  const rotuloToggle = isMobile
    ? bannerExpandido
      ? 'Recolher banner'
      : 'Expandir banner'
    : bannerExpandido
      ? 'Recolher ações'
      : 'Expandir ações';

  const badgesStatus = (
    <>
      <span
        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border sm:px-3 sm:py-1 sm:text-xs ${
          statusAtivo ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-gray-100 text-gray-500 border-gray-300'
        }`}
      >
        {statusAtivo ? 'Ativo' : 'Inativo'}
      </span>
      {fase && statusAtivo ? (
        <span
          className="inline-flex max-w-[10rem] truncate px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-300 sm:max-w-[14rem] sm:px-3 sm:py-1 sm:text-xs"
          title={fase}
        >
          {fase}
        </span>
      ) : null}
    </>
  );

  return (
    <div
      ref={headerRef}
      className={`sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 border-b border-indigo-200/60 backdrop-blur-md transition-shadow duration-300 ${
        bannerCompactoMobile ? 'py-2 mb-2' : 'py-4 mb-5'
      } ${scrolled ? 'shadow-lg' : 'shadow-sm'} bg-gradient-to-br from-indigo-50 via-slate-50 to-slate-100`}
    >
      {bannerCompactoMobile ? (
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setBannerExpandido(true)}
            className="min-w-0 flex-1 rounded-lg border border-indigo-200/60 bg-white/70 px-3 py-2 text-left shadow-sm active:bg-white"
            aria-label="Expandir banner do processo"
          >
            <p className="font-mono text-xs font-bold leading-snug text-indigo-900 line-clamp-2" title={cnj !== '—' ? cnj : undefined}>
              {cnj}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-600" title={cliente || undefined}>
              {cliente || '—'}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">{badgesStatus}</div>
            {statusAtivo && obsFase ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-700 whitespace-pre-wrap" title={obsFase}>
                {obsFase}
              </p>
            ) : null}
          </button>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={toggleBanner}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-indigo-200/80 bg-white text-indigo-900 shadow-sm"
              aria-expanded={bannerExpandido}
              aria-label={rotuloToggle}
            >
              <ChevronDown className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600/90">Número CNJ</p>
              <p
                className={`font-mono font-bold text-indigo-900 break-all leading-tight ${
                  isMobile ? 'text-lg' : 'text-2xl'
                }`}
                title={cnj !== '—' ? cnj : undefined}
              >
                {cnj}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 min-w-0">
                <p
                  className={`min-w-0 text-slate-600 truncate ${isMobile ? 'text-base' : 'text-lg'}`}
                  title={cliente || undefined}
                >
                  {cliente || '—'}
                </p>
                {onEdicaoDesabilitadaChange ? (
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(edicaoDesabilitada)}
                      onChange={(e) => onEdicaoDesabilitadaChange(e.target.checked)}
                      className="rounded border-slate-300 accent-indigo-600"
                    />
                    Edição Desabilitada
                  </label>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">{badgesStatus}</div>
          </div>
          {temAcoes ? (
            <div className="mt-3 flex flex-col gap-2 border-t border-indigo-200/40 pt-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleBanner}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/80 bg-white/80 font-medium text-indigo-900 shadow-sm transition-colors hover:bg-white ${
                    isMobile ? 'min-h-11 flex-1 justify-center px-4 py-2.5 text-sm' : 'px-3 py-2 text-sm'
                  }`}
                  aria-expanded={bannerExpandido}
                  aria-controls="processos-acoes-toolbar"
                >
                  {bannerExpandido ? (
                    <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {rotuloToggle}
                </button>
                <button
                  type="button"
                  onClick={onFechar}
                  className={`shrink-0 rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 ${
                    isMobile ? 'flex min-h-11 min-w-11 items-center justify-center p-2.5' : 'p-2.5'
                  }`}
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {bannerExpandido ? (
                <div id="processos-acoes-toolbar" className="min-w-0 flex-1">
                  <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {actions}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex justify-end border-t border-indigo-200/40 pt-3">
              <button
                type="button"
                onClick={onFechar}
                className="shrink-0 rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 transition-colors hover:bg-gray-50"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
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
