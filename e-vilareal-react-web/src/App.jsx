import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  LazyGerenteTopicos,
  LazyIntegracoesTribunalScraperLab,
  LazyImoveis,
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

  return (
    <div className="flex h-dvh min-h-0 max-h-dvh bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-[var(--vl-bg-page)]">
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
              <Route path="/" element={<LazyBoard />} />
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
