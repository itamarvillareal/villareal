import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Login } from './components/Login.jsx';
import { featureFlags } from './config/featureFlags.js';
import { Sidebar } from './components/Sidebar';
import {
  LazyAgenda,
  LazyJuliaCaixa,
  LazyAnaLuisa,
  LazyAtividade,
  LazyPatrimonio,
  LazyAtividadesEmLote,
  LazyBoard,
  LazyCadastroClientes,
  LazyCadastroPessoas,
  LazyCalculos,
  LazyConfiguracoes,
  LazyDiagnosticos,
  LazyRelatorioTarefas,
  LazyFinanceiro,
  LazyFinanceiroCartao,
  LazyFinanceiroAnalises,
  LazyFinanceiroInvestimentos,
  LazyFinanceiroCompensacao,
  LazyFinanceiroConfig,
  LazyFinanceiroConsolidado,
  LazyFinanceiroDashboard,
  LazyFinanceiroExtrato,
  LazyFinanceiroFatura,
  LazyFinanceiroFaturaFechamentos,
  LazyFinanceiroInbox,
  LazyFinanceiroLayout,
  LazyFinanceiroRelatorios,
  LazyPagamentos,
  LazyDescontoCheques,
  LazyGerenteTopicos,
  LazyGerarDocumento,
  LazyModelosPeticao,
  LazyProcessoRecebiveis,
  LazyIntegracoesTribunalScraperLab,
  LazyTribunaisCatalogoAdmin,
  LazyImoveis,
  LazyDemandas,
  LazyIptu,
  LazyIptuDashboard,
  LazyImoveisAdministracaoFinanceiro,
  LazyImoveisSugestoesVinculoGeral,
  LazyImoveisPagamentos,
  LazyConciliacaoBancaria,
  LazyAcertoCliente,
  LazyMonitoringPeoplePage,
  LazyProcessos,
  LazyPublicacoesProcessos,
  LazyConsultasPeriodicas,
  LazyPublicacoesEmail,
  LazyManifestacoesProjudi,
  LazyPeticionamentoProjudi,
  LazyDistribuicaoInicialProjudi,
  LazyRelatorio,
  LazyRelatorioResultadoProcessos,
  LazyQuadroRecebiveis,
  LazyAcoesDoDia,
  LazyRelatorioCalculos,
  LazyRelatorioFinanceiroImoveis,
  LazyRelatorioPagamentos,
  LazyRelatorioImoveis,
  LazyRelatorioPessoas,
  LazyTopicos,
  LazyUsuarios,
  LazyWhatsAppLayout,
  LazyWhatsAppDashboard,
  LazyWhatsAppConversas,
  LazyWhatsAppEnviarMensagem,
  LazyWhatsAppAgendamentos,
  LazyWhatsAppTemplates,
  LazyWhatsAppAniversarios,
  LazyPoliticaPrivacidade,
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
  perfilAtivoEhMasterEstacao,
  usuarioEhAdminApi,
} from './data/usuarioPermissoesStorage.js';
import { getUsuariosAtivos } from './data/agendaPersistenciaData';
import { getNomeExibicaoUsuario } from './data/usuarioDisplayHelpers.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from './services/auditoriaCliente.js';
import { installCrossTabLocalStorageSync } from './services/crossTabLocalStorageSync.js';
import { executarSincronizacaoAudienciasAgendaEProcessosCompleta, SYNC_AUDIENCIAS_AGENDA_AUTOMATICA } from './services/sincronizacaoAudienciasAgendaProcessosService.js';
import { hydrateRodadasCalculosResumoFromApi } from './data/calculosRodadasStorage.js';
import { ProcessoEmbedErrorBoundary } from './components/ProcessoEmbedErrorBoundary.jsx';

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
    void hydrateRodadasCalculosResumoFromApi({ silent: true });
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
    if (pathNorm === '/patrimonio' && !perfilAtivoEhMasterEstacao()) {
      navigate(getPrimeiraRotaPermitida(uid), { replace: true });
      return;
    }
    if (pathNorm === '/documentos/modelos' && !usuarioEhAdminApi()) {
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
          <ProcessoEmbedErrorBoundary
            resetKey={location.pathname}
            onFechar={() => window.location.reload()}
          >
            <div className="flex w-full min-w-0 flex-col max-lg:flex-none lg:min-h-0">
              <Outlet />
            </div>
          </ProcessoEmbedErrorBoundary>
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

  /** Agenda persistida → histórico local (audiência), leve e só com aba visível (evita OOM em /agenda). */
  useEffect(() => {
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;

    const run = () => {
      if (cancelled || typeof window === 'undefined' || document.hidden) return;
      void executarSincronizacaoAudienciasAgendaEProcessosCompleta(SYNC_AUDIENCIAS_AGENDA_AUTOMATICA).catch(() => {
        /* silencioso */
      });
    };

    const agendar = () => {
      if (cancelled || typeof window === 'undefined') return;
      if (document.hidden) return;
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        try {
          window.cancelIdleCallback(idleId);
        } catch {
          /* ignore */
        }
        idleId = null;
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(() => run(), { timeout: 8000 });
      } else {
        timeoutId = window.setTimeout(run, 1200);
      }
    };

    const onVisibility = () => {
      if (!document.hidden) agendar();
    };

    agendar();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        try {
          window.cancelIdleCallback(idleId);
        } catch {
          /* ignore */
        }
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
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
        void executarSincronizacaoAudienciasAgendaEProcessosCompleta(SYNC_AUDIENCIAS_AGENDA_AUTOMATICA).catch(() => {});
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
          <Route
            path="/privacidade"
            element={
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-white p-8 text-sm text-slate-600">
                    Carregando…
                  </div>
                }
              >
                <LazyPoliticaPrivacidade />
              </Suspense>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/acoes-do-dia" replace />} />
              <Route path="/acoes-do-dia" element={<LazyAcoesDoDia />} />
              <Route path="/clientes" element={<RedirectClientesParaLista />} />
              <Route path="/clientes/lista" element={<LazyCadastroPessoas />} />
              <Route path="/clientes/relatorio" element={<LazyRelatorioPessoas />} />
              <Route path="/clientes/editar/:id" element={<LazyCadastroPessoas />} />
              <Route path="/clientes/nova" element={<LazyCadastroPessoas />} />
              <Route path="/pessoas" element={<LazyCadastroClientes />} />
              <Route path="/agenda" element={<LazyAgenda />} />
              <Route path="/julia/caixa" element={<LazyJuliaCaixa />} />
              <Route path="/ana-luisa" element={<LazyAnaLuisa />} />
              <Route path="/atividade" element={<LazyAtividade />} />
              <Route path="/patrimonio" element={<LazyPatrimonio />} />
              <Route path="/atividades-em-lote" element={<LazyAtividadesEmLote />} />
              <Route path="/processos" element={<LazyProcessos />} />
              <Route path="/processos/publicacoes" element={<LazyPublicacoesProcessos />} />
              <Route
                path="/processos/consultas-periodicas"
                element={<LazyConsultasPeriodicas />}
              />
              <Route path="/publicacoes-email" element={<LazyPublicacoesEmail />} />
              <Route
                path="/processos/manifestacoes-projudi"
                element={<LazyManifestacoesProjudi />}
              />
              <Route path="/processos/recebiveis" element={<LazyProcessoRecebiveis />} />
              <Route path="/processos/peticionamento-projudi" element={<LazyPeticionamentoProjudi />} />
              <Route path="/processos/distribuicao-inicial-projudi" element={<LazyDistribuicaoInicialProjudi />} />
              <Route path="/processos/monitoramento" element={<LazyMonitoringPeoplePage />} />
              <Route path="/imoveis" element={<LazyImoveis />} />
              <Route path="/imoveis/demandas" element={<LazyDemandas />} />
              <Route path="/iptu/:imovelId" element={<LazyIptu />} />
              <Route path="/iptu" element={<LazyIptuDashboard />} />
              <Route path="/imoveis/financeiro" element={<LazyImoveisAdministracaoFinanceiro />} />
              <Route path="/imoveis/pagamentos" element={<LazyImoveisPagamentos />} />
              <Route path="/imoveis/pagamentos/conciliacao" element={<LazyConciliacaoBancaria />} />
              <Route path="/imoveis/acerto-cliente" element={<LazyAcertoCliente />} />
              <Route path="/imoveis/sugestoes-vinculo" element={<LazyImoveisSugestoesVinculoGeral />} />
              <Route path="/imoveis/relatorio-financeiro" element={<LazyRelatorioFinanceiroImoveis />} />
              <Route path="/imoveis/relatorio-pagamentos" element={<LazyRelatorioPagamentos />} />
              <Route path="/relatorio-imoveis" element={<LazyRelatorioImoveis />} />
              <Route path="/relatorio" element={<LazyRelatorio />} />
              <Route path="/resultado-financeiro" element={<Navigate to="/resultado-financeiro/autos" replace />} />
              <Route path="/resultado-financeiro/autos" element={<LazyRelatorioResultadoProcessos />} />
              <Route path="/resultado-financeiro/cobranca" element={<Navigate to="/recebiveis?tipo=HONORARIOS" replace />} />
              <Route path="/recebiveis" element={<LazyQuadroRecebiveis />} />
              <Route
                path="/relatorio-resultado-processos"
                element={<Navigate to="/resultado-financeiro/autos" replace />}
              />
              <Route
                path="/relatorio-resultado-processos/recebiveis"
                element={<Navigate to="/recebiveis?tipo=HONORARIOS" replace />}
              />
              <Route path="/relatorio-calculos" element={<LazyRelatorioCalculos />} />
              <Route path="/calculos" element={<LazyCalculos />} />
              <Route path="/topicos" element={<LazyTopicos />} />
              <Route path="/topicos/gerente" element={<LazyGerenteTopicos />} />
              <Route path="/relatorio-tarefas" element={<LazyRelatorioTarefas />} />
              <Route path="/diagnosticos" element={<LazyDiagnosticos />} />
              <Route path="/whatsapp" element={<LazyWhatsAppLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<LazyWhatsAppDashboard />} />
                <Route path="conversas" element={<LazyWhatsAppConversas />} />
                <Route path="enviar" element={<LazyWhatsAppEnviarMensagem />} />
                <Route path="agendamentos" element={<LazyWhatsAppAgendamentos />} />
                <Route path="templates" element={<LazyWhatsAppTemplates />} />
                <Route path="aniversarios" element={<LazyWhatsAppAniversarios />} />
              </Route>
              <Route path="/integracoes/scraper-lab" element={<LazyIntegracoesTribunalScraperLab />} />
              <Route path="/integracoes/tribunais" element={<LazyTribunaisCatalogoAdmin />} />
              <Route path="/documentos/gerar" element={<LazyGerarDocumento />} />
              <Route path="/documentos/recebiveis" element={<Navigate to="/recebiveis?tipo=HONORARIOS" replace />} />
              <Route path="/documentos/modelos" element={<LazyModelosPeticao />} />
              <Route path="/financeiro" element={<LazyFinanceiroLayout />}>
                <Route index element={<LazyFinanceiroDashboard />} />
                <Route path="extrato" element={<LazyFinanceiroExtrato />} />
                <Route path="inbox" element={<LazyFinanceiroInbox />} />
                <Route path="inbox/:tipo" element={<LazyFinanceiroInbox />} />
                <Route path="consolidado" element={<LazyFinanceiroConsolidado />} />
                <Route path="consolidado/:conta" element={<LazyFinanceiroConsolidado />} />
                <Route path="analises" element={<LazyFinanceiroAnalises />} />
                <Route path="investimentos" element={<LazyFinanceiroInvestimentos />} />
                <Route path="compensacao" element={<LazyFinanceiroCompensacao />} />
                <Route path="fatura" element={<LazyFinanceiroFatura />} />
                <Route path="fatura/fechamentos" element={<LazyFinanceiroFaturaFechamentos />} />
                <Route path="cartao" element={<LazyFinanceiroCartao />} />
                <Route path="cartao/:id" element={<LazyFinanceiroCartao />} />
                <Route path="relatorios" element={<LazyFinanceiroRelatorios />} />
                <Route path="configuracao" element={<LazyFinanceiroConfig />} />
                {/* Legado: view completa extrato+consolidado */}
                <Route path="legado" element={<LazyFinanceiro />} />
              </Route>
              <Route path="/pagamentos" element={<LazyPagamentos />} />
              <Route path="/descontos-cheque" element={<LazyDescontoCheques />} />
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
