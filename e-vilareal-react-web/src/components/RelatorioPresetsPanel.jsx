import { useState, useEffect, useRef } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import {
  carregarPresetsRelatorio,
  salvarNovoPresetRelatorio,
  excluirPresetRelatorio,
  aplicarPresetRelatorio,
  configRelatorioPadrao,
  normalizarFiltroProcessoAtivo,
} from '../data/relatorioPresets.js';

/**
 * Botão + painel para guardar e aplicar configurações do relatório (colunas, largura, título da coluna dinâmica).
 */
export function RelatorioPresetsPanel({
  colIds,
  colunasVisiveis,
  setColunasVisiveis,
  larguraUniforme,
  setLarguraUniforme,
  campoUltimoAndamento,
  setCampoUltimoAndamento,
  filtroProcessoAtivo,
  setFiltroProcessoAtivo,
  modoAlteracao,
  setModoAlteracao,
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [feedback, setFeedback] = useState('');
  const [lista, setLista] = useState(() => carregarPresetsRelatorio());
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    setLista(carregarPresetsRelatorio());
    setFeedback('');
  }, [aberto]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!aberto) return;
      const el = ref.current;
      if (el && !el.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [aberto]);

  const snapshot = () => ({
    colunasVisiveis,
    larguraUniforme,
    campoUltimoAndamento,
    filtroProcessoAtivo: normalizarFiltroProcessoAtivo(filtroProcessoAtivo),
    modoAlteracao: !!modoAlteracao,
  });

  const handleSalvar = () => {
    setFeedback('');
    const r = salvarNovoPresetRelatorio(nome, snapshot(), colIds);
    if (!r.ok) {
      setFeedback(r.mensagem);
      return;
    }
    setNome('');
    setLista(carregarPresetsRelatorio());
    setFeedback('Configuração salva.');
  };

  const handleAplicar = (preset) => {
    const app = aplicarPresetRelatorio(preset, colIds);
    if (!app) return;
    setColunasVisiveis(app.colunasVisiveis);
    setLarguraUniforme(app.larguraUniforme);
    setCampoUltimoAndamento(app.campoUltimoAndamento);
    setFiltroProcessoAtivo(app.filtroProcessoAtivo);
    setFeedback(`“${preset.nome}” aplicada.`);
  };

  const handleExcluir = (id, nomePreset) => {
    if (!window.confirm(`Excluir a configuração “${nomePreset}”?`)) return;
    excluirPresetRelatorio(id);
    setLista(carregarPresetsRelatorio());
    setFeedback('Configuração removida.');
  };

  const handlePadrao = () => {
    const d = configRelatorioPadrao(colIds);
    setColunasVisiveis(d.colunasVisiveis);
    setLarguraUniforme(d.larguraUniforme);
    setCampoUltimoAndamento(d.campoUltimoAndamento);
    setFiltroProcessoAtivo(d.filtroProcessoAtivo);
    setModoAlteracao(d.modoAlteracao);
    setFeedback('Configuração padrão restaurada.');
  };

  function formatarData(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-700 bg-white text-amber-900 text-sm font-medium hover:bg-amber-50 shadow-sm"
        title="Colunas, edição, filtros e presets do relatório"
        aria-expanded={aberto}
      >
        <Bookmark className="w-4 h-4 shrink-0" aria-hidden />
        Configurações salvas
      </button>
      {aberto ? (
        <div className="absolute right-0 top-full mt-1 z-30 w-[min(100vw-2rem,24rem)] rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-sm">
          <p className="text-xs text-slate-600 mb-2">
            Guarde <strong>colunas visíveis</strong>, <strong>largura uniforme</strong>,{' '}
            <strong>conteúdo da coluna dinâmica</strong>, <strong>filtro ativo/inativo</strong> e{' '}
            <strong>modo de alteração</strong>. Aplique quando precisar, sem refazer tudo manualmente.
          </p>

          <label className="flex items-start gap-2 mb-3 cursor-pointer rounded border border-red-200 bg-red-50/80 px-2 py-2">
            <input
              type="checkbox"
              checked={!!modoAlteracao}
              onChange={(e) => setModoAlteracao(e.target.checked)}
              className="mt-0.5 rounded border-red-300 text-red-700 focus:ring-red-500"
            />
            <span className="text-xs text-slate-800">
              <strong className="text-red-700">Modo de alteração</strong>
              <span className="block text-[10px] text-slate-600 mt-0.5">
                Permite editar os dados das células diretamente na grade (texto em vermelho). Cod. Cliente e Proc. permanecem
                fixos.
              </span>
            </span>
          </label>

          <fieldset className="mb-3 rounded border border-slate-200 bg-slate-50/80 px-2 py-2">
            <legend className="text-[11px] font-medium text-slate-700 px-1">Processos na lista</legend>
            <p className="text-[10px] text-slate-500 mb-1.5">
              Conforme o status no cadastro de Processos (ativo / inativo).
            </p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800">
                <input
                  type="radio"
                  name="filtro-processo-ativo"
                  checked={normalizarFiltroProcessoAtivo(filtroProcessoAtivo) === 'todos'}
                  onChange={() => setFiltroProcessoAtivo('todos')}
                  className="border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Ativos e inativos
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800">
                <input
                  type="radio"
                  name="filtro-processo-ativo"
                  checked={normalizarFiltroProcessoAtivo(filtroProcessoAtivo) === 'ativos'}
                  onChange={() => setFiltroProcessoAtivo('ativos')}
                  className="border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Somente ativos
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800">
                <input
                  type="radio"
                  name="filtro-processo-ativo"
                  checked={normalizarFiltroProcessoAtivo(filtroProcessoAtivo) === 'inativos'}
                  onChange={() => setFiltroProcessoAtivo('inativos')}
                  className="border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Somente inativos
              </label>
            </div>
          </fieldset>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
              placeholder="Nome da configuração…"
              className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded text-slate-800 text-xs"
              maxLength={100}
            />
            <button
              type="button"
              onClick={handleSalvar}
              className="shrink-0 px-2 py-1.5 rounded border border-amber-600 bg-amber-50 text-amber-900 text-xs font-medium hover:bg-amber-100"
            >
              Salvar atual
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePadrao}
              className="px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs text-slate-700 hover:bg-slate-100"
              title="Todas as colunas visíveis, sem largura uniforme, coluna dinâmica em Último Andamento"
            >
              Restaurar padrão
            </button>
          </div>

          {feedback ? <p className="text-xs text-teal-800 mb-2">{feedback}</p> : null}

          <p className="text-xs font-medium text-slate-700 mb-1.5">Suas configurações</p>
          {lista.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Nenhuma configuração salva ainda.</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
              {lista.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-2 rounded border border-slate-100 bg-slate-50/80 px-2 py-1.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate" title={p.nome}>
                      {p.nome}
                    </div>
                    <div className="text-[10px] text-slate-500">{formatarData(p.criadoEm || p.atualizadoEm)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAplicar(p)}
                    className="shrink-0 px-2 py-0.5 rounded bg-teal-600 text-white text-xs hover:bg-teal-700"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluir(p.id, p.nome)}
                    className="shrink-0 p-1 rounded text-slate-500 hover:bg-red-50 hover:text-red-700"
                    title="Excluir"
                    aria-label={`Excluir ${p.nome}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
