import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  buscarTopicos,
  fetchCategorias,
  fetchTopicosPorCategoria,
  processarMultiplos,
  processarTopico,
} from '../../../repositories/topicosRepository.js';
import {
  downloadPdfBlob,
  gerarPdfComIA,
  gerarPdfManual,
  nomeArquivoPeticaoPdf,
} from '../../../repositories/documentosRepository.js';
import { btnPrimary, btnSecondary, inputClass } from '../documentosStyles.js';
import {
  ConfigModeloDocumento,
} from './ConfigModeloDocumento.jsx';
import { estadoInicialConfigModelo, pad8 } from './configModeloDocumentoState.js';
import { resolveEnderecamento } from './DadosProcesso.jsx';

function previewCurto(texto, max = 50) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textoParaHtml(texto) {
  const blocos = String(texto ?? '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (!blocos.length) return '<p></p>';
  return blocos.map((b) => `<p>${escapeHtml(b.replace(/\n/g, ' '))}</p>`).join('');
}

function destacarPlaceholders(texto, naoResolvidos = []) {
  let out = escapeHtml(texto ?? '');
  for (const ph of naoResolvidos) {
    const esc = escapeHtml(ph);
    out = out.split(esc).join(
      `<mark class="bg-yellow-500/20 text-yellow-300 rounded px-0.5">${esc}</mark>`,
    );
  }
  return out.replace(/\n/g, '<br/>');
}

function estimarPaginas(totalChars) {
  return Math.max(1, Math.ceil(totalChars / 2800));
}

function montarParametros(config) {
  const params = {};
  if (config.valorCausa?.trim()) params.valorCausa = config.valorCausa.trim();
  if (config.dataDocumento?.trim()) params.data = config.dataDocumento.trim();
  return params;
}

function validarConfig(config) {
  const errors = {};
  if (!config.codigoCliente?.trim()) errors.codigoCliente = 'Selecione o cliente.';
  if (config.numeroInterno === '' || config.numeroInterno == null) {
    errors.numeroInterno = 'Selecione o processo.';
  }
  if (!resolveEnderecamento(config)) errors.enderecamento = 'Informe o endereçamento.';
  return errors;
}

function montarDocumentoRequest(config, itensProcessados) {
  const secoes = itensProcessados.map((item) => ({
    titulo: item.nome || 'Seção',
    conteudo: textoParaHtml(item.textoProcessado),
  }));
  return {
    enderecamento: resolveEnderecamento(config),
    numeroProcesso: config.numeroProcesso?.trim() || null,
    preambulo: secoes[0]?.conteudo || '<p></p>',
    secoes: secoes.length > 1 ? secoes.slice(1) : [],
    pedidos: [],
    cidadeEstado: config.cidadeEstado?.trim() || 'Anápolis, estado de Goiás',
    data: config.dataDocumento || new Date().toISOString().split('T')[0],
  };
}

function montarPeticaoIA(config, itensProcessados, processoApi, selecionados) {
  const modeloBase = itensProcessados.map((i) => i.textoProcessado).join('\n\n');
  return {
    enderecamento: resolveEnderecamento(config),
    numeroProcesso: config.numeroProcesso?.trim() || null,
    tipoPeca: selecionados[0]?.categoria || 'Petição',
    nomeAutor: processoApi?.parteCliente || 'AUTOR',
    qualificacaoAutor: null,
    nomeReu: processoApi?.parteOposta || 'RÉU',
    qualificacaoReu: null,
    fatos: 'Refinar e adaptar o documento montado a partir dos modelos selecionados, mantendo a estrutura jurídica.',
    fundamentacaoAdicional: null,
    valorCausa: config.valorCausa?.trim() || null,
    pedidosEspecificos: null,
    modeloBase,
    instrucoesAdicionais: 'Preserve a ordem e a estrutura dos tópicos do modelo base.',
    cidadeEstado: config.cidadeEstado?.trim() || 'Anápolis, estado de Goiás',
    data: config.dataDocumento || new Date().toISOString().split('T')[0],
    codigoCliente: pad8(config.codigoCliente),
    numeroInterno: Number(config.numeroInterno),
  };
}

function TopicoCardSelecionado({
  item,
  index,
  expandido,
  preview,
  carregandoPreview,
  onTogglePreview,
  onRemover,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="rounded-lg border border-slate-600/60 bg-slate-800/50 p-3 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 cursor-grab text-slate-500 active:cursor-grabbing" title="Arrastar">
          <GripVertical className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{item.nome}</p>
              <p className="text-xs text-slate-400">
                {item.tipoFormatacao || '—'}
                {item.subcategoria ? ` · ${item.subcategoria}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">{previewCurto(item.conteudoPreview || item.nome)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-cyan-300"
                title={expandido ? 'Ocultar preview' : 'Ver preview processado'}
                onClick={() => onTogglePreview(item.id)}
              >
                {expandido ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-300"
                title="Remover"
                onClick={() => onRemover(index)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {expandido ? (
            <div className="mt-3 rounded border border-slate-600/50 bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-200">
              {carregandoPreview ? (
                <span className="inline-flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando…
                </span>
              ) : preview ? (
                <div
                  className="whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{
                    __html: destacarPlaceholders(preview.textoProcessado, preview.placeholdersNaoResolvidos),
                  }}
                />
              ) : (
                <span className="text-slate-500">Selecione cliente e processo para ver o preview.</span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-700/80 bg-slate-900/40 p-4 ${className}`}>
      <h2 className="mb-3 text-sm font-semibold text-slate-200">{title}</h2>
      {children}
    </section>
  );
}

export function ModoModeloTopicos({ onErro, onLoadingChange }) {
  const [config, setConfig] = useState(estadoInicialConfigModelo);
  const [processoApi, setProcessoApi] = useState(null);
  const [errors, setErrors] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [topicos, setTopicos] = useState([]);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [expandidoId, setExpandidoId] = useState(null);
  const [previews, setPreviews] = useState({});
  const [loadingPreviewId, setLoadingPreviewId] = useState(null);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  const patchConfig = useCallback((patch) => {
    setConfig((c) => ({ ...c, ...patch }));
    setErrors({});
  }, []);

  useEffect(() => {
    fetchCategorias()
      .then((cats) => setCategorias(cats))
      .catch((e) => onErro?.(e?.message || 'Falha ao carregar categorias.'));
  }, [onErro]);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancel = false;
    setCarregandoLista(true);
    const carregar = buscaDebounced
      ? buscarTopicos(buscaDebounced)
      : categoria
        ? fetchTopicosPorCategoria(categoria)
        : Promise.resolve([]);

    carregar
      .then((lista) => {
        if (!cancel) setTopicos(Array.isArray(lista) ? lista : []);
      })
      .catch((e) => {
        if (!cancel) {
          setTopicos([]);
          onErro?.(e?.message || 'Falha ao carregar tópicos.');
        }
      })
      .finally(() => {
        if (!cancel) setCarregandoLista(false);
      });

    return () => {
      cancel = true;
    };
  }, [categoria, buscaDebounced, onErro]);

  useEffect(() => {
    onLoadingChange?.(loadingAcao || Boolean(loadingPreviewId));
  }, [loadingAcao, loadingPreviewId, onLoadingChange]);

  const processoId = processoApi?.id ?? null;
  const parametros = useMemo(() => montarParametros(config), [config]);

  const adicionarTopico = (topico) => {
    if (selecionados.some((s) => s.id === topico.id)) return;
    setSelecionados((prev) => [
      ...prev,
      { ...topico, conteudoPreview: topico.nome },
    ]);
  };

  const removerTopico = (index) => {
    setSelecionados((prev) => prev.filter((_, i) => i !== index));
  };

  const reordenar = (from, to) => {
    if (from === to || from == null || to == null) return;
    setSelecionados((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const carregarPreview = async (topicoId) => {
    if (!processoId) return;
    setLoadingPreviewId(topicoId);
    try {
      const resp = await processarTopico(topicoId, processoId, parametros);
      setPreviews((p) => ({ ...p, [topicoId]: resp }));
    } catch (e) {
      onErro?.(e?.message || 'Falha ao processar tópico.');
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const togglePreview = (topicoId) => {
    if (expandidoId === topicoId) {
      setExpandidoId(null);
      return;
    }
    setExpandidoId(topicoId);
    if (!previews[topicoId] && processoId) {
      void carregarPreview(topicoId);
    }
  };

  const processarSelecionados = async () => {
    const ids = selecionados.map((s) => s.id);
    const resp = await processarMultiplos(ids, processoId, parametros);
    return resp?.itens ?? [];
  };

  const handleGerarPdf = async () => {
    onErro?.('');
    const errs = validarConfig(config);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    if (!selecionados.length) {
      onErro?.('Adicione ao menos um tópico ao documento.');
      return;
    }
    if (!processoId) {
      onErro?.('Aguarde o carregamento do processo ou selecione novamente.');
      return;
    }
    setLoadingAcao(true);
    try {
      const itens = await processarSelecionados();
      const payload = montarDocumentoRequest(config, itens);
      const blob = await gerarPdfManual(payload);
      downloadPdfBlob(blob, nomeArquivoPeticaoPdf());
    } catch (e) {
      onErro?.(e?.message || 'Falha ao gerar PDF.');
    } finally {
      setLoadingAcao(false);
    }
  };

  const handleRefinarIA = async () => {
    onErro?.('');
    const errs = validarConfig(config);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    if (!selecionados.length) {
      onErro?.('Adicione ao menos um tópico ao documento.');
      return;
    }
    if (!processoId) {
      onErro?.('Aguarde o carregamento do processo ou selecione novamente.');
      return;
    }
    setLoadingAcao(true);
    try {
      const itens = await processarSelecionados();
      const payload = montarPeticaoIA(config, itens, processoApi, selecionados);
      const blob = await gerarPdfComIA(payload);
      downloadPdfBlob(blob, nomeArquivoPeticaoPdf());
    } catch (e) {
      onErro?.(e?.message || 'Falha ao refinar com IA.');
    } finally {
      setLoadingAcao(false);
    }
  };

  const handleCopiar = async () => {
    onErro?.('');
    if (!selecionados.length) {
      onErro?.('Adicione ao menos um tópico.');
      return;
    }
    if (!processoId) {
      onErro?.('Selecione cliente e processo.');
      return;
    }
    setLoadingAcao(true);
    try {
      const itens = await processarSelecionados();
      const texto = itens.map((i) => i.textoProcessado).join('\n\n');
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      onErro?.(e?.message || 'Falha ao copiar texto.');
    } finally {
      setLoadingAcao(false);
    }
  };

  const totalChars = selecionados.reduce((acc, s) => acc + String(s.nome ?? '').length + 200, 0);
  const paginasEstimadas = estimarPaginas(totalChars);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Biblioteca de tópicos" className="xl:col-span-1">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-400">
              Categoria
              <select
                className={`${inputClass} mt-1`}
                value={categoria}
                onChange={(e) => {
                  setCategoria(e.target.value);
                  setBusca('');
                }}
              >
                <option value="">Todas / buscar</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-400">
              Busca
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  className={`${inputClass} pl-9`}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, categoria…"
                />
              </div>
            </label>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-700/60">
              {carregandoLista ? (
                <p className="inline-flex items-center gap-2 p-4 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </p>
              ) : topicos.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">
                  {buscaDebounced || categoria ? 'Nenhum tópico encontrado.' : 'Selecione uma categoria ou busque.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-700/60">
                  {topicos.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-800/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-100">{t.nome}</p>
                        {t.subcategoria ? (
                          <p className="truncate text-xs text-slate-500">{t.subcategoria}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-slate-600 p-1.5 text-cyan-400 hover:bg-slate-700"
                        title="Adicionar"
                        onClick={() => adicionarTopico(t)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Montagem do documento" className="xl:col-span-1">
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>{selecionados.length} tópico(s)</span>
            <span>~{paginasEstimadas} página(s) est.</span>
          </div>
          {selecionados.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum tópico selecionado. Use o botão + na biblioteca.</p>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {selecionados.map((item, index) => (
                <TopicoCardSelecionado
                  key={`${item.id}-${index}`}
                  item={item}
                  index={index}
                  expandido={expandidoId === item.id}
                  preview={previews[item.id]}
                  carregandoPreview={loadingPreviewId === item.id}
                  onTogglePreview={togglePreview}
                  onRemover={removerTopico}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    reordenar(dragIndex, index);
                    setDragIndex(null);
                  }}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Configuração" className="xl:col-span-1">
          <ConfigModeloDocumento
            values={config}
            onChange={patchConfig}
            errors={errors}
            onProcessoCarregado={setProcessoApi}
          />
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-700/60 pt-4">
            <button type="button" className={btnPrimary} disabled={loadingAcao} onClick={() => void handleGerarPdf()}>
              {loadingAcao ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Gerar PDF
            </button>
            <button type="button" className={btnSecondary} disabled={loadingAcao} onClick={() => void handleRefinarIA()}>
              <Sparkles className="h-4 w-4" />
              Refinar com IA
            </button>
            <button type="button" className={btnSecondary} disabled={loadingAcao} onClick={() => void handleCopiar()}>
              <Copy className="h-4 w-4" />
              Copiar texto
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
