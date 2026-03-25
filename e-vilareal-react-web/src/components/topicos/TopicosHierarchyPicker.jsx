import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, FolderOpen, ListChecks } from 'lucide-react';
import { TOPICOS_RAIZ, resolverNoPorCaminho } from '../../data/topicosHierarchy.js';
import { gerarEBaixarDocxLocacao } from '../../utils/gerarDocumentoTopicosLocacaoWord.js';

/** Rótulos do caminho para breadcrumb (um rótulo por id em `pathStack`). */
function rotulosDoCaminho(pathStack) {
  const out = [];
  let node = TOPICOS_RAIZ;
  for (const id of pathStack) {
    const next = node.children?.find((c) => c.id === id);
    if (!next) break;
    out.push(next.label);
    node = next;
  }
  return out;
}

/**
 * Seletor hierárquico de tópicos: camadas clicáveis + folha com checkboxes e rolagem.
 */
export function TopicosHierarchyPicker({ onCarregar }) {
  const [pathStack, setPathStack] = useState([]);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [ultimaCarga, setUltimaCarga] = useState(null);

  const noAtual = useMemo(() => {
    if (pathStack.length === 0) return null;
    return resolverNoPorCaminho(TOPICOS_RAIZ, pathStack);
  }, [pathStack]);

  const modoItens = Boolean(noAtual?.items?.length);
  const selecaoUnicaFolha = Boolean(noAtual?.selecaoUnica);
  const filhosLista = useMemo(() => {
    if (pathStack.length === 0) return TOPICOS_RAIZ.children ?? [];
    const n = resolverNoPorCaminho(TOPICOS_RAIZ, pathStack);
    return n?.children ?? [];
  }, [pathStack]);

  const irParaIndice = useCallback((idx) => {
    if (idx < 0) setPathStack([]);
    else setPathStack((prev) => prev.slice(0, idx + 1));
    setSelecionados(new Set());
  }, []);

  /** Volta exatamente um nível (equivalente a remover o último segmento do caminho). */
  const retrocederUm = useCallback(() => {
    setPathStack((prev) => (prev.length <= 1 ? [] : prev.slice(0, -1)));
    setSelecionados(new Set());
  }, []);

  const aoClicarFilho = useCallback((child) => {
    setPathStack((prev) => [...prev, child.id]);
    setSelecionados(new Set());
  }, []);

  const toggleItem = useCallback((id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const definirSelecaoUnica = useCallback((id) => {
    setSelecionados(new Set([id]));
  }, []);

  const aoCarregar = useCallback(() => {
    if (!noAtual?.items?.length) return;
    const marcados = noAtual.items.filter((it) => selecionados.has(it.id));
    const payload = {
      pathLabels: rotulosDoCaminho(pathStack),
      items: marcados,
    };
    setUltimaCarga(payload);
    onCarregar?.(payload);

    const ehCaminhoLocacao =
      pathStack.length >= 2 &&
      pathStack[0] === 'contratos' &&
      pathStack[pathStack.length - 1] === 'contratos-loc';
    if (ehCaminhoLocacao && marcados.length > 0) {
      void gerarEBaixarDocxLocacao(payload).catch((err) => {
        console.error(err);
        window.alert('Não foi possível gerar o documento Word. Tente novamente.');
      });
    }
  }, [noAtual, pathStack, selecionados, onCarregar]);

  const rotulos = rotulosDoCaminho(pathStack);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm overflow-hidden max-w-3xl">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tópicos</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Navegue pelas camadas; na última, marque os tópicos e use Carregar. Em{' '}
              <span className="font-medium text-slate-600 dark:text-slate-300">Contratos → Locação</span>, Carregar
              também baixa um <span className="font-medium">.docx</span> novo para abrir no Word.
            </p>
          </div>
          <button
            type="button"
            onClick={retrocederUm}
            disabled={pathStack.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:pointer-events-none shrink-0"
            aria-label="Retroceder um nível"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Retroceder
          </button>
        </div>
      </div>

      {/* Trilha (camadas) — clique para voltar àquele nível */}
      <nav
        className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 space-y-1.5"
        aria-label="Caminho nos tópicos"
      >
        <button
          type="button"
          onClick={() => irParaIndice(-1)}
          className={`block w-full text-left text-xs font-semibold uppercase tracking-wide rounded px-2 py-1 transition-colors ${
            pathStack.length === 0
              ? 'text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-cyan-950/40'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
          }`}
        >
          Início
        </button>
        {rotulos.map((label, i) => (
          <button
            key={`${pathStack[i]}-${i}`}
            type="button"
            onClick={() => irParaIndice(i)}
            className={`block w-full text-left text-xs font-semibold uppercase tracking-wide rounded px-2 py-1 transition-colors ${
              i === rotulos.length - 1
                ? 'text-blue-800 dark:text-cyan-200 bg-blue-50/90 dark:bg-cyan-950/35'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Lista de categorias (próximo nível) ou caixa “Página 01” com scroll */}
      <div className="p-4">
        {modoItens ? (
          <div className="border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-600">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <ListChecks className="w-4 h-4 shrink-0 opacity-70" aria-hidden />
                Página 01
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Rolagem se houver mais linhas</span>
            </div>
            <div
              className="max-h-52 overflow-y-auto pr-1 scroll-smooth"
              style={{ scrollbarGutter: 'stable' }}
            >
              <ul className="py-1 divide-y divide-slate-100 dark:divide-slate-700/80">
                {noAtual.items.map((it) => (
                  <li key={it.id}>
                    <label className="flex items-center justify-between gap-4 px-3 py-2.5 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80">
                      <span className="text-sm text-slate-800 dark:text-slate-100 min-w-0 flex-1 pr-2">{it.label}</span>
                      <span className="shrink-0 flex items-center justify-end w-9" title="Selecionar">
                        {selecaoUnicaFolha ? (
                          <input
                            type="radio"
                            name={`topicos-folha-${noAtual.id}`}
                            checked={selecionados.has(it.id)}
                            onChange={() => definirSelecaoUnica(it.id)}
                            className="h-4 w-4 border-slate-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={selecionados.has(it.id)}
                            onChange={() => toggleItem(it.id)}
                            className="rounded border-slate-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 shrink-0 opacity-70" aria-hidden />
                {pathStack.length === 0 ? 'Categorias principais' : 'Subcategorias'}
              </span>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filhosLista.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 px-3 py-6 text-center">Nenhum item neste nível.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/80">
                  {filhosLista.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        onClick={() => aoClicarFilho(child)}
                        className="w-full text-left px-3 py-2.5 text-sm font-medium uppercase tracking-wide text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={aoCarregar}
          disabled={!modoItens}
          className="inline-flex justify-center items-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:pointer-events-none text-white text-sm font-medium px-5 py-2.5 shadow-sm"
        >
          Carregar
        </button>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <ChevronUp className="w-3.5 h-3.5" aria-hidden />
          <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          Listas com altura máxima fixa — use a rolagem interna.
        </p>
      </div>

      {ultimaCarga ? (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-600 pt-3 mt-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Última carga</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Caminho: {ultimaCarga.pathLabels.join(' → ') || '(início)'}
          </p>
          {ultimaCarga.items.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">Nenhum tópico marcado.</p>
          ) : (
            <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc list-inside space-y-0.5">
              {ultimaCarga.items.map((it) => (
                <li key={it.id}>{it.label}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
