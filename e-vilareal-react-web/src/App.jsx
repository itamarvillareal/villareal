import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Board } from './components/Board';
import { CadastroPessoas } from './components/cadastro-pessoas/CadastroPessoas';
import { RelatorioPessoas } from './components/cadastro-pessoas/RelatorioPessoas.jsx';
import { CadastroClientes } from './components/CadastroClientes';
import { Agenda } from './components/Agenda';
import { Processos } from './components/Processos';
import { PublicacoesProcessos } from './components/PublicacoesProcessos.jsx';
import { MonitoringPeoplePage } from './components/monitoring/MonitoringPeoplePage.jsx';
import { Imoveis } from './components/Imoveis';
import { ImoveisAdministracaoFinanceiro } from './components/ImoveisAdministracaoFinanceiro.jsx';
import { RelatorioImoveis } from './components/RelatorioImoveis.jsx';
import { RelatorioFinanceiroImoveis } from './components/RelatorioFinanceiroImoveis.jsx';
import { Relatorio } from './components/Relatorio';
import { RelatorioCalculos } from './components/RelatorioCalculos';
import { Calculos } from './components/Calculos';
import { Diagnosticos } from './components/Diagnosticos';
import { Financeiro } from './components/Financeiro';
import { Usuarios } from './components/Usuarios';
import { Configuracoes } from './components/Configuracoes';
import { Topicos } from './components/Topicos.jsx';
import { GerenteTopicos } from './components/GerenteTopicos.jsx';
import { Atividade } from './components/Atividade.jsx';
import { atualizarIndicesMensaisAposDia10 } from './services/monetaryIndicesService.js';
import { ensureHistoricoDemonstracaoDiagnostico } from './data/processosHistoricoData.js';
import { ensureDemoIntegradoCompleto } from './data/demoIntegradoSeed.js';
import { executarMigracaoAssistidaPhase23 } from './services/localStorageMigrationPhase23.js';
import { executarMigracaoAssistidaPhase4Processos } from './services/localStorageMigrationPhase4Processos.js';
import { executarMigracaoAssistidaPhase5Financeiro } from './services/financeiroMigrationPhase5.js';
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
  USUARIO_MASTER_ID,
} from './data/usuarioPermissoesStorage.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from './services/auditoriaCliente.js';

function RedirectClientesParaLista() {
  const location = useLocation();
  return <Navigate to="/clientes/lista" replace state={location.state} />;
}

let __ultimoLogNavegacao = { path: '', t: 0 };

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [accessTick, setAccessTick] = useState(0);

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
    if (pathNorm === '/atividade' && getOperadorEstacaoId() !== USUARIO_MASTER_ID) {
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
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
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
    try {
      ensureHistoricoDemonstracaoDiagnostico();
    } catch {
      /* não bloqueia o app */
    }
    try {
      ensureDemoIntegradoCompleto();
    } catch {
      /* não bloqueia o app */
    }
    let cancelled = false;
    (async () => {
      try {
        await executarMigracaoAssistidaPhase23();
      } catch {
        /* migração assistida não deve bloquear app */
      }
      try {
        await executarMigracaoAssistidaPhase4Processos();
      } catch {
        /* migração assistida não deve bloquear app */
      }
      try {
        if (import.meta.env.VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO_BOOTSTRAP === 'true') {
          await executarMigracaoAssistidaPhase5Financeiro();
        }
      } catch {
        /* migração assistida não deve bloquear app */
      }
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

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Board />} />
          <Route path="/clientes" element={<RedirectClientesParaLista />} />
          <Route path="/clientes/lista" element={<CadastroPessoas />} />
          <Route path="/clientes/relatorio" element={<RelatorioPessoas />} />
          <Route path="/clientes/editar/:id" element={<CadastroPessoas />} />
          <Route path="/clientes/nova" element={<CadastroPessoas />} />
          <Route path="/pessoas" element={<CadastroClientes />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/atividade" element={<Atividade />} />
          <Route path="/processos" element={<Processos />} />
          <Route path="/processos/publicacoes" element={<PublicacoesProcessos />} />
          <Route path="/processos/monitoramento" element={<MonitoringPeoplePage />} />
          <Route path="/imoveis" element={<Imoveis />} />
          <Route path="/imoveis/financeiro" element={<ImoveisAdministracaoFinanceiro />} />
          <Route path="/imoveis/relatorio-financeiro" element={<RelatorioFinanceiroImoveis />} />
          <Route path="/relatorio-imoveis" element={<RelatorioImoveis />} />
          <Route path="/relatorio" element={<Relatorio />} />
          <Route path="/relatorio-calculos" element={<RelatorioCalculos />} />
          <Route path="/calculos" element={<Calculos />} />
          <Route path="/topicos" element={<Topicos />} />
          <Route path="/topicos/gerente" element={<GerenteTopicos />} />
          <Route path="/diagnosticos" element={<Diagnosticos />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/diligencias" element={<Navigate to="/pendencias" replace />} />
          <Route path="/dativos" element={<Navigate to="/pendencias" replace />} />
          <Route path="/:section" element={<Board />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
