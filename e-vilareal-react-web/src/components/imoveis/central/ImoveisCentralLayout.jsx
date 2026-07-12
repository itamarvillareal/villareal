import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BellRing,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  Menu,
  Receipt,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { carregarFollowupAlugueisApi } from '../../../repositories/imoveisRepository.js';
import { ImoveisCentralProvider, useImoveisCentral } from './ImoveisCentralContext.jsx';

const navClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
    isActive
      ? 'font-medium bg-white dark:bg-slate-800 border-l-2 border-teal-500 text-slate-900 dark:text-slate-100 -ml-px pl-[11px]'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;

function ImoveisSidebarContent({ location, onNavigate }) {
  const relatoriosAtivo = location.pathname.startsWith('/imoveis/relatorios');
  return (
    <>
      <p className="px-3 pt-1 pb-0.5 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
        Central de Imóveis
      </p>
      <nav className="px-1 space-y-0.5" aria-label="Navegação imóveis">
        <NavLink to="/imoveis/fechar-mes" className={navClass} onClick={onNavigate}>
          <ClipboardCheck className="w-[15px] h-[15px] shrink-0" />
          Fechar o Mês
        </NavLink>
        <NavLink to="/imoveis" end className={navClass} onClick={onNavigate}>
          <LayoutDashboard className="w-[15px] h-[15px] shrink-0" />
          Visão Geral
        </NavLink>
        <NavLink to="/imoveis/conciliacao" className={navClass} onClick={onNavigate}>
          <Link2 className="w-[15px] h-[15px] shrink-0" />
          Conciliação de aluguéis
        </NavLink>
        <NavLink
          to="/imoveis/relatorios"
          className={() => navClass({ isActive: relatoriosAtivo })}
          onClick={onNavigate}
        >
          <BarChart3 className="w-[15px] h-[15px] shrink-0" />
          Relatórios
        </NavLink>
      </nav>

      <p className="px-3 pt-3 pb-0.5 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
        Operacional
      </p>
      <nav className="px-1 space-y-0.5 pb-3" aria-label="Operacional imóveis">
        <NavLink to="/imoveis/cadastro" className={navClass} onClick={onNavigate}>
          <FileSpreadsheet className="w-[15px] h-[15px] shrink-0" />
          Cadastro (planilha)
        </NavLink>
        <NavLink to="/imoveis/pagamentos" end className={navClass} onClick={onNavigate}>
          <Wallet className="w-[15px] h-[15px] shrink-0" />
          Pagamentos
        </NavLink>
        <NavLink to="/imoveis/pagamentos/conciliacao" className={navClass} onClick={onNavigate}>
          <Link2 className="w-[15px] h-[15px] shrink-0" />
          Conciliação AP/boletos
        </NavLink>
        <NavLink to="/imoveis/demandas" className={navClass} onClick={onNavigate}>
          <LayoutGrid className="w-[15px] h-[15px] shrink-0" />
          Demandas
        </NavLink>
        <NavLink to="/iptu" className={navClass} onClick={onNavigate}>
          <Receipt className="w-[15px] h-[15px] shrink-0" />
          IPTU
        </NavLink>
      </nav>
    </>
  );
}

/**
 * Alerta persistente do follow-up: aparece em qualquer tela da Central enquanto houver caso de
 * aluguel exigindo ação — a gestão não depende de o usuário lembrar de abrir a Conciliação.
 */
function AlertaCasosEmAberto({ competencia, versaoRecarga }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    const ac = new AbortController();
    carregarFollowupAlugueisApi({ competencia, signal: ac.signal })
      .then((r) => setTotal(Number(r?.totalAcaoHoje) || 0))
      .catch(() => {});
    return () => ac.abort();
  }, [competencia, versaoRecarga]);

  if (total <= 0) return null;
  return (
    <NavLink
      to="/imoveis/conciliacao"
      className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
      title="Casos de aluguel em atraso aguardando ação (cobrar, reenviar ou ligar)"
    >
      <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span className="tabular-nums">{total}</span>
      <span className="hidden sm:inline">caso{total === 1 ? '' : 's'} exigindo ação</span>
    </NavLink>
  );
}

function ImoveisShell() {
  const location = useLocation();
  const { competencia, setCompetencia, carregando, recarregar, versaoRecarga } = useImoveisCentral();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="flex w-full flex-1 flex-col min-h-[60dvh] lg:min-h-0 lg:h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <header className="h-11 shrink-0 flex items-center justify-between gap-2 px-2 sm:px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Abrir menu de imóveis"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="w-4 h-4" aria-hidden />
          </button>
          <Building2 className="w-4 h-4 text-teal-600 shrink-0 hidden sm:block" aria-hidden />
          <h1 className="text-base font-medium text-slate-900 dark:text-slate-100 truncate">Imóveis</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <AlertaCasosEmAberto competencia={competencia} versaoRecarga={versaoRecarga} />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="hidden sm:inline">Competência</span>
            <input
              type="month"
              value={competencia}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}$/.test(v)) setCompetencia(v);
              }}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs tabular-nums"
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs px-2 py-1 sm:px-2.5 sm:py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={recarregar}
            title="Recarregar visão geral"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} aria-hidden />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {mobileNavOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/50 lg:hidden"
            aria-label="Fechar menu de imóveis"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-[80] flex w-[min(280px,88vw)] flex-col overflow-y-auto overscroll-y-contain border-r border-slate-200 bg-slate-50 pt-2 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900/95 lg:hidden ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
          aria-hidden={!mobileNavOpen}
        >
          <ImoveisSidebarContent location={location} onNavigate={() => setMobileNavOpen(false)} />
        </aside>

        <aside className="hidden lg:flex lg:flex-col shrink-0 h-full min-h-0 w-[190px] overflow-y-auto overscroll-y-contain border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 pt-2">
          <ImoveisSidebarContent location={location} />
        </aside>

        <main className="flex flex-1 flex-col min-h-0 min-w-0 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex flex-1 min-h-[40dvh] items-center justify-center p-8 text-sm text-slate-500">
                Carregando…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function ImoveisCentralLayout() {
  return (
    <ImoveisCentralProvider>
      <ImoveisShell />
    </ImoveisCentralProvider>
  );
}
