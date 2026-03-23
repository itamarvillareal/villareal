import { useState, useEffect } from 'react';
import { Settings, Moon } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider.jsx';
import { isUsuarioMaster, setUsuarioMaster } from '../data/consultasVinculoHistoricoStorage.js';
import { resetVinculacaoTesteCompleto } from '../data/vinculacaoTesteReset.js';
import { reaplicarDemoIntegradoCompleto } from '../data/demoIntegradoSeed.js';
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
    <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 bg-gray-100">
      <header className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
          <Settings className="w-7 h-7 text-slate-700" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Configurações</h1>
          <p className="text-sm text-slate-500">Preferências e opções do aplicativo.</p>
        </div>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm max-w-2xl space-y-6">
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
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              dark ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
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

        <div className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-800">Desenvolvimento — pacote demo integrado</h2>
          <p className="text-sm text-slate-600 mt-2">
            Reaplica o seed de <strong>Processos/Diagnósticos</strong> (clientes 1–3, processos demo) e alinha{' '}
            <strong>Agenda</strong> (audiências nos dias demo 19/03 e 20/03/2026) e <strong>Financeiro</strong> (CEF com
            lançamentos <code className="text-xs bg-slate-100 px-1 rounded">demo-int-*</code> vinculados a clientes e
            processos do mock 10×10). Útil para testar navegação entre módulos com os mesmos códigos e CNJs.
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  'Reaplicar o pacote demo integrado? Isso sobrescreve os registros demo de processos no navegador e atualiza agenda/extratos CEF de demonstração. Recarregue a página (F5) em seguida.'
                )
              ) {
                return;
              }
              const r = reaplicarDemoIntegradoCompleto();
              if (r?.ok) {
                window.alert('Pacote demo integrado aplicado. Recarregue a página (F5) para atualizar todas as telas.');
              }
            }}
            className="mt-3 px-4 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-950 text-sm font-medium hover:bg-indigo-100"
          >
            Reaplicar pacote demo integrado (Processos + Agenda + Financeiro)
          </button>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-800">Desenvolvimento — mock de vinculação automática</h2>
          <p className="text-sm text-slate-600 mt-2">
            Restaura os 50 lançamentos de teste (nº 88000–88049) nos extratos <strong>sem cliente/processo</strong>,
            reaplica a rodada de Cálculos de teste (cliente 999 / proc. 88) e zera o relatório de consultas de vínculo
            guardado neste navegador. Use para testar a busca automática de novo após vínculos ou edições.
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  'Resetar dados de teste de vinculação? Recarregue a página (F5) em seguida para atualizar Cálculos e Financeiro.'
                )
              ) {
                return;
              }
              const r = resetVinculacaoTesteCompleto();
              if (r.ok) {
                window.alert('Reset concluído. Recarregue a página (F5).');
              }
            }}
            className="mt-3 px-4 py-2 rounded-lg border border-amber-400 bg-amber-50 text-amber-950 text-sm font-medium hover:bg-amber-100"
          >
            Resetar mock de vinculação (teste)
          </button>
        </div>
      </section>
    </div>
  );
}
