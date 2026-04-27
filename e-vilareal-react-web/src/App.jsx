import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Login } from './components/Login.jsx';
import { featureFlags } from './config/featureFlags.js';
import { Sidebar } from './components/Sidebar';
import {
  LazyAgenda,
  LazyAnaLuisa,
  LazyAtividade,
  LazyAtividadesEmLote,
  LazyBoard,
  LazyCadastroClientes,
  LazyCadastroPessoas,
  LazyCalculos,
  LazyConfiguracoes,
  LazyDiagnosticos,
  LazyFinanceiro,
  LazyPagamentos,
  LazyGerenteTopicos,
  LazyIntegracoesTribunalScraperLab,
  LazyImoveis,
  LazyIptu,
  LazyIptuDashboard,
  LazyImoveisAdministracaoFinanceiro,
  LazyMonitoringPeoplePage,
  LazyProcessos,
  LazyPublicacoesProcessos,
  LazyRelatorio,
  LazyRelatorioCalculos,
  LazyRelatorioFinanceiroImoveis,
  LazyRelatorioImoveis,
  LazyRelatorioPessoas,
  LazyTopicos,
  LazyUsuarios,
} from './app/lazyScreens.jsx';
import { atualizarIndicesMensaisAposDia10 } from './services/monetaryIndicesService.js';
import {
  getPerfilAtivoParaPermissoes,
  getUsuarioSessaoAtualId,
  usuarioPodeAcessarModulo,
  pathParaModuloId,
  getPrimeiraRotaPermitida,
  getRotuloModuloPorPathname,
  operadorPodeAlternarPerfil,
  getOperadorEstacaoId,
  setUsuarioSessaoAtualId,
  isUsuarioMasterEstacao,
} from './data/usuarioPermissoesStorage.js';
import { getUsuariosAtivos } from './data/agendaPersistenciaData';
import { getNomeExibicaoUsuario } from './data/usuarioDisplayHelpers.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from './services/auditoriaCliente.js';
import { installCrossTabLocalStorageSync } from './services/crossTabLocalStorageSync.js';
import { executarSincronizacaoAudienciasAgendaEProcessosCompleta } from './services/sincronizacaoAudienciasAgendaProcessosService.js';
import { hydrateRodadasCalculosResumoFromApi } from './data/calculosRodadasStorage.js';

function RedirectClientesParaLista() {
  const location = useLocation();
  return <Navigate to="/clientes/lista" replace state={location.state} />;
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!featureFlags.requiresApiAuth) {
    return <Outlet />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

let __ultimoLogNavegacao = { path: '', t: 0 };

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [accessTick, setAccessTick] = useState(0);
  /** Drawer de navegação só abaixo do breakpoint lg: menu hamburger no topo (consulta rápida; bottom nav roubaría área de conteúdo). */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /** Metadados das rodadas (`GET /rodadas/resumo`): leve; payloads completos vêm sob demanda em Cálculos. */
  useEffect(() => {
    if (!featureFlags.useApiCalculos) return;
    void hydrateRodadasCalculosResumoFromApi();
  }, []);

  useEffect(() => {
    const h = () => setAccessTick((t) => t + 1);
    window.addEventListener('vilareal:usuario-sessao-atualizada', h);
    window.addEventListener('vilareal:permissoes-usuarios-atualizadas', h);
    window.addEventListener('vilareal:operador-estacao-atualizado', h);
    return () => {
      window.removeEventListener('vilareal:usuario-sessao-atualizada', h);
      window.removeEventListener('vilareal:permissoes-usuarios-atualizadas', h);
      window.removeEventListener('vilareal:operador-estacao-atualizado', h);
    };
  }, []);

  /** Estação não-master: mantém a sessão alinhada ao usuário desta estação (sem personificação). */
  useEffect(() => {
    if (operadorPodeAlternarPerfil()) return;
    const op = getOperadorEstacaoId();
    if (getUsuarioSessaoAtualId() !== op) {
      setUsuarioSessaoAtualId(op);
    }
  }, [accessTick]);

  useEffect(() => {
    const path = (location.pathname || '').replace(/\/+$/, '') || '/';
    const t = window.setTimeout(() => {
      const now = Date.now();
      if (__ultimoLogNavegacao.path === path && now - __ultimoLogNavegacao.t < 900) return;
      __ultimoLogNavegacao = { path, t: now };
      const mod = getRotuloModuloPorPathname(path);
      const { usuarioNome } = getContextoAuditoriaUsuario();
      registrarAuditoria({
        modulo: mod,
        tela: path,
        tipoAcao: 'ACESSO_MODULO',
        descricao: `Usuário ${usuarioNome} acessou o módulo ${mod}.`,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const pathNorm = (location.pathname || '/').replace(/\/+$/, '') || '/';
    const uid = getPerfilAtivoParaPermissoes();
    if (pathNorm === '/atividade' && !isUsuarioMasterEstacao()) {
      navigate(getPrimeiraRotaPermitida(uid), { replace: true });
      return;
    }
    const mod = pathParaModuloId(location.pathname);
    if (!usuarioPodeAcessarModulo(uid, mod)) {
      const dest = getPrimeiraRotaPermitida(uid);
      const destNorm = (dest || '/').replace(/\/+$/, '') || '/';
      if (pathNorm !== destNorm) {
        navigate(dest, { replace: true });
      }
    }
  }, [location.pathname, navigate, accessTick]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const perfilTopo = getPerfilAtivoParaPermissoes();
  const listaUsuariosTopo = getUsuariosAtivos();
  const idSessaoTopo = getUsuarioSessaoAtualId();
  const usuarioTopo = (listaUsuariosTopo || []).find((x) => String(x.id) === String(idSessaoTopo));
  const rotuloPerfilTopo =
    getNomeExibicaoUsuario(usuarioTopo) ||
    (String(idSessaoTopo || '').trim() ? String(idSessaoTopo).toUpperCase() : String(perfilTopo || '—'));

  return (
    <div className="flex h-dvh min-h-0 max-h-dvh flex-col bg-gray-100 overflow-hidden lg:flex-row">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--vl-border)] bg-[var(--vl-bg-elevated)] px-2 py-1.5 lg:hidden">
        <button
          type="button"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--vl-border-strong)] bg-[var(--vl-bg-card)] text-[var(--vl-text)] shadow-sm active:bg-[var(--vl-bg-muted)]"
          aria-label="Abrir menu de navegação"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-6 w-6" strokeWidth={2} aria-hidden />
        </button>
        <Link
          to="/"
          className="flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          title="Ir para a agenda"
        >
          <img
            src="/logo-villareal.png"
            alt="Villa Real"
            className="h-9 max-h-9 w-auto max-w-[10rem] object-contain object-center"
            width={160}
            height={56}
            decoding="async"
          />
        </Link>
        <div
          className="max-w-[42%] truncate rounded-lg border border-[var(--vl-border)] bg-[var(--vl-bg-card)] px-2.5 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--vl-text-secondary)]"
          title={rotuloPerfilTopo}
        >
          {rotuloPerfilTopo}
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        <Sidebar mobileDrawerOpen={mobileNavOpen} onMobileDrawerChange={setMobileNavOpen} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[var(--vl-bg-page)] pb-[env(safe-area-inset-bottom,0px)]">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-600 dark:text-slate-400">
              Carregando módulo…
            </div>
          }
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        </Suspense>
        </main>
      </div>
      {import.meta.env.MODE === 'homolog' ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-[200] border-t border-amber-400/80 bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-950 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:border-amber-500/50 dark:bg-amber-950/90 dark:text-amber-100"
          role="status"
        >
          Modo <strong>homologação</strong> — variáveis em <code className="rounded bg-amber-100/90 px-1 dark:bg-black/30">.env.homolog</code> ·
          roteiro: <code className="rounded bg-amber-100/90 px-1 dark:bg-black/30">docs/homologation-quick-start.md</code>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  useEffect(() => {
    const removeCrossTab = installCrossTabLocalStorageSync();
    return () => removeCrossTab();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        const run = () => atualizarIndicesMensaisAposDia10();
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
          await new Promise((resolve) => {
            window.requestIdleCallback(async () => {
              if (cancelled) return resolve();
              try {
                await run();
              } catch {
                // silencioso: não quebra a UI
              } finally {
                resolve();
              }
            });
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 0));
          try {
            await run();
          } catch {
            // silencioso: não quebra a UI
          }
        }
      } catch {
        // Não impede o app de abrir se a atualização falhar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Agenda persistida → histórico local de processos (audiência), em idle após abrir o app. */
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled || typeof window === 'undefined') return;
      void executarSincronizacaoAudienciasAgendaEProcessosCompleta().catch(() => {
        /* silencioso */
      });
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => run(), { timeout: 4000 });
      return () => {
        cancelled = true;
        try {
          window.cancelIdleCallback(id);
        } catch {
          /* ignore */
        }
      };
    }
    const t = window.setTimeout(run, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  /**
   * Após importação/salvamento de clientes (API), o índice CNJ×processo muda — volta a sincronizar audiências.
   * Não escuta `agenda-persistencia-atualizada` para evitar loop (a própria sync pode gravar na agenda local).
   */
  useEffect(() => {
    let timer;
    const agendar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void executarSincronizacaoAudienciasAgendaEProcessosCompleta().catch(() => {});
      }, 2000);
    };
    window.addEventListener('vilareal:cadastro-clientes-externo-atualizado', agendar);
    return () => {
      window.removeEventListener('vilareal:cadastro-clientes-externo-atualizado', agendar);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/agenda" replace />} />
              <Route path="/clientes" element={<RedirectClientesParaLista />} />
              <Route path="/clientes/lista" element={<LazyCadastroPessoas />} />
              <Route path="/clientes/relatorio" element={<LazyRelatorioPessoas />} />
              <Route path="/clientes/editar/:id" element={<LazyCadastroPessoas />} />
              <Route path="/clientes/nova" element={<LazyCadastroPessoas />} />
              <Route path="/pessoas" element={<LazyCadastroClientes />} />
              <Route path="/agenda" element={<LazyAgenda />} />
              <Route path="/ana-luisa" element={<LazyAnaLuisa />} />
              <Route path="/atividade" element={<LazyAtividade />} />
              <Route path="/atividades-em-lote" element={<LazyAtividadesEmLote />} />
              <Route path="/processos" element={<LazyProcessos />} />
              <Route path="/processos/publicacoes" element={<LazyPublicacoesProcessos />} />
              <Route path="/processos/monitoramento" element={<LazyMonitoringPeoplePage />} />
              <Route path="/imoveis" element={<LazyImoveis />} />
              <Route path="/iptu/:imovelId" element={<LazyIptu />} />
              <Route path="/iptu" element={<LazyIptuDashboard />} />
              <Route path="/imoveis/financeiro" element={<LazyImoveisAdministracaoFinanceiro />} />
              <Route path="/imoveis/relatorio-financeiro" element={<LazyRelatorioFinanceiroImoveis />} />
              <Route path="/relatorio-imoveis" element={<LazyRelatorioImoveis />} />
              <Route path="/relatorio" element={<LazyRelatorio />} />
              <Route path="/relatorio-calculos" element={<LazyRelatorioCalculos />} />
              <Route path="/calculos" element={<LazyCalculos />} />
              <Route path="/topicos" element={<LazyTopicos />} />
              <Route path="/topicos/gerente" element={<LazyGerenteTopicos />} />
              <Route path="/diagnosticos" element={<LazyDiagnosticos />} />
              <Route path="/integracoes/scraper-lab" element={<LazyIntegracoesTribunalScraperLab />} />
              <Route path="/financeiro" element={<LazyFinanceiro />} />
              <Route path="/pagamentos" element={<LazyPagamentos />} />
              <Route path="/usuarios" element={<LazyUsuarios />} />
              <Route path="/configuracoes" element={<LazyConfiguracoes />} />
              <Route path="/diligencias" element={<Navigate to="/pendencias" replace />} />
              <Route path="/dativos" element={<Navigate to="/pendencias" replace />} />
              <Route path="/:section" element={<LazyBoard />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
