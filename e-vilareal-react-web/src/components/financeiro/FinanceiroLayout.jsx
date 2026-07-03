import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  FileText,
  Inbox,
  Layers,
  LayoutDashboard,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { featureFlags } from '../../config/featureFlags.js';
import { listarContadoresEtapaApi, listarCartoesFinanceiro } from '../../repositories/financeiroRepository.js';
import { ETAPAS, FINANCEIRO_CARTAO_IMPORTADO } from './constants/financeiroConstants.js';
import { FinanceiroProvider, useFinanceiroChrome } from './FinanceiroContext.jsx';
import { FinanceiroToastProvider } from './shared/Toast.jsx';
import { DashboardSkeleton } from './shared/LoadingSkeleton.jsx';
import { BancoItem } from './shared/BancoItem.jsx';
import { ExtratoImportModal } from './extrato/ExtratoImportModal.jsx';
import { ModalPesquisaValorLancamento } from './pesquisa/ModalPesquisaValorLancamento.jsx';
import { FaturaCartaoImportModal } from './cartao/FaturaCartaoImportModal.jsx';
import {
  FINANCEIRO_REFRESH_PENDENTES,
  dispatchRefreshPendentes,
  focusFinanceiroBusca,
  handleFinanceiroEscape,
  useKeyboardShortcuts,
} from './hooks/useKeyboardShortcuts.js';

const navClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
    isActive
      ? 'font-medium bg-white dark:bg-slate-800 border-l-2 border-blue-500 text-slate-900 dark:text-slate-100 -ml-px pl-[11px]'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;

function FinanceiroShell({
  importOpen,
  onOpenImport,
  onCloseImport,
  onImportSuccess,
  faturaImportOpen,
  onCloseFaturaImport,
  cartaoParaFaturaImport,
  onRequestFaturaImport,
  onFaturaImportSuccess,
  pesquisaValorOpen,
  onOpenPesquisaValor,
  onClosePesquisaValor,
}) {
  const navigate = useNavigate();
  const cartaoRouteMatch = useMatch('/financeiro/cartao/:id');
  const cartaoNumeroRoute =
    cartaoRouteMatch?.params?.id != null && cartaoRouteMatch.params.id !== ''
      ? Number(cartaoRouteMatch.params.id)
      : null;
  const naTelaCartao = Number.isFinite(cartaoNumeroRoute);

  const globalShortcuts = useMemo(
    () => [
      { key: 'i', ctrl: true, handler: () => navigate('/financeiro/inbox/classificar') },
      { key: 'e', ctrl: true, handler: () => navigate('/financeiro/extrato') },
      { key: 'd', alt: true, handler: () => navigate('/financeiro') },
      { key: '/', handler: () => focusFinanceiroBusca() },
      { key: 'Escape', handler: () => handleFinanceiroEscape() },
    ],
    [navigate],
  );

  useKeyboardShortcuts(globalShortcuts);

  const {
    totalPendentes,
    bancos,
    bancosVisiveis,
    bancosRestantes,
    bancosExpandidos,
    setBancosExpandidos,
    bancoAtivo,
    selecionarBanco,
    sidebarCollapsed,
    setSidebarCollapsed,
    cartoes,
  } = useFinanceiroChrome();

  const handleImportSuccess = useCallback(
    ({ numeroBanco, bancoNome } = {}) => {
      let nb =
        numeroBanco != null && Number.isFinite(Number(numeroBanco)) ? Number(numeroBanco) : null;
      if (nb == null && bancoNome) {
        nb = bancos.find((b) => b.nome === bancoNome)?.numero ?? null;
      }
      if (nb != null) {
        const idx = bancos.findIndex((b) => b.numero === nb);
        if (idx >= 5 && !bancosExpandidos) {
          setBancosExpandidos(true);
        }
        selecionarBanco(nb);
      }
      onImportSuccess?.();
    },
    [bancos, bancosExpandidos, selecionarBanco, setBancosExpandidos, onImportSuccess],
  );

  return (
    <div className="flex w-full flex-1 flex-col min-h-[60dvh] lg:min-h-0 lg:h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <header className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base font-medium text-slate-900 dark:text-slate-100">Financeiro</h1>
          {totalPendentes > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/financeiro/inbox')}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {totalPendentes.toLocaleString('pt-BR')} pendentes
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={onOpenPesquisaValor}
            title="Pesquisar lançamento por data e valor exatos"
          >
            <Search className="w-3.5 h-3.5" aria-hidden />
            Pesquisar valor
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={onOpenImport}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden />
            {naTelaCartao ? 'Importar fatura' : 'Importar'}
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Configurações"
            onClick={() => navigate('/financeiro/configuracao')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <aside
          className={`shrink-0 h-full min-h-0 overflow-y-auto overscroll-y-contain border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 transition-[width] ${
            sidebarCollapsed ? 'w-12' : 'w-[180px]'
          }`}
        >
          <div className="p-1">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="w-full flex justify-center p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {!sidebarCollapsed ? (
            <>
              <p className="px-3 pt-1 pb-0.5 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                Navegação
              </p>
              <nav className="px-1 space-y-0.5" aria-label="Navegação financeiro">
                <NavLink to="/financeiro" end className={navClass}>
                  <LayoutDashboard className="w-[15px] h-[15px] shrink-0" />
                  Painel
                </NavLink>
                <NavLink to="/financeiro/extrato" className={navClass}>
                  <FileText className="w-[15px] h-[15px] shrink-0" />
                  Extrato
                </NavLink>
                <NavLink to="/financeiro/inbox" className={navClass}>
                  <Inbox className="w-[15px] h-[15px] shrink-0" />
                  Inbox
                  {totalPendentes > 0 ? (
                    <span className="ml-auto text-[11px] font-medium px-1.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                      {totalPendentes > 99 ? '99+' : totalPendentes}
                    </span>
                  ) : null}
                </NavLink>
                <NavLink to="/financeiro/consolidado" className={navClass}>
                  <BarChart3 className="w-[15px] h-[15px] shrink-0" />
                  Consolidado
                </NavLink>
                <NavLink to="/financeiro/total" className={navClass}>
                  <Layers className="w-[15px] h-[15px] shrink-0" />
                  Total
                </NavLink>
                <NavLink to="/financeiro/analises" className={navClass}>
                  <Sparkles className="w-[15px] h-[15px] shrink-0" />
                  Análises
                </NavLink>
                <NavLink to="/financeiro/investimentos" className={navClass}>
                  <TrendingUp className="w-[15px] h-[15px] shrink-0" />
                  Investimentos
                </NavLink>
                <NavLink to="/financeiro/compensacao" className={navClass}>
                  <Link2 className="w-[15px] h-[15px] shrink-0" />
                  Compensação
                </NavLink>
                <NavLink to="/financeiro/fatura/fechamentos" className={navClass}>
                  <Receipt className="w-[15px] h-[15px] shrink-0" />
                  Fechamentos fatura
                </NavLink>
                <NavLink to="/financeiro/fatura" className={navClass}>
                  <Receipt className="w-[15px] h-[15px] shrink-0 opacity-60" />
                  Regras fatura
                </NavLink>
                <NavLink to="/financeiro/relatorios" className={navClass}>
                  <BarChart3 className="w-[15px] h-[15px] shrink-0" />
                  Relatórios
                </NavLink>
              </nav>

              <p className="px-3 pt-3 pb-0.5 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                Bancos
              </p>
              <div className="px-0 pb-1">
                {bancosVisiveis.map((b) => (
                  <BancoItem
                    key={b.numero}
                    nome={b.nome}
                    count={b.count}
                    ativo={bancoAtivo === b.numero}
                    onClick={() => selecionarBanco(b.numero)}
                  />
                ))}
                {bancosRestantes > 0 && !bancosExpandidos ? (
                  <button
                    type="button"
                    onClick={() => setBancosExpandidos(true)}
                    className="w-full text-left text-xs px-3 py-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    + {bancosRestantes} outros
                  </button>
                ) : null}
              </div>

              <p className="px-3 pt-2 pb-0.5 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                Cartões
              </p>
              <div className="px-0 pb-3">
                {cartoes.map((c) => (
                  <NavLink
                    key={c.numero}
                    to={`/financeiro/cartao/${c.numero}`}
                    className={({ isActive }) =>
                      `block text-xs py-1.5 px-3 truncate ${
                        isActive
                          ? 'font-medium bg-white dark:bg-slate-800 border-l-2 border-amber-500'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <CreditCard className="w-3 h-3 inline mr-1 opacity-60" aria-hidden />
                    {c.nome}
                  </NavLink>
                ))}
              </div>
            </>
          ) : null}
        </aside>

        <main className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
          <Suspense fallback={<DashboardSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <ExtratoImportModal
        open={importOpen}
        onClose={onCloseImport}
        bancoInicial={bancoAtivo}
        cartoes={cartoes}
        onRequestFaturaImport={onRequestFaturaImport}
        onSuccess={handleImportSuccess}
      />

      <FaturaCartaoImportModal
        open={faturaImportOpen}
        cartao={cartaoParaFaturaImport}
        onClose={onCloseFaturaImport}
        onSuccess={onFaturaImportSuccess}
      />

      <ModalPesquisaValorLancamento open={pesquisaValorOpen} onClose={onClosePesquisaValor} />
    </div>
  );
}

export function FinanceiroLayout() {
  const cartaoRouteMatch = useMatch('/financeiro/cartao/:id');
  const cartaoNumeroRoute =
    cartaoRouteMatch?.params?.id != null && cartaoRouteMatch.params.id !== ''
      ? Number(cartaoRouteMatch.params.id)
      : null;

  const [meta, setMeta] = useState({ totalPendentes: 0, contadores: {} });
  const [importOpen, setImportOpen] = useState(false);
  const [pesquisaValorOpen, setPesquisaValorOpen] = useState(false);
  const [faturaImportOpen, setFaturaImportOpen] = useState(false);
  const [faturaCartaoNumero, setFaturaCartaoNumero] = useState(null);
  const [cartoesApi, setCartoesApi] = useState([]);
  const [bancosRevision, setBancosRevision] = useState(0);

  const refreshBancos = useCallback(() => {
    setBancosRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    listarCartoesFinanceiro({ signal: ac.signal })
      .then((lista) => setCartoesApi(Array.isArray(lista) ? lista : []))
      .catch(() => setCartoesApi([]));
    return () => ac.abort();
  }, [bancosRevision]);

  const cartaoParaFaturaImport = useMemo(() => {
    const num =
      faturaCartaoNumero != null && Number.isFinite(Number(faturaCartaoNumero))
        ? Number(faturaCartaoNumero)
        : Number.isFinite(cartaoNumeroRoute)
          ? cartaoNumeroRoute
          : null;
    if (num == null) return null;
    return cartoesApi.find((c) => Number(c.numeroCartao) === num) ?? null;
  }, [cartoesApi, faturaCartaoNumero, cartaoNumeroRoute]);

  const onOpenImport = useCallback(() => {
    if (Number.isFinite(cartaoNumeroRoute)) {
      setFaturaCartaoNumero(cartaoNumeroRoute);
      setFaturaImportOpen(true);
      return;
    }
    setImportOpen(true);
  }, [cartaoNumeroRoute]);

  const onRequestFaturaImport = useCallback((numeroCartao) => {
    setImportOpen(false);
    setFaturaCartaoNumero(Number(numeroCartao));
    setFaturaImportOpen(true);
  }, []);

  const onCloseFaturaImport = useCallback(() => {
    setFaturaImportOpen(false);
    setFaturaCartaoNumero(null);
  }, []);

  const carregarPendentes = useCallback(async (signal) => {
    if (!featureFlags.useApiFinanceiro) return;
    try {
      const contadores = await listarContadoresEtapaApi({ signal });
      const pendentes = Number(contadores?.[ETAPAS.IMPORTADO] ?? 0);
      const nextContadores = contadores && typeof contadores === 'object' ? contadores : {};
      setMeta((prev) => {
        if (
          prev.totalPendentes === pendentes &&
          JSON.stringify(prev.contadores) === JSON.stringify(nextContadores)
        ) {
          return prev;
        }
        return { totalPendentes: pendentes, contadores: nextContadores };
      });
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    carregarPendentes(ac.signal);
    return () => ac.abort();
  }, [carregarPendentes]);

  useEffect(() => {
    const onRefresh = () => {
      const ac = new AbortController();
      carregarPendentes(ac.signal);
    };
    window.addEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
    return () => window.removeEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
  }, [carregarPendentes]);

  const handleImportSuccess = useCallback(() => {
    refreshBancos();
    const ac = new AbortController();
    carregarPendentes(ac.signal);
    dispatchRefreshPendentes();
    window.dispatchEvent(new CustomEvent(FINANCEIRO_CARTAO_IMPORTADO));
  }, [refreshBancos, carregarPendentes]);

  const handleFaturaImportSuccess = useCallback(() => {
    handleImportSuccess();
    onCloseFaturaImport();
  }, [handleImportSuccess, onCloseFaturaImport]);

  return (
    <FinanceiroToastProvider>
      <FinanceiroProvider
        contadores={meta.contadores}
        totalPendentes={meta.totalPendentes}
        bancosRevision={bancosRevision}
        refreshBancos={refreshBancos}
      >
        <FinanceiroShell
          importOpen={importOpen}
          onOpenImport={onOpenImport}
          onCloseImport={() => setImportOpen(false)}
          onImportSuccess={handleImportSuccess}
          faturaImportOpen={faturaImportOpen}
          onCloseFaturaImport={onCloseFaturaImport}
          cartaoParaFaturaImport={cartaoParaFaturaImport}
          onRequestFaturaImport={onRequestFaturaImport}
          onFaturaImportSuccess={handleFaturaImportSuccess}
          pesquisaValorOpen={pesquisaValorOpen}
          onOpenPesquisaValor={() => setPesquisaValorOpen(true)}
          onClosePesquisaValor={() => setPesquisaValorOpen(false)}
        />
      </FinanceiroProvider>
    </FinanceiroToastProvider>
  );
}
