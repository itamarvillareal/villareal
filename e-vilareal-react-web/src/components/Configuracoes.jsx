import { useState, useEffect } from 'react';
import { Settings, Moon } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider.jsx';
import { isUsuarioMaster, setUsuarioMaster } from '../data/consultasVinculoHistoricoStorage.js';
import { getUsuariosAtivos } from '../data/agendaPersistenciaData.js';
import {
  getOperadorEstacaoId,
  setOperadorEstacaoId,
  setUsuarioSessaoAtualId,
  USUARIO_MASTER_ID,
} from '../data/usuarioPermissoesStorage.js';

/**
 * Tela de configurações do sistema.
 */
export function Configuracoes() {
  const { dark, setDark } = useTheme();
  const [usuarioMaster, setUsuarioMasterState] = useState(() => isUsuarioMaster());
  const [operadorEstacao, setOperadorEstacaoState] = useState(() => getOperadorEstacaoId());

  useEffect(() => {
    setUsuarioMasterState(isUsuarioMaster());
    setOperadorEstacaoState(getOperadorEstacaoId());
  }, []);

  function onToggleMaster(checked) {
    setUsuarioMaster(checked);
    setUsuarioMasterState(checked);
  }

  function onChangeOperadorEstacao(novoId) {
    setOperadorEstacaoId(novoId);
    setOperadorEstacaoState(novoId);
    setUsuarioSessaoAtualId(novoId);
  }

  const listaUsuarios = getUsuariosAtivos() || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]">
      <header className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
          <Settings className="w-7 h-7" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 dark:from-indigo-200 dark:to-violet-200 bg-clip-text text-transparent">
            Configurações
          </h1>
          <p className="text-sm text-slate-500">Preferências e opções do aplicativo.</p>
        </div>
      </header>
      <section className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-sm p-6 shadow-xl ring-1 ring-indigo-500/10 max-w-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
              <Moon className="w-5 h-5 text-slate-700" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Modo Noturno</h2>
              <p className="text-sm text-slate-600 mt-1">
                Ativa o tema escuro em todo o sistema. A preferência fica guardada neste navegador.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label={dark ? 'Desativar modo noturno' : 'Ativar modo noturno'}
            onClick={() => setDark(!dark)}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              dark ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white dark:bg-[#e8edf4] shadow ring-0 transition duration-200 ease-in-out ${
                dark ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-800">Esta estação (quem usa este computador)</h2>
          <p className="text-sm text-slate-600 mt-2">
            O usuário <strong>{USUARIO_MASTER_ID}</strong> (Itamar) é o <strong>master</strong>: só ele pode usar o
            menu lateral para <strong>testar o sistema com o perfil de outros usuários</strong>. Nas demais estações,
            defina o usuário principal abaixo — o perfil não poderá ser alterado no menu (apenas as permissões
            configuradas em <strong>Usuários</strong> para essa pessoa).
          </p>
          <label className="block text-xs font-medium text-slate-600 mt-4 mb-1">Usuário principal desta máquina</label>
          <select
            value={operadorEstacao}
            onChange={(e) => onChangeOperadorEstacao(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {listaUsuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} ({u.id})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">
            Com <strong>Itamar</strong> selecionado, o seletor de perfil para testes aparece na barra lateral. Com
            qualquer outro usuário, o menu lateral mostra apenas o perfil fixo.
          </p>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-800">Financeiro — relatório de consultas de vínculo</h2>
          <p className="text-sm text-slate-600 mt-2">
            O histórico de consultas automáticas fica guardado neste navegador e permanece disponível ao longo dos
            dias. Apenas o <strong>usuário master</strong> pode usar o botão para excluir esse relatório na tela
            Financeiro.
          </p>
          <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={usuarioMaster}
              onChange={(e) => onToggleMaster(e.target.checked)}
            />
            <span className="text-sm text-slate-700">
              Esta estação é <strong>usuário master</strong> (mostrar botão &quot;Excluir relatório de consultas&quot;)
            </span>
          </label>
          <p className="text-xs text-slate-500 mt-2 pl-7">
            Desmarque em computadores compartilhados onde não deve ser possível apagar o histórico. Se nunca alterar
            esta opção, o comportamento padrão é master ativado (escritório com um único usuário).
          </p>
        </div>
      </section>
    </div>
  );
}
