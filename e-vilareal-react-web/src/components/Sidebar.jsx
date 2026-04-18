import { useEffect, useState } from 'react';
import { NavLink, useLocation, Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { navItems } from '../data/navConfig.js';
import { SidebarMenuIcon } from './navigation/SidebarMenuIcons.jsx';
import { getUsuariosAtivos } from '../data/agendaPersistenciaData';
import {
  getUsuarioSessaoAtualId,
  setUsuarioSessaoAtualId,
  usuarioPodeAcessarModulo,
  getPerfilAtivoParaPermissoes,
  operadorPodeAlternarPerfil,
  getOperadorEstacaoId,
  isUsuarioMasterEstacao,
  getApiUsuarioSessao,
} from '../data/usuarioPermissoesStorage.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { registrarAuditoria } from '../services/auditoriaCliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import { featureFlags } from '../config/featureFlags.js';

function itemMenuPermitido(item, podeFn) {
  if (Array.isArray(item.children) && item.children.length > 0) {
    return item.children.some((ch) => podeFn(ch.id));
  }
  return podeFn(item.id);
}

/**
 * @param {object} [props]
 * @param {boolean} [props.mobileDrawerOpen] — controlado pelo Layout (App) abaixo do breakpoint `lg`.
 * @param {(open: boolean) => void} [props.onMobileDrawerChange] — fecha o drawer após navegar ou backdrop.
 */
export function Sidebar({ mobileDrawerOpen = false, onMobileDrawerChange } = {}) {
  const [, setMenuTick] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [gruposAbertos, setGruposAbertos] = useState(() => new Set());

  useEffect(() => {
    const h = () => setMenuTick((t) => t + 1);
    window.addEventListener('vilareal:usuarios-agenda-atualizados', h);
    window.addEventListener('vilareal:usuario-sessao-atualizada', h);
    window.addEventListener('vilareal:permissoes-usuarios-atualizadas', h);
    window.addEventListener('vilareal:operador-estacao-atualizado', h);
    return () => {
      window.removeEventListener('vilareal:usuarios-agenda-atualizados', h);
      window.removeEventListener('vilareal:usuario-sessao-atualizada', h);
      window.removeEventListener('vilareal:permissoes-usuarios-atualizadas', h);
      window.removeEventListener('vilareal:operador-estacao-atualizado', h);
    };
  }, []);

  const perfilId = getPerfilAtivoParaPermissoes();
  const usuariosLista = getUsuariosAtivos();
  const podeAlternar = operadorPodeAlternarPerfil();
  const operadorId = getOperadorEstacaoId();
  const apiSessao = getApiUsuarioSessao();
  const nomeOperador = getNomeExibicaoUsuario(usuariosLista?.find((u) => u.id === operadorId)) ?? operadorId;

  const pode = (modId) => usuarioPodeAcessarModulo(perfilId, modId);
  const navFiltrado = navItems
    .filter((item) => item.id !== 'integracoes-grupo' || featureFlags.showTribunalScraperLab)
    .filter((item) => itemMenuPermitido(item, pode))
    .filter((item) => item.id !== 'atividade' || isUsuarioMasterEstacao());

  useEffect(() => {
    const p = location.pathname.replace(/\/+$/, '') || '/';
    if (p === '/processos' || p.startsWith('/processos/') || p === '/relatorio' || p.startsWith('/relatorio/')) {
      setGruposAbertos((prev) => new Set(prev).add('processos-grupo'));
    }
    if (p === '/calculos' || p.startsWith('/calculos/') || p === '/relatorio-calculos' || p.startsWith('/relatorio-calculos/')) {
      setGruposAbertos((prev) => new Set(prev).add('calcular-grupo'));
    }
    if (
      p === '/imoveis' ||
      p.startsWith('/imoveis/') ||
      p === '/relatorio-imoveis' ||
      p.startsWith('/relatorio-imoveis/')
    ) {
      setGruposAbertos((prev) => new Set(prev).add('admin-imoveis-grupo'));
    }
    if (p === '/clientes' || p.startsWith('/clientes/')) {
      setGruposAbertos((prev) => new Set(prev).add('pessoas-grupo'));
    }
    if (p === '/topicos' || p.startsWith('/topicos/')) {
      setGruposAbertos((prev) => new Set(prev).add('topicos-grupo'));
    }
    if (p === '/integracoes/scraper-lab' || p.startsWith('/integracoes/')) {
      setGruposAbertos((prev) => new Set(prev).add('integracoes-grupo'));
    }
  }, [location.pathname]);

  const toggleGrupo = (grupoId) => {
    setGruposAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(grupoId)) n.delete(grupoId);
      else n.add(grupoId);
      return n;
    });
  };

  const closeMobileDrawer = () => onMobileDrawerChange?.(false);

  useEffect(() => {
    if (!mobileDrawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onMobileDrawerChange?.(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileDrawerOpen, onMobileDrawerChange]);

  return (
    <>
      {mobileDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] cursor-default bg-black/50 lg:hidden"
          aria-label="Fechar menu"
          onClick={closeMobileDrawer}
        />
      ) : null}
      <aside
        className={`vl-sidebar flex h-full max-h-dvh min-h-0 flex-col border-r border-gray-300 bg-gray-200 shadow-sm transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-52 lg:shrink-0 lg:translate-x-0
        fixed inset-y-0 left-0 z-[100] w-[min(19rem,90vw)] max-w-[20rem]
        ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
      <div className="flex shrink-0 items-center justify-end border-b border-gray-300 bg-gray-100 px-1 py-1 lg:hidden">
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-200 dark:text-slate-200 dark:hover:bg-white/10"
          aria-label="Fechar menu de navegação"
          onClick={closeMobileDrawer}
        >
          <X className="h-6 w-6" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="vl-sidebar-header shrink-0 px-2 py-1.5 border-b border-gray-300 bg-gray-100">
        <Link
          to="/"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-[#0f141c]"
          title="Ir para o painel"
        >
          <img
            src="/logo-villareal.png"
            alt="Villa Real e advogados associados"
            className="w-full max-h-[2.85rem] object-contain object-center mx-auto"
            width={200}
            height={88}
            decoding="async"
          />
        </Link>
      </div>
      <nav className="flex-1 min-h-0 p-1.5 overflow-y-auto overflow-x-hidden space-y-0 leading-tight [scrollbar-width:thin]">
        {navFiltrado.map((item) => {
          if (Array.isArray(item.children) && item.children.length > 0) {
            const subs = item.children.filter((ch) => pode(ch.id));
            if (subs.length === 0) return null;
            const aberto = gruposAbertos.has(item.id);
            const algumFilhoAtivo = subs.some((ch) => {
              const path = location.pathname.replace(/\/+$/, '') || '/';
              if (ch.id === 'clientes/lista') {
                return path === '/clientes/lista' || path.startsWith('/clientes/editar/');
              }
              if (ch.id === 'clientes/relatorio') {
                return path === '/clientes/relatorio';
              }
              if (ch.id === 'relatorio-imoveis') {
                return path === '/relatorio-imoveis';
              }
              return path === `/${ch.id}` || path.startsWith(`/${ch.id}/`);
            });
            return (
              <div key={item.id} className="mb-0">
                <button
                  type="button"
                  onClick={() => {
                    if (item.id === 'processos-grupo') {
                      setGruposAbertos((prev) => new Set(prev).add(item.id));
                      navigate('/processos');
                      closeMobileDrawer();
                      return;
                    }
                    if (item.id === 'calcular-grupo') {
                      setGruposAbertos((prev) => new Set(prev).add(item.id));
                      if (subs[0]) navigate(`/${subs[0].id}`);
                      closeMobileDrawer();
                      return;
                    }
                    if (item.id === 'admin-imoveis-grupo') {
                      setGruposAbertos((prev) => new Set(prev).add(item.id));
                      if (subs[0]) navigate(`/${subs[0].id}`);
                      closeMobileDrawer();
                      return;
                    }
                    if (item.id === 'integracoes-grupo') {
                      setGruposAbertos((prev) => new Set(prev).add(item.id));
                      if (subs[0]) navigate(`/${subs[0].id}`);
                      closeMobileDrawer();
                      return;
                    }
                    toggleGrupo(item.id);
                  }}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-gray-700 dark:text-slate-200 text-xs font-medium transition-all duration-200 text-left ${
                    algumFilhoAtivo
                      ? 'bg-blue-50 dark:bg-cyan-500/10 text-blue-900 dark:text-cyan-100 border-l-2 border-blue-400 dark:border-cyan-400/70 shadow-sm dark:shadow-none'
                      : 'hover:bg-gray-100 dark:hover:bg-white/[0.05] border-l-2 border-transparent'
                  }`}
                  aria-expanded={aberto}
                >
                  <SidebarMenuIcon id={item.id} className="w-4 h-4 shrink-0" />
                  <span className="flex-1 min-w-0 leading-snug">{item.label}</span>
                  {aberto ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-500" aria-hidden />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-500" aria-hidden />
                  )}
                </button>
                {aberto && (
                  <div className="mt-0.5 ml-1.5 pl-1.5 border-l border-gray-300 dark:border-white/10 space-y-0">
                    {subs.map((ch) => (
                        <NavLink
                          key={ch.id}
                          to={`/${ch.id}`}
                          end={ch.id !== 'clientes/lista'}
                          onClick={closeMobileDrawer}
                          className={({ isActive }) => {
                            const path = location.pathname.replace(/\/+$/, '') || '/';
                            let ativo = isActive;
                            if (ch.id === 'clientes/lista') {
                              ativo = path === '/clientes/lista' || path.startsWith('/clientes/editar/');
                            } else                             if (ch.id === 'clientes/relatorio') {
                              ativo = path === '/clientes/relatorio';
                            } else if (ch.id === 'relatorio-imoveis') {
                              ativo = path === '/relatorio-imoveis';
                            }
                            return `flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                              ativo
                                ? 'bg-blue-100 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-100 border-l-2 border-blue-500 dark:border-cyan-400'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] border-l-2 border-transparent'
                            }`;
                          }}
                        >
                          <SidebarMenuIcon id={ch.id} className="w-3.5 h-3.5 shrink-0" />
                          <span className="leading-snug">{ch.label}</span>
                        </NavLink>
                      ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <NavLink
              key={item.id}
              to={`/${item.id}`}
              onClick={closeMobileDrawer}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2 py-1.5 rounded-md text-gray-700 dark:text-slate-200 text-xs font-medium transition-all duration-200 mb-0 ${
                  isActive
                    ? 'bg-blue-100 dark:bg-cyan-500/12 text-blue-800 dark:text-cyan-100 border-l-2 border-blue-500 dark:border-cyan-400'
                    : 'hover:bg-gray-100 dark:hover:bg-white/[0.05] border-l-2 border-transparent'
                }`
              }
            >
              <SidebarMenuIcon id={item.id} className="w-4 h-4 shrink-0" />
              <span className="leading-snug">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="vl-sidebar-footer shrink-0 p-2 border-t border-gray-300 bg-gray-100/80">
        {podeAlternar ? (
          <>
            <label className="block text-[9px] font-medium text-gray-500 uppercase tracking-wide mb-0.5 leading-tight">
              Perfil ativo (teste)
            </label>
            <select
              value={getUsuarioSessaoAtualId()}
              onChange={(e) => {
                const novo = e.target.value;
                const anterior = getUsuarioSessaoAtualId();
                if (novo === anterior) return;
                const ul = getUsuariosAtivos();
                const na = getNomeExibicaoUsuario(ul.find((u) => u.id === anterior)) ?? anterior;
                const nn = getNomeExibicaoUsuario(ul.find((u) => u.id === novo)) ?? novo;
                const nomeOp = nomeOperador;
                registrarAuditoria({
                  modulo: 'Sessão',
                  tela: '/',
                  tipoAcao: 'TROCA_PERFIL',
                  descricao: `Usuário ${nomeOp} alterou o perfil ativo (teste) de ${na} para ${nn}.`,
                  observacoesTecnicas: `operadorEstacao=${operadorId}`,
                });
                setUsuarioSessaoAtualId(novo);
              }}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-800"
              title="Somente o usuário master (Itamar) pode alternar perfis para testar o sistema."
            >
          {(usuariosLista || []).map((u) => (
            <option key={u.id} value={u.id}>
              {getNomeExibicaoUsuario(u)}
            </option>
          ))}
            </select>
            <p className="mt-1 text-[9px] leading-tight text-gray-500">
              Você está nesta estação como <strong className="text-gray-700">master</strong> (
              {apiSessao?.login || apiSessao?.nome || operadorId}). Escolha outro perfil para simular permissões e
              telas.
            </p>
          </>
        ) : (
          <>
            <label className="block text-[9px] font-medium text-gray-500 uppercase tracking-wide mb-0.5 leading-tight">
              Seu perfil
            </label>
            <div className="rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-800 font-medium leading-tight">
              {nomeOperador}
            </div>
            <p className="mt-1 text-[9px] leading-tight text-gray-500">
              Apenas o usuário master (Itamar) pode trocar de perfil neste menu. Ajuste em{' '}
              <strong className="text-gray-600">Configurações</strong> se esta máquina for de outra pessoa.
            </p>
          </>
        )}
        {featureFlags.requiresApiAuth && isAuthenticated ? (
          <button
            type="button"
            className="mt-1.5 w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Sair (sessão API)
          </button>
        ) : null}
      </div>
    </aside>
    </>
  );
}
