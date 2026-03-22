import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  UserCircle,
  Folder,
  Calculator,
  Building2,
  Calendar,
  CircleDollarSign,
  FileSpreadsheet,
  AlertTriangle,
  Briefcase,
  Scale,
  Activity,
  UserCog,
  Settings,
} from 'lucide-react';
import { navItems } from '../data/mockData';
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

const iconMap = {
  Users,
  UserCircle,
  Folder,
  Calculator,
  Building2,
  Calendar,
  CircleDollarSign,
  FileSpreadsheet,
  AlertTriangle,
  Briefcase,
  Scale,
  Activity,
  UserCog,
  Settings,
};

export function Sidebar() {
  const [, setMenuTick] = useState(0);

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
  const navFiltrado = navItems.filter((item) => pode(item.id));

  return (
    <aside className="w-48 min-h-screen bg-gray-200 border-r border-gray-300 flex flex-col shrink-0 shadow-sm">
      <div className="p-4 border-b border-gray-300 bg-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">villa real advocacia</h2>
        <p className="text-xs text-gray-500">Projeto Jurídico</p>
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {navFiltrado.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <NavLink
              key={item.id}
              to={`/${item.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-gray-700 text-sm font-medium transition-colors mb-0.5 ${
                  isActive
                    ? 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                    : 'hover:bg-gray-100'
                }`
              }
            >
              {Icon && <Icon className="w-5 h-5 shrink-0" />}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-2 border-t border-gray-300 bg-gray-100/80">
        {podeAlternar ? (
          <>
            <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
              Perfil ativo (teste)
            </label>
            <select
              value={getUsuarioSessaoAtualId()}
              onChange={(e) => setUsuarioSessaoAtualId(e.target.value)}
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
