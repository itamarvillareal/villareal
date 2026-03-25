import { useEffect, useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { navItems } from '../data/mockData';
import { SidebarMenuIcon } from './navigation/SidebarMenuIcons.jsx';
import { getUsuariosAtivos } from '../data/agendaPersistenciaData';
import {
  getUsuarioSessaoAtualId,
  setUsuarioSessaoAtualId,
  usuarioPodeAcessarModulo,
  getPerfilAtivoParaPermissoes,
  operadorPodeAlternarPerfil,
  getOperadorEstacaoId,
  USUARIO_MASTER_ID,
} from '../data/usuarioPermissoesStorage.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { registrarAuditoria } from '../services/auditoriaCliente.js';

function itemMenuPermitido(item, podeFn) {
  if (Array.isArray(item.children) && item.children.length > 0) {
    return item.children.some((ch) => podeFn(ch.id));
  }
  return podeFn(item.id);
}

export function Sidebar() {
  const [, setMenuTick] = useState(0);
  const location = useLocation();
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
  const nomeOperador = getNomeExibicaoUsuario(usuariosLista?.find((u) => u.id === operadorId)) ?? operadorId;

  const pode = (modId) => usuarioPodeAcessarModulo(perfilId, modId);
  const navFiltrado = navItems
    .filter((item) => itemMenuPermitido(item, pode))
    .filter((item) => item.id !== 'atividade' || operadorId === USUARIO_MASTER_ID);

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
  }, [location.pathname]);

  const toggleGrupo = (grupoId) => {
    setGruposAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(grupoId)) n.delete(grupoId);
      else n.add(grupoId);
      return n;
    });
  };

  return (
    <aside className="vl-sidebar w-56 min-h-screen bg-gray-200 border-r border-gray-300 flex flex-col shrink-0 shadow-sm">
      <div className="vl-sidebar-header p-3 border-b border-gray-300 bg-gray-100">
        <Link
          to="/"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-[#0f141c]"
          title="Ir para o painel"
        >
          <img
            src="/logo-villareal.png"
            alt="Villa Real e advogados associados"
            className="w-full max-h-[5.5rem] object-contain object-center mx-auto"
            width={200}
            height={88}
            decoding="async"
          />
        </Link>
      </div>
      <nav className="flex-1 p-2.5 overflow-y-auto space-y-0.5">
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
              return path === `/${ch.id}` || path.startsWith(`/${ch.id}/`);
            });
            return (
              <div key={item.id} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => toggleGrupo(item.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-700 dark:text-slate-200 text-sm font-medium transition-all duration-200 text-left ${
                    algumFilhoAtivo
                      ? 'bg-blue-50 dark:bg-cyan-500/10 text-blue-900 dark:text-cyan-100 border-l-2 border-blue-400 dark:border-cyan-400/70 shadow-sm dark:shadow-none'
                      : 'hover:bg-gray-100 dark:hover:bg-white/[0.05] border-l-2 border-transparent'
                  }`}
                  aria-expanded={aberto}
                >
                  <SidebarMenuIcon id={item.id} className="w-5 h-5" />
                  <span className="flex-1 min-w-0">{item.label}</span>
                  {aberto ? (
                    <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                  )}
                </button>
                {aberto && (
                  <div className="mt-1 ml-2 pl-2 border-l border-gray-300 dark:border-white/10 space-y-0.5">
                    {subs.map((ch) => (
                        <NavLink
                          key={ch.id}
                          to={`/${ch.id}`}
                          end={ch.id !== 'clientes/lista'}
                          className={({ isActive }) => {
                            const path = location.pathname.replace(/\/+$/, '') || '/';
                            let ativo = isActive;
                            if (ch.id === 'clientes/lista') {
                              ativo = path === '/clientes/lista' || path.startsWith('/clientes/editar/');
                            } else if (ch.id === 'clientes/relatorio') {
                              ativo = path === '/clientes/relatorio';
                            }
                            return `flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                              ativo
                                ? 'bg-blue-100 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-100 border-l-2 border-blue-500 dark:border-cyan-400'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] border-l-2 border-transparent'
                            }`;
                          }}
                        >
                          <SidebarMenuIcon id={ch.id} className="w-4 h-4" />
                          <span>{ch.label}</span>
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
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-slate-200 text-sm font-medium transition-all duration-200 mb-0.5 ${
                  isActive
                    ? 'bg-blue-100 dark:bg-cyan-500/12 text-blue-800 dark:text-cyan-100 border-l-2 border-blue-500 dark:border-cyan-400'
                    : 'hover:bg-gray-100 dark:hover:bg-white/[0.05] border-l-2 border-transparent'
                }`
              }
            >
              <SidebarMenuIcon id={item.id} className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="vl-sidebar-footer p-2.5 border-t border-gray-300 bg-gray-100/80">
        {podeAlternar ? (
          <>
            <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
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
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800"
              title="Somente o usuário master (Itamar) pode alternar perfis para testar o sistema."
            >
          {(usuariosLista || []).map((u) => (
            <option key={u.id} value={u.id}>
              {getNomeExibicaoUsuario(u)}
            </option>
          ))}
            </select>
            <p className="mt-1.5 text-[10px] leading-snug text-gray-500">
              Você está nesta estação como <strong className="text-gray-700">master</strong> ({USUARIO_MASTER_ID}
              ). Escolha outro perfil para simular permissões e telas.
            </p>
          </>
        ) : (
          <>
            <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
              Seu perfil
            </label>
            <div className="rounded border border-gray-200 bg-white px-2 py-2 text-xs text-gray-800 font-medium">
              {nomeOperador}
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-gray-500">
              Apenas o usuário master (Itamar) pode trocar de perfil neste menu. Ajuste em{' '}
              <strong className="text-gray-600">Configurações</strong> se esta máquina for de outra pessoa.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
