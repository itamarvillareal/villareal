import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Newspaper,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Search,
  Loader2,
  Link2,
  RotateCcw,
  X,
  CalendarDays,
  ListTodo,
  Trash2,
} from 'lucide-react';
import { extrairTextoPdfDeArquivo } from '../data/publicacoesPdfExtract.js';
import { executarPipelineImportacaoPublicacoes } from '../data/publicacoesPipeline.js';
import { hashArquivoSHA256 } from '../data/publicacoesHashArquivo.js';
import { normalizarCnjParaChave } from '../data/publicacoesPdfParser.js';
import {
  montarIndiceCnjClienteProc,
  aplicarVinculoManual,
  reaplicarVinculoCadastro,
} from '../data/publicacoesVinculoProcessos.js';
import { appendPublicacoesConfirmadas, updatePublicacaoImportada } from '../data/publicacoesStorage.js';
import { agruparPublicacoesPorDia } from '../data/publicacoesDiaria.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  alterarStatusPublicacao,
  importarPublicacoesDaPrevia,
  limparTodasPublicacoes,
  listarPublicacoesModulo,
  vincularPublicacaoProcessoPorChaveNatural,
} from '../repositories/publicacoesRepository.js';
import {
  executarMigracaoAssistidaPhase6Publicacoes,
  getStatusMigracaoAssistidaPhase6Publicacoes,
  previsualizarMigracaoAssistidaPhase6Publicacoes,
} from '../services/publicacoesMigrationPhase6.js';
import { ModalCriarTarefaContextual } from './ModalCriarTarefaContextual.jsx';
import { buildContextFromPublicacaoRow } from '../data/tarefasContextualPayload.js';

function Badge({ children, tone = 'slate' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    green: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
    red: 'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200',
  }[tone];
  return <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function rotuloStatusCnj(s) {
  const m = {
    processo_confirmado_cnj: 'Confirmado CNJ',
    processo_nao_confirmado_cnj: 'Não confirmado',
    divergencia_pdf_cnj: 'Divergência PDF×CNJ',
    consulta_indisponivel: 'Consulta indisponível',
    nao_consultado: 'Não consultado',
    tribunal_nao_mapeado: 'Tribunal não mapeado',
  };
  return m[s] || s || '—';
}

function ScoreBadge({ score }) {
  if (!score) return <Badge tone="slate">—</Badge>;
  const tone = score === 'alto' ? 'green' : score === 'medio' ? 'amber' : 'red';
  const lab = score === 'alto' ? 'Alto' : score === 'medio' ? 'Médio' : 'Baixo';
  return <Badge tone={tone}>{lab}</Badge>;
}

/** Converte registro gravado para o formato usado por vínculo/score. */
function rowGravadoParaVinculo(r) {
  return {
    ...r,
    statusTeor: r.statusTeor ?? r.statusPublicacao,
    processoCnjNormalizado: r.processoCnjNormalizado || r.numero_processo_cnj,
    numeroCnj: r.numero_processo_cnj || r.numeroCnj,
    divergenciasPdfCnj: Array.isArray(r.divergenciasPdfCnj) ? r.divergenciasPdfCnj : [],
  };
}

export function PublicacoesProcessos() {
  const navigate = useNavigate();
  const [arquivoNome, setArquivoNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [preview, setPreview] = useState(null);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [logImportacao, setLogImportacao] = useState(null);
  const [filtroVinculo, setFiltroVinculo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroStatusTratamento, setFiltroStatusTratamento] = useState('');
  const [filtroProcessoId, setFiltroProcessoId] = useState('');
  const [filtroClienteId, setFiltroClienteId] = useState('');
  const [filtroOrigemImportacao, setFiltroOrigemImportacao] = useState('');
  const [consultarDatajud, setConsultarDatajud] = useState(true);
  const [gravadosTick, setGravadosTick] = useState(0);
  const [itensGravados, setItensGravados] = useState([]);
  const [carregandoGravados, setCarregandoGravados] = useState(false);
  const [erroGravados, setErroGravados] = useState('');
  const [importLegadoPreview, setImportLegadoPreview] = useState(null);
  const [importLegadoLoadingPreview, setImportLegadoLoadingPreview] = useState(false);
  const [importLegadoExecutando, setImportLegadoExecutando] = useState(false);
  const [importLegadoResumo, setImportLegadoResumo] = useState(null);
  const [importLegadoStatus, setImportLegadoStatus] = useState(() => getStatusMigracaoAssistidaPhase6Publicacoes());
  const [vinculoModal, setVinculoModal] = useState(null);
  const [vincForm, setVincForm] = useState({ codCliente: '', procInterno: '', cliente: '' });
  const [vinculoFormErro, setVinculoFormErro] = useState('');
  /** Critério do consolidado diário: dia da publicação oficial ou da disponibilização no diário. */
  const [consolidadoCriterio, setConsolidadoCriterio] = useState('publicacao');
  const [modalTarefaContextual, setModalTarefaContextual] = useState(null);
  const [limpandoPublicacoes, setLimpandoPublicacoes] = useState(false);

  const indiceCnj = useMemo(() => montarIndiceCnjClienteProc(), []);

  function abrirModalTarefaPublicacao(r) {
    if (!featureFlags.useApiTarefas) return;
    const ctx = buildContextFromPublicacaoRow(r);
    if (!featureFlags.useApiPublicacoes) {
      ctx.aviso =
        'Publicações via API desativadas — a tarefa será criada só com texto pré-preenchido (sem vínculos de publicação/processo na API).';
      ctx.publicacaoId = null;
      ctx.processoId = null;
      ctx.clienteId = null;
      ctx.apenasTextoContextual = true;
    }
    setModalTarefaContextual(ctx);
  }

  useEffect(() => {
    let ativo = true;
    setCarregandoGravados(true);
    setErroGravados('');
    void listarPublicacoesModulo({
      dataInicio: filtroDataInicio || undefined,
      dataFim: filtroDataFim || undefined,
      statusTratamento: filtroStatusTratamento || undefined,
      processoId: filtroProcessoId || undefined,
      clienteId: filtroClienteId || undefined,
      texto: busca || undefined,
      origemImportacao: filtroOrigemImportacao || undefined,
      filtroVinculo,
    })
      .then((rows) => {
        if (!ativo) return;
        setItensGravados(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        if (!ativo) return;
        setErroGravados(e?.message || 'Falha ao carregar publicações.');
      })
      .finally(() => {
        if (ativo) setCarregandoGravados(false);
      });
    return () => {
      ativo = false;
    };
  }, [
    filtroDataInicio,
    filtroDataFim,
    filtroStatusTratamento,
    filtroProcessoId,
    filtroClienteId,
    filtroOrigemImportacao,
    busca,
    filtroVinculo,
    gravadosTick,
  ]);

  const processarArquivo = useCallback(
    async (file) => {
      if (!file || file.type !== 'application/pdf') {
        setErro('Selecione um arquivo PDF.');
        return;
      }
      setErro('');
      setCarregando(true);
      setPreview(null);
      setLogImportacao(null);
      setSelecionados(new Set());
      try {
        const texto = await extrairTextoPdfDeArquivo(file);
        const hashArquivo = await hashArquivoSHA256(file);
        const { parseados, metricas, limpo, logsItens } = await executarPipelineImportacaoPublicacoes(
          texto,
          indiceCnj,
          { skipDatajud: !consultarDatajud }
        );
        setArquivoNome(file.name);
        setPreview({
          nomeArquivo: file.name,
          hashArquivo,
          textoLimpoSample: limpo.slice(0, 1200),
          metricas,
          itens: parseados,
          logsItens,
        });
        setSelecionados(new Set(parseados.map((_, i) => i)));
      } catch (e) {
        console.error(e);
        setErro(e?.message || 'Falha ao ler o PDF. Verifique se o arquivo tem texto selecionável.');
      } finally {
        setCarregando(false);
      }
    },
    [indiceCnj, consultarDatajud]
  );

  const toggleSel = (i) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  const confirmarImportacao = async () => {
    if (!preview?.itens?.length) return;
    const escolhidos = preview.itens.filter((_, i) => selecionados.has(i));
    const r = featureFlags.useApiPublicacoes
      ? await importarPublicacoesDaPrevia(escolhidos, arquivoNome, {
          hashArquivo: preview.hashArquivo ?? '',
          importacaoConfirmadaEm: new Date().toISOString(),
        })
      : appendPublicacoesConfirmadas(escolhidos, arquivoNome, {
          hashArquivo: preview.hashArquivo ?? '',
          importacaoConfirmadaEm: new Date().toISOString(),
        });
    setLogImportacao({
      ...r,
      totalSelecionados: escolhidos.length,
      quando: new Date().toISOString(),
    });
    setPreview(null);
    setArquivoNome('');
    setSelecionados(new Set());
    setGravadosTick((t) => t + 1);
  };

  const confirmarVinculoModal = () => {
    const { codCliente, procInterno, cliente } = vincForm;
    if (vinculoModal?.kind === 'preview') {
      if (!preview) return;
      const row = preview.itens[vinculoModal.index];
      const next = aplicarVinculoManual(row, { codCliente, procInterno, cliente });
      if (next.erroVinculo) {
        setVinculoFormErro(next.erroVinculo);
        return;
      }
      const itens = [...preview.itens];
      itens[vinculoModal.index] = next;
      setPreview({ ...preview, itens });
      setVinculoModal(null);
      setVinculoFormErro('');
      return;
    }
    if (vinculoModal?.kind === 'saved') {
      const row = itensGravados.find((x) => x.id === vinculoModal.id);
      if (!row) return;
      if (featureFlags.useApiPublicacoes) {
        void (async () => {
          const vinculado = await vincularPublicacaoProcessoPorChaveNatural(
            row._apiId ?? row.id,
            codCliente,
            procInterno,
            'Vínculo manual via tela de publicações.'
          );
          if (!vinculado) {
            setVinculoFormErro('Não foi possível resolver processo por código/proc interno.');
            return;
          }
          setGravadosTick((t) => t + 1);
          setVinculoModal(null);
          setVinculoFormErro('');
        })().catch((e) => {
          setVinculoFormErro(e?.message || 'Falha ao vincular publicação na API.');
        });
        return;
      }
      const next = aplicarVinculoManual(rowGravadoParaVinculo(row), { codCliente, procInterno, cliente });
      if (next.erroVinculo) {
        setVinculoFormErro(next.erroVinculo);
        return;
      }
      updatePublicacaoImportada(row.id, {
        codCliente: next.codCliente,
        procInterno: next.procInterno,
        cliente: next.cliente,
        statusVinculo: next.statusVinculo,
        scoreConfianca: next.scoreConfianca,
        vinculoOrigem: next.vinculoOrigem ?? 'manual',
      });
      setGravadosTick((t) => t + 1);
      setVinculoModal(null);
      setVinculoFormErro('');
    }
  };

  const reaplicarVinculoPreview = (index) => {
    setPreview((p) => {
      if (!p) return p;
      const itens = [...p.itens];
      itens[index] = reaplicarVinculoCadastro(itens[index], indiceCnj);
      return { ...p, itens };
    });
  };

  const reaplicarVinculoGravado = (row) => {
    if (featureFlags.useApiPublicacoes) {
      const key = normalizarCnjParaChave(row.processoCnjNormalizado || row.numero_processo_cnj || '');
      const hit = indiceCnj.get(key);
      if (!hit) {
        setErro('Não há correspondência automática no cadastro para este CNJ.');
        return;
      }
      void vincularPublicacaoProcessoPorChaveNatural(
        row._apiId ?? row.id,
        hit.codCliente,
        hit.proc,
        'Vínculo automático reaplicado pelo índice CNJ.'
      )
        .then((v) => {
          if (!v) {
            setErro('Não foi possível vincular automaticamente na API.');
            return;
          }
          setGravadosTick((t) => t + 1);
        })
        .catch((e) => setErro(e?.message || 'Falha ao reaplicar vínculo automático.'));
      return;
    }
    const next = reaplicarVinculoCadastro(rowGravadoParaVinculo(row), indiceCnj);
    updatePublicacaoImportada(row.id, {
      codCliente: next.codCliente,
      procInterno: next.procInterno,
      cliente: next.cliente,
      statusVinculo: next.statusVinculo,
      scoreConfianca: next.scoreConfianca,
      vinculoOrigem: next.vinculoOrigem ?? '',
    });
    setGravadosTick((t) => t + 1);
  };

  const alterarStatusGravado = (row, status) => {
    void alterarStatusPublicacao(row._apiId ?? row.id, status, 'Atualização operacional na tela de publicações.')
      .then(() => {
        setLogImportacao({
          gravados: 0,
          ignoradosDuplicata: 0,
          totalSelecionados: 0,
          quando: new Date().toISOString(),
          mensagem: `Status atualizado para ${status}.`,
        });
        setGravadosTick((t) => t + 1);
      })
      .catch((e) => {
        setErro(e?.message || 'Falha ao atualizar status da publicação.');
      });
  };

  const filtrados = useMemo(() => itensGravados, [itensGravados]);

  const consolidadoGravados = useMemo(
    () => agruparPublicacoesPorDia(filtrados, consolidadoCriterio),
    [filtrados, consolidadoCriterio]
  );

  const consolidadoPreview = useMemo(
    () => (preview?.itens?.length ? agruparPublicacoesPorDia(preview.itens, consolidadoCriterio) : []),
    [preview, consolidadoCriterio]
  );

  const abrirPreviaImportacaoLegado = () => {
    setImportLegadoLoadingPreview(true);
    setErro('');
    try {
      const p = previsualizarMigracaoAssistidaPhase6Publicacoes();
      setImportLegadoPreview(p);
      setImportLegadoStatus(getStatusMigracaoAssistidaPhase6Publicacoes());
    } catch (e) {
      setErro(e?.message || 'Falha ao montar prévia da importação legada.');
    } finally {
      setImportLegadoLoadingPreview(false);
    }
  };

  const executarImportacaoLegadoViaUi = async () => {
    const statusAtual = getStatusMigracaoAssistidaPhase6Publicacoes();
    setImportLegadoStatus(statusAtual);
    if (!statusAtual.habilitadaPorFlag || !statusAtual.apiPublicacoesAtiva) {
      setErro('Ative VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES=true e VITE_USE_API_PUBLICACOES=true.');
      return;
    }
    if (statusAtual.jaExecutada) {
      setErro('Importação já marcada como executada. Reimportação segura ficará para a próxima etapa.');
      return;
    }

    const ok = window.confirm(
      'Confirma importar o legado de publicações para a API?\n\n' +
        '- A operação tentará gravar registros na API.\n' +
        '- A deduplicação no servidor ocorre por hash_conteudo.\n' +
        '- Parte dos registros pode ser ignorada (duplicados/erros).\n' +
        '- Parte dos registros pode ficar sem vínculo de processo resolvido.\n' +
        '- O marker evita reimportação cega após a execução.'
    );
    if (!ok) return;

    setImportLegadoExecutando(true);
    setErro('');
    try {
      const r = await executarMigracaoAssistidaPhase6Publicacoes();
      setImportLegadoResumo({
        ...r,
        quando: new Date().toISOString(),
      });
      setLogImportacao({
        gravados: Number(r?.gravados || 0),
        ignoradosDuplicata: Number(r?.ignorados || 0),
        totalSelecionados: Number(r?.total || 0),
        semVinculo: Number(r?.semVinculo || 0),
        quando: new Date().toISOString(),
        mensagem: r?.ignorado ? r.motivo : 'Importação assistida do legado de publicações concluída.',
      });
      setImportLegadoStatus(getStatusMigracaoAssistidaPhase6Publicacoes());
      setImportLegadoPreview(previsualizarMigracaoAssistidaPhase6Publicacoes());
      setGravadosTick((t) => t + 1);
    } catch (e) {
      setErro(e?.message || 'Falha ao executar importação assistida do legado.');
    } finally {
      setImportLegadoExecutando(false);
    }
  };

  const executarLimparTodasPublicacoes = async () => {
    const ok = window.confirm(
      'Apagar todas as publicações?\n\n' +
        '- Remove o armazenamento local (vilareal.processos.publicacoes.*).\n' +
        '- Reseta o marcador da migração assistida (fase 6).\n' +
        (featureFlags.useApiPublicacoes
          ? '- Com API ativa, tenta excluir cada registro via DELETE /api/publicacoes/{id}.\n'
          : '- Vínculos publicação→tarefa no MySQL são limpos pela migração V8 ao subir o backend.\n')
    );
    if (!ok) return;
    setLimpandoPublicacoes(true);
    setErro('');
    try {
      const r = await limparTodasPublicacoes();
      setImportLegadoStatus(getStatusMigracaoAssistidaPhase6Publicacoes());
      setImportLegadoPreview(previsualizarMigracaoAssistidaPhase6Publicacoes());
      setGravadosTick((t) => t + 1);
      setLogImportacao({
        gravados: 0,
        ignoradosDuplicata: 0,
        totalSelecionados: 0,
        quando: new Date().toISOString(),
        mensagem: featureFlags.useApiPublicacoes
          ? `Limpeza concluída. Removidos na API: ${r.apiRemovidos}. Armazenamento local limpo.`
          : 'Limpeza do armazenamento local concluída.',
      });
    } catch (e) {
      setErro(e?.message || 'Falha ao limpar publicações.');
    } finally {
      setLimpandoPublicacoes(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-100 dark:bg-[#0c0f14] text-slate-900 dark:text-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/processos')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Processos
          </button>
          <div className="flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Publicações</h1>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importar PDF de publicações (Jusbrasil / e-mail)
          </h2>
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/20 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={abrirPreviaImportacaoLegado}
                disabled={importLegadoLoadingPreview || importLegadoExecutando}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-[#0d1018] text-indigo-900 dark:text-indigo-200 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-50"
              >
                {importLegadoLoadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar legado de publicações
              </button>
              <button
                type="button"
                onClick={() => void executarLimparTodasPublicacoes()}
                disabled={limpandoPublicacoes || importLegadoExecutando}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-300 dark:border-red-500/40 bg-white dark:bg-[#0d1018] text-red-800 dark:text-red-200 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
              >
                {limpandoPublicacoes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Limpar todas as publicações
              </button>
              <span className="text-[11px] text-slate-700 dark:text-slate-300">
                Flag: <strong>{importLegadoStatus.habilitadaPorFlag ? 'ativa' : 'inativa'}</strong> · API:{' '}
                <strong>{importLegadoStatus.apiPublicacoesAtiva ? 'ativa' : 'inativa'}</strong> · Marker:{' '}
                <strong>{importLegadoStatus.jaExecutada ? 'já executada' : 'não executada'}</strong>
              </span>
            </div>
            {importLegadoPreview ? (
              <div className="rounded-lg border border-indigo-200/80 dark:border-indigo-500/25 bg-white/80 dark:bg-black/20 p-3 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <p>Total legado: <strong>{importLegadoPreview.totalLegado}</strong></p>
                  <p>Importável (estimativa): <strong>{importLegadoPreview.importavelEstimado}</strong></p>
                  <p>Duplicados locais (estimativa): <strong>{importLegadoPreview.duplicatasLocaisEstimadas}</strong></p>
                  <p>Sem vínculo (estimativa): <strong>{importLegadoPreview.semVinculoEstimado}</strong></p>
                  <p>Com hash: <strong>{importLegadoPreview.comHashConteudo}</strong></p>
                  <p>Sem hash: <strong>{importLegadoPreview.semHashConteudo}</strong></p>
                </div>
                <p>Chaves lidas: {(importLegadoPreview.storageKeysLidas || []).join(', ') || '—'}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Estimativa: total/importável/duplicado/sem vínculo são prévios locais. Resultado final só é conhecido após executar na API.
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">{importLegadoPreview.observacao}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={executarImportacaoLegadoViaUi}
                    disabled={
                      importLegadoExecutando ||
                      !importLegadoStatus.habilitadaPorFlag ||
                      !importLegadoStatus.apiPublicacoesAtiva ||
                      importLegadoStatus.jaExecutada
                    }
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {importLegadoExecutando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {importLegadoExecutando ? 'Importando legado...' : 'Confirmar e importar legado'}
                  </button>
                </div>
                {importLegadoResumo ? (
                  <div className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/20 px-3 py-2 text-emerald-900 dark:text-emerald-100">
                    {importLegadoResumo.ignorado ? (
                      <p>{importLegadoResumo.motivo}</p>
                    ) : (
                      <p>
                        Resultado: <strong>{importLegadoResumo.gravados}</strong> importado(s), <strong>{importLegadoResumo.ignorados}</strong>{' '}
                        ignorado(s), <strong>{importLegadoResumo.semVinculo}</strong> sem vínculo resolvido, de <strong>{importLegadoResumo.total}</strong>{' '}
                        lido(s).
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            O sistema extrai <strong>texto selecionável</strong> do PDF (sem OCR), segmenta blocos, identifica o número
            CNJ, <strong>Data de disponibilização</strong> e <strong>Data de publicação</strong> (inclusive com ano em 2
            dígitos, ex.: 19/03/26), o teor após «Publicação», marca indisponibilidade de arquivos e cruza com o cadastro
            interno (mesma base do Relatório de Processos). A API pública do CNJ (DataJud){' '}
            <strong>não substitui o teor</strong> — apenas valida e enriquece metadados. Cada publicação na prévia e na
            grade gravada recebe um <strong>número sequencial (#)</strong> para você conferir se nada ficou de fora em
            relação ao PDF. Revise a prévia antes de confirmar.
          </p>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300 dark:border-white/20"
              checked={consultarDatajud}
              onChange={(e) => setConsultarDatajud(e.target.checked)}
            />
            Consultar DataJud (CNJ) na importação — desmarque para modo offline (sem rede)
          </label>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/30 text-sm font-medium cursor-pointer hover:bg-sky-100/80 dark:hover:bg-sky-950/50">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processarArquivo(f);
                e.target.value = '';
              }}
            />
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {carregando ? 'Lendo PDF…' : 'Escolher PDF'}
          </label>
          {erro ? (
            <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {erro}
            </p>
          ) : null}
        </section>

        {preview ? (
          <section className="rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/50 dark:bg-amber-950/15 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Pré-visualização — {preview.nomeArquivo}</h2>
              <div className="flex flex-wrap gap-2 text-xs text-amber-900/90 dark:text-amber-200/90">
                <span>Blocos: {preview.metricas.blocosDetectados}</span>
                <span>·</span>
                <span>Com CNJ: {preview.metricas.comCnj}</span>
                <span>·</span>
                <span>Sem teor: {preview.metricas.semTeor}</span>
                <span>·</span>
                <span>Indisponível/segredo: {preview.metricas.indisponivel}</span>
                <span>·</span>
                <span>Dedup interno: {preview.metricas.duplicatasDescartadas}</span>
                <span>·</span>
                <span>Vínculos cadastro: {preview.metricas.vinculadosInterno ?? preview.metricas.vinculosEncontrados ?? 0}</span>
                <span>·</span>
                <span>Não vinculados: {preview.metricas.naoVinculados ?? 0}</span>
                <span>·</span>
                <span>Confirmados DataJud: {preview.metricas.confirmadosDatajud ?? 0}</span>
                <span>·</span>
                <span>Não confirm. CNJ: {preview.metricas.naoConfirmadosDatajud ?? 0}</span>
                <span>·</span>
                <span>Erros consulta: {preview.metricas.consultasComErroRede ?? 0}</span>
                {preview.metricas.consultasDatajudPuladas > 0 ? (
                  <>
                    <span>·</span>
                    <span>CNJ pulado (opção): {preview.metricas.consultasDatajudPuladas}</span>
                  </>
                ) : null}
              </div>
              {preview.hashArquivo ? (
                <p className="text-[10px] text-slate-500 font-mono break-all">SHA-256 arquivo: {preview.hashArquivo}</p>
              ) : null}
            </div>
            <details className="text-xs text-slate-600 dark:text-slate-500">
              <summary className="cursor-pointer font-medium">Trecho do texto extraído (auditoria)</summary>
              <pre className="mt-2 p-3 rounded-lg bg-white/80 dark:bg-black/30 overflow-x-auto max-h-40 whitespace-pre-wrap">
                {preview.textoLimpoSample}
              </pre>
            </details>
            <details className="text-xs text-slate-600 dark:text-slate-500">
              <summary className="cursor-pointer font-medium">Log técnico por item (DataJud, divergências)</summary>
              <pre className="mt-2 p-3 rounded-lg bg-white/80 dark:bg-black/30 overflow-x-auto max-h-56 whitespace-pre-wrap font-mono text-[10px]">
                {JSON.stringify(preview.logsItens ?? [], null, 2)}
              </pre>
            </details>
            {preview.itens.length > 0 ? (
              <div className="rounded-xl border border-amber-300/50 dark:border-amber-500/20 bg-white/70 dark:bg-black/25 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    Listagem diária consolidada (esta prévia)
                  </h3>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    Agrupar por
                    <select
                      value={consolidadoCriterio}
                      onChange={(e) => setConsolidadoCriterio(e.target.value)}
                      className="rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0d1018] px-2 py-1 text-[11px]"
                    >
                      <option value="publicacao">Data de publicação</option>
                      <option value="disponibilizacao">Data de disponibilização</option>
                    </select>
                  </label>
                </div>
                {consolidadoPreview.length === 0 ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Nenhuma data de publicação/disponibilização identificada nos itens — o consolidado aparece quando as
                    datas forem extraídas do PDF.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {consolidadoPreview.map((b) => (
                      <li
                        key={b.chaveSort}
                        className="border border-amber-200/80 dark:border-amber-500/20 rounded-lg p-3 bg-amber-50/40 dark:bg-black/20"
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
                          {b.dia} — {b.total} publicaç{b.total === 1 ? 'ão' : 'ões'}
                        </div>
                        <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                          {b.itens.map((row, idx) => {
                            const ix = preview?.itens ? preview.itens.indexOf(row) : -1;
                            const nLista = ix >= 0 ? ix + 1 : idx + 1;
                            return (
                            <li
                              key={idx}
                              className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-amber-100/80 dark:border-white/[0.06] pt-1.5 first:border-0 first:pt-0"
                            >
                              <span
                                className="inline-flex min-w-[1.75rem] justify-center rounded bg-slate-200/80 dark:bg-white/10 px-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 tabular-nums"
                                title="Nº na lista completa (conferência com o PDF)"
                              >
                                {nLista}
                              </span>
                              <span className="font-mono text-[11px]">{row.numeroCnj || '—'}</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                Pub. {row.dataPublicacao || '—'} · Disp. {row.dataDisponibilizacao || '—'}
                              </span>
                              <span>{row.tipoPublicacao || '—'}</span>
                            </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <div className="overflow-x-auto border border-slate-200 dark:border-white/[0.08] rounded-lg">
              <table className="w-full text-xs min-w-[1200px]">
                <thead className="bg-slate-100 dark:bg-black/30">
                  <tr className="text-left">
                    <th className="p-2 w-10">
                      <input
                        type="checkbox"
                        checked={preview.itens.length > 0 && selecionados.size === preview.itens.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelecionados(new Set(preview.itens.map((_, i) => i)));
                          else setSelecionados(new Set());
                        }}
                      />
                    </th>
                    <th
                      className="p-2 w-9 text-center"
                      title="Numeração sequencial das publicações extraídas — use para conferir com o PDF"
                    >
                      #
                    </th>
                    <th className="p-2">CNJ</th>
                    <th className="p-2">Datas</th>
                    <th className="p-2">Diário</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Status CNJ</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Vínculo</th>
                    <th className="p-2 min-w-[200px]">Resumo / teor</th>
                    <th className="p-2 w-[120px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.itens.map((row, i) => {
                    const rowTone =
                      row.scoreConfianca === 'baixo'
                        ? 'bg-red-50/60 dark:bg-red-950/15'
                        : row.statusValidacaoCnj === 'divergencia_pdf_cnj'
                          ? 'bg-amber-50/50 dark:bg-amber-950/15'
                          : '';
                    return (
                      <tr key={i} className={`border-t border-slate-100 dark:border-white/[0.06] ${rowTone}`}>
                        <td className="p-2 align-top">
                          <input type="checkbox" checked={selecionados.has(i)} onChange={() => toggleSel(i)} />
                        </td>
                        <td
                          className="p-2 align-top text-center tabular-nums font-semibold text-slate-700 dark:text-slate-200"
                          title="Nº na lista (conferência com o PDF)"
                        >
                          {i + 1}
                        </td>
                        <td className="p-2 align-top font-mono text-[11px]">{row.numeroCnj || '—'}</td>
                        <td className="p-2 align-top whitespace-nowrap">
                          <div className="text-[11px]">
                            <span className="text-slate-500">Pub. </span>
                            {row.dataPublicacao || '—'}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="text-slate-400">Disp. </span>
                            {row.dataDisponibilizacao || '—'}
                          </div>
                        </td>
                        <td className="p-2 align-top max-w-[140px]">
                          <div className="line-clamp-2 text-[11px]" title={row.diario || ''}>
                            {row.diario || '—'}
                          </div>
                        </td>
                        <td className="p-2 align-top">{row.tipoPublicacao}</td>
                        <td className="p-2 align-top">
                          <span className="text-[11px]">{rotuloStatusCnj(row.statusValidacaoCnj)}</span>
                          {Array.isArray(row.divergenciasPdfCnj) && row.divergenciasPdfCnj.length > 0 ? (
                            <div className="text-[10px] text-amber-800 dark:text-amber-200 mt-0.5">
                              {row.divergenciasPdfCnj.slice(0, 2).join(' · ')}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2 align-top">
                          <ScoreBadge score={row.scoreConfianca} />
                        </td>
                        <td className="p-2 align-top">
                          {row.statusVinculo === 'vinculado' ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge tone="green">
                                {row.codCliente} / proc {row.procInterno}
                              </Badge>
                              {row.vinculoOrigem === 'manual' ? (
                                <span className="text-[9px] uppercase text-sky-700 dark:text-sky-300">manual</span>
                              ) : null}
                            </div>
                          ) : (
                            <Badge tone="amber">
                              {row.statusVinculo === 'nao_vinculado' ? 'Processo não vinculado' : 'Sem CNJ'}
                            </Badge>
                          )}
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]" title={row.cliente}>
                            {row.cliente || '—'}
                          </div>
                        </td>
                        <td className="p-2 align-top text-slate-700 dark:text-slate-300 max-w-md">
                          <div className="line-clamp-3">{row.resumoAutomatico || row.teorIntegral?.slice(0, 200)}</div>
                          {row.statusTeor !== 'integral' ? (
                            <div className="text-[10px] text-amber-800 dark:text-amber-200 mt-1">Status teor: {row.statusTeor}</div>
                          ) : null}
                        </td>
                        <td className="p-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setVinculoModal({ kind: 'preview', index: i });
                                setVincForm({
                                  codCliente: row.codCliente || '',
                                  procInterno: row.procInterno || '',
                                  cliente: row.cliente || '',
                                });
                                setVinculoFormErro('');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-white/15 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-white/5"
                            >
                              <Link2 className="w-3 h-3" />
                              Vincular
                            </button>
                            <button
                              type="button"
                              title="Reaplica o cruzamento automático pelo CNJ no cadastro"
                              onClick={() => reaplicarVinculoPreview(i)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-white/15 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-white/5"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Auto
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={confirmarImportacao}
                disabled={selecionados.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar importação ({selecionados.size})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setArquivoNome('');
                  setVinculoModal(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-sm"
              >
                Cancelar prévia
              </button>
            </div>
          </section>
        ) : null}

        {logImportacao ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/25 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            Importação concluída: <strong>{logImportacao.gravados}</strong> novo(s) registro(s).
            {logImportacao.ignoradosDuplicata > 0
              ? ` ${logImportacao.ignoradosDuplicata} duplicata(s) ignorada(s) no armazenamento.`
              : ''}
            {Number(logImportacao.semVinculo || 0) > 0 ? ` ${logImportacao.semVinculo} registro(s) sem vínculo resolvido.` : ''}
            {logImportacao.mensagem ? ` ${logImportacao.mensagem}` : ''}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 w-full flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Publicações gravadas ({filtrados.length})
            </h2>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Filtro vínculo
              <select
                value={filtroVinculo}
                onChange={(e) => setFiltroVinculo(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm min-w-[12rem]"
              >
                <option value="todos">Todos</option>
                <option value="nao_vinculados">Só não vinculados / sem CNJ</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 flex-1 min-w-[200px]">
              Busca
              <span className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Processo, cliente, teor…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] text-sm"
                />
              </span>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Status trat.
              <select
                value={filtroStatusTratamento}
                onChange={(e) => setFiltroStatusTratamento(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm min-w-[10rem]"
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="VINCULADA">Vinculada</option>
                <option value="TRATADA">Tratada</option>
                <option value="IGNORADA">Ignorada</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Origem
              <select
                value={filtroOrigemImportacao}
                onChange={(e) => setFiltroOrigemImportacao(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm min-w-[9rem]"
              >
                <option value="">Todas</option>
                <option value="MANUAL">Manual</option>
                <option value="PDF">PDF</option>
                <option value="DATAJUD">DataJud</option>
                <option value="MONITORAMENTO">Monitoramento</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              De
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Até
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Processo ID
              <input
                type="number"
                value={filtroProcessoId}
                onChange={(e) => setFiltroProcessoId(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm w-[9rem]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Cliente ID
              <input
                type="number"
                value={filtroClienteId}
                onChange={(e) => setFiltroClienteId(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm w-[9rem]"
              />
            </label>
          </div>
          {carregandoGravados ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300">Carregando publicações...</p>
          ) : null}
          {erroGravados ? (
            <p className="text-xs text-red-700 dark:text-red-300">{erroGravados}</p>
          ) : null}

          {filtrados.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-black/25 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  Listagem diária consolidada
                </h3>
                <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  Agrupar por
                  <select
                    value={consolidadoCriterio}
                    onChange={(e) => setConsolidadoCriterio(e.target.value)}
                    className="rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0d1018] px-2 py-1 text-[11px]"
                  >
                    <option value="publicacao">Data de publicação</option>
                    <option value="disponibilizacao">Data de disponibilização</option>
                  </select>
                </label>
              </div>
              {consolidadoGravados.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sem datas classificáveis nos registros filtrados.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {consolidadoGravados.map((b) => (
                    <li
                      key={b.chaveSort}
                      className="border border-slate-200 dark:border-white/10 rounded-lg p-3 bg-white dark:bg-[#0d1018]/60"
                    >
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
                        {b.dia} — {b.total} publicaç{b.total === 1 ? 'ão' : 'ões'}
                      </div>
                      <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                        {b.itens.map((row) => {
                          const nLista = filtrados.indexOf(row) + 1;
                          return (
                          <li
                            key={row.id}
                            className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-slate-100 dark:border-white/[0.06] pt-1.5 first:border-0 first:pt-0"
                          >
                            <span
                              className="inline-flex min-w-[1.75rem] justify-center rounded bg-slate-200/90 dark:bg-white/10 px-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 tabular-nums"
                              title="Nº na lista filtrada (conferência)"
                            >
                              {nLista > 0 ? nLista : '—'}
                            </span>
                            <span className="font-mono text-[11px]">{row.numero_processo_cnj || '—'}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              Pub. {row.dataPublicacao || '—'} · Disp. {row.dataDisponibilizacao || '—'}
                            </span>
                            <span>{row.tipoPublicacao || '—'}</span>
                          </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1200px]">
              <thead className="bg-slate-50 dark:bg-black/25 border-b border-slate-200 dark:border-white/[0.08]">
                <tr className="text-left">
                  <th
                    className="p-2 w-9 text-center"
                    title="Numeração sequencial — conferência com a importação / PDF"
                  >
                    #
                  </th>
                  <th className="p-2">Importação</th>
                  <th className="p-2">CNJ</th>
                  <th className="p-2">Cliente / proc.</th>
                  <th className="p-2">Data pub.</th>
                  <th className="p-2">Data disp.</th>
                  <th className="p-2">Diário</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Status CNJ</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Vínculo</th>
                  <th className="p-2 min-w-[200px]">Resumo</th>
                  <th className="p-2 w-[120px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-500">
                      Nenhuma publicação gravada ou nada corresponde ao filtro.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((r, idxLista) => {
                    const destaque =
                      r.scoreConfianca === 'baixo'
                        ? 'bg-red-50/50 dark:bg-red-950/20'
                        : r.statusValidacaoCnj === 'divergencia_pdf_cnj'
                          ? 'bg-amber-50/40 dark:bg-amber-950/15'
                          : r.statusVinculo === 'nao_vinculado' || r.statusVinculo === 'sem_cnj'
                            ? 'border-l-2 border-l-amber-400/80'
                            : '';
                    return (
                      <tr key={r.id} className={`border-b border-slate-100 dark:border-white/[0.06] align-top ${destaque}`}>
                        <td className="p-2 text-center tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                          {idxLista + 1}
                        </td>
                        <td className="p-2 whitespace-nowrap text-slate-500">
                          {r.dataImportacao?.slice(0, 10)}
                          <div className="text-[10px] truncate max-w-[120px]" title={r.arquivoOrigem}>
                            {r.arquivoOrigem || '—'}
                          </div>
                        </td>
                        <td className="p-2 font-mono text-[11px]">{r.numero_processo_cnj}</td>
                        <td className="p-2">
                          <div>{r.codCliente || '—'}</div>
                          <div className="text-slate-500">proc {r.procInterno || '—'}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={r.cliente}>
                            {r.cliente}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">{r.dataPublicacao || '—'}</td>
                        <td className="p-2 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {r.dataDisponibilizacao || '—'}
                        </td>
                        <td className="p-2 max-w-[120px]">
                          <div className="line-clamp-2 text-[11px]" title={r.diario || ''}>
                            {r.diario || '—'}
                          </div>
                        </td>
                        <td className="p-2">{r.tipoPublicacao}</td>
                        <td className="p-2">
                          <span className="text-[11px]">{rotuloStatusCnj(r.statusValidacaoCnj)}</span>
                        </td>
                        <td className="p-2">
                          <ScoreBadge score={r.scoreConfianca} />
                        </td>
                        <td className="p-2">
                          {r.statusVinculo === 'vinculado' ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge tone="green">Vinculado</Badge>
                              {r.vinculoOrigem === 'manual' ? (
                                <span className="text-[9px] uppercase text-sky-700 dark:text-sky-300">manual</span>
                              ) : null}
                            </div>
                          ) : (
                            <Badge tone="amber" title={r.statusVinculo === 'nao_vinculado' ? 'Processo não vinculado ao cadastro interno' : ''}>
                              {r.statusVinculo === 'nao_vinculado' ? 'Processo não vinculado' : 'Pendente'}
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-slate-700 dark:text-slate-300">
                          <div className="line-clamp-4">{r.resumoPublicacao}</div>
                        </td>
                        <td className="p-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setVinculoModal({ kind: 'saved', id: r.id });
                                setVincForm({
                                  codCliente: r.codCliente || '',
                                  procInterno: r.procInterno || '',
                                  cliente: r.cliente || '',
                                });
                                setVinculoFormErro('');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-white/15 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-white/5"
                            >
                              <Link2 className="w-3 h-3" />
                              Vincular
                            </button>
                            <button
                              type="button"
                              title="Reaplica o cruzamento automático pelo CNJ no cadastro"
                              onClick={() => reaplicarVinculoGravado(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-white/15 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-white/5"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Auto
                            </button>
                            {featureFlags.useApiTarefas ? (
                              <button
                                type="button"
                                onClick={() => abrirModalTarefaPublicacao(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-sky-200 dark:border-sky-500/40 text-[10px] font-medium text-sky-800 dark:text-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                                title="Criar tarefa operacional com vínculos quando a API estiver ativa"
                              >
                                <ListTodo className="w-3 h-3" />
                                Criar tarefa
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => alterarStatusGravado(r, 'TRATADA')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/40 text-[10px] font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            >
                              Tratar
                            </button>
                            <button
                              type="button"
                              onClick={() => alterarStatusGravado(r, 'IGNORADA')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-200 dark:border-amber-500/40 text-[10px] font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            >
                              Ignorar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {vinculoModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vinculo-modal-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141c2c] p-5 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h3 id="vinculo-modal-title" className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 shrink-0" />
                  Vincular ao cadastro interno
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setVinculoModal(null);
                    setVinculoFormErro('');
                  }}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Informe o <strong>código do cliente</strong> e o <strong>proc. interno</strong>. Se o nome ficar em branco, o sistema tenta obter pelo cadastro de clientes.
              </p>
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Código do cliente
                  <input
                    type="text"
                    inputMode="numeric"
                    value={vincForm.codCliente}
                    onChange={(e) => setVincForm((f) => ({ ...f, codCliente: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm"
                    placeholder="ex.: 00000001"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Proc. interno
                  <input
                    type="text"
                    value={vincForm.procInterno}
                    onChange={(e) => setVincForm((f) => ({ ...f, procInterno: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm"
                    placeholder="número do processo interno"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Cliente (opcional)
                  <input
                    type="text"
                    value={vincForm.cliente}
                    onChange={(e) => setVincForm((f) => ({ ...f, cliente: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm"
                    placeholder="Nome para exibição"
                  />
                </label>
              </div>
              {vinculoFormErro ? (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {vinculoFormErro}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setVinculoModal(null);
                    setVinculoFormErro('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarVinculoModal}
                  className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
                >
                  Salvar vínculo
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <ModalCriarTarefaContextual
          open={modalTarefaContextual != null}
          onClose={() => setModalTarefaContextual(null)}
          context={modalTarefaContextual}
        />
      </div>
    </div>
  );
}
