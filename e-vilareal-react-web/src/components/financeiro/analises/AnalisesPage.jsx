import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  aplicarRecorrenciaApi,
  descartarRecorrenciaApi,
  listarRecorrenciasApi,
  obterResumoConsolidadoContasApi,
  obterSaudeFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { ETAPAS } from '../constants/financeiroConstants.js';
import { useFinanceiroChrome } from '../FinanceiroContext.jsx';
import { AnalisesPageSkeleton, AnalisesRecorrenciasSkeleton, AnalisesStatusCarregando } from '../shared/LoadingSkeleton.jsx';
import { Pagination } from '../shared/Pagination.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { CONTA_CHART_HEX } from '../consolidado/consolidadoUtils.js';
import { CONTAS_LETRAS } from '../constants/financeiroConstants.js';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { AplicarRecorrenciaDialog } from './AplicarRecorrenciaDialog.jsx';
import { AnalisesBatchBar } from './AnalisesBatchBar.jsx';
import { RecorrenciaCard } from './RecorrenciaCard.jsx';
import {
  chavePadraoRecorrencia,
  filtrarLancamentosDivergentes,
  padraoConfiancaPerfeita,
  padraoAcionavel,
  padraoElegivelAprovarTodos,
  padraoElegivelLoteSelecionado,
  pctClassificado,
  qtdDivergentes,
  resolverAcaoCard,
  resolverAcaoLoteRecorrencia,
  rotuloDescricaoComData,
  somaCandidatosExato,
} from './analisesUtils.js';

function KpiCard({ label, value, sublabel, tone = 'neutral', loading = false }) {
  const tones = {
    neutral: 'text-slate-900 dark:text-slate-100',
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-700 dark:text-emerald-400',
  };
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3 min-w-[140px] flex-1">
      {loading ? (
        <>
          <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" aria-hidden="true" />
          <div className="mt-2 h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" aria-hidden="true" />
        </>
      ) : (
        <>
          <p className={`text-2xl font-medium leading-none tabular-nums ${tones[tone]}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
          {sublabel ? <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p> : null}
        </>
      )}
    </div>
  );
}

function DistribuicaoBar({ totaisPorConta, loading = false }) {
  const linhas = useMemo(() => {
    const entries = CONTAS_LETRAS.map((cod) => ({
      cod,
      qtd: Number(totaisPorConta?.[cod] ?? 0),
    })).filter((x) => x.qtd > 0);
    const max = Math.max(1, ...entries.map((e) => e.qtd));
    return entries.map((e) => ({ ...e, pct: (e.qtd / max) * 100 }));
  }, [totaisPorConta]);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse py-2" aria-busy="true" aria-label="Carregando distribuição">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-4 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="w-12 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (linhas.length === 0) {
    return <p className="text-sm text-slate-500 py-2">Sem dados de distribuição.</p>;
  }

  return (
    <div className="space-y-1.5" role="img" aria-label="Distribuição de lançamentos por conta contábil">
      {linhas.map(({ cod, qtd, pct }) => (
        <div key={cod} className="flex items-center gap-2 text-xs">
          <span className="w-4 font-medium text-slate-600 dark:text-slate-400">{cod}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: CONTA_CHART_HEX[cod] ?? 'var(--fin-conta-n)',
              }}
            />
          </div>
          <span className="w-16 text-right tabular-nums text-slate-500 dark:text-slate-400">
            {qtd.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnalisesPage() {
  const { bancoAtivo, bancos } = useFinanceiroChrome();
  const toast = useFinanceiroToast();

  const [confiancaMinima, setConfiancaMinima] = useState('ALTA');
  const [precisaoValor, setPrecisaoValor] = useState('EXATO');
  const [somenteConfiancaPerfeita, setSomenteConfiancaPerfeita] = useState(false);

  const [saude, setSaude] = useState(null);
  const [totaisPorConta, setTotaisPorConta] = useState({});
  const [classificaveisRecorrencia, setClassificaveisRecorrencia] = useState(0);
  const [headerLoading, setHeaderLoading] = useState(featureFlags.useApiFinanceiro);

  const [recorrencias, setRecorrencias] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listaLoading, setListaLoading] = useState(featureFlags.useApiFinanceiro);
  const [listaErro, setListaErro] = useState('');

  const [dialogPadrao, setDialogPadrao] = useState(null);
  const [precisaoAplicar, setPrecisaoAplicar] = useState('EXATO');
  const [dryRunResult, setDryRunResult] = useState(null);
  const [previewsDivergentes, setPreviewsDivergentes] = useState(() => new Map());
  const [criarRegra, setCriarRegra] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [fadingKeys, setFadingKeys] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [loteProgress, setLoteProgress] = useState(null);
  const cancelarLoteRef = useRef(false);
  const selecionarPaginaRef = useRef(null);

  const [aprovarTodosProgress, setAprovarTodosProgress] = useState(null);
  const cancelarAprovarTodosRef = useRef(false);

  const bancoNome = useMemo(
    () => bancos.find((b) => b.numero === bancoAtivo)?.nome ?? null,
    [bancos, bancoAtivo],
  );

  const subtitulo = bancoNome ? `${bancoNome} · 12 meses` : 'Todas as contas · 12 meses';

  const pendentes = Number(saude?.porEtapa?.[ETAPAS.IMPORTADO] ?? 0);
  const totalLanc = Number(saude?.totalLancamentos ?? 0);
  const pctClass = pctClassificado(totalLanc, pendentes);

  const queryRecorrencias = useMemo(
    () => ({
      confiancaMinima,
      numeroBanco: bancoAtivo,
      apenasAcionaveis: true,
      precisaoValor,
      somenteConfiancaPerfeita,
    }),
    [confiancaMinima, bancoAtivo, precisaoValor, somenteConfiancaPerfeita],
  );

  const recorrenciasVisiveis = useMemo(
    () => recorrencias.filter((p) => padraoAcionavel(p, precisaoValor)),
    [recorrencias, precisaoValor],
  );

  const carregarCabecalho = useCallback(async (signal) => {
    if (!featureFlags.useApiFinanceiro) {
      setHeaderLoading(false);
      return;
    }
    setHeaderLoading(true);
    try {
      const [s, resumo, recKpi] = await Promise.all([
        obterSaudeFinanceiroApi({ signal }),
        obterResumoConsolidadoContasApi({ signal, meses: 12 }),
        listarRecorrenciasApi(
          { ...queryRecorrencias, page: 0, size: 1000, apenasAcionaveis: true, precisaoValor: 'EXATO' },
          { signal },
        ),
      ]);
      setSaude(s);
      setTotaisPorConta(resumo?.totaisPorConta ?? {});
      const soma = (recKpi?.content ?? []).reduce((acc, p) => acc + somaCandidatosExato(p), 0);
      setClassificaveisRecorrencia(soma);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        toast.error(e?.message || 'Erro ao carregar indicadores.');
      }
    } finally {
      if (signal == null || !signal.aborted) {
        setHeaderLoading(false);
      }
    }
  }, [queryRecorrencias, toast]);

  const carregarLista = useCallback(async (signal) => {
    if (!featureFlags.useApiFinanceiro) return;
    setListaLoading(true);
    setListaErro('');
    try {
      const res = await listarRecorrenciasApi(
        { ...queryRecorrencias, page, size: pageSize },
        { signal },
      );
      setRecorrencias(Array.isArray(res?.content) ? res.content : []);
      setTotalElements(Number(res?.totalElements) || 0);
      setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setListaErro(e?.message || 'Erro ao carregar recorrências.');
      setRecorrencias([]);
    } finally {
      if (signal == null || !signal.aborted) {
        setListaLoading(false);
      }
    }
  }, [queryRecorrencias, page, pageSize]);

  useEffect(() => {
    setPage(0);
    setSelectedKeys(new Set());
  }, [confiancaMinima, bancoAtivo, precisaoValor, somenteConfiancaPerfeita]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [page]);

  useEffect(() => {
    const ac = new AbortController();
    carregarCabecalho(ac.signal);
    return () => ac.abort();
  }, [carregarCabecalho]);

  useEffect(() => {
    const ac = new AbortController();
    carregarLista(ac.signal);
    return () => ac.abort();
  }, [carregarLista]);

  useEffect(() => {
    if (precisaoValor !== 'IGNORAR_VALOR') {
      setPreviewsDivergentes(new Map());
      return undefined;
    }
    const ac = new AbortController();
    (async () => {
      const candidatos = recorrenciasVisiveis.filter((p) => qtdDivergentes(p) > 0);
      if (candidatos.length === 0) {
        setPreviewsDivergentes(new Map());
        return;
      }
      const next = new Map();
      await Promise.all(
        candidatos.map(async (p) => {
          const key = chavePadraoRecorrencia(p);
          try {
            const preview = await aplicarRecorrenciaApi(
              {
                descricaoNorm: p.descricaoNorm,
                numeroBanco: p.numeroBanco,
                contaContabilId: p.contaContabilId,
                clienteId: p.clienteId ?? null,
                processoId: p.processoId ?? null,
                escopo: 'TODOS',
                precisaoValor: 'IGNORAR_VALOR',
                criarRegra: false,
                dryRun: true,
              },
              { signal: ac.signal },
            );
            next.set(key, filtrarLancamentosDivergentes(preview?.lancamentos, p.valorModal));
          } catch (e) {
            if (e?.name !== 'AbortError') {
              /* preview opcional */
            }
          }
        }),
      );
      if (!ac.signal.aborted) setPreviewsDivergentes(next);
    })();
    return () => ac.abort();
  }, [recorrenciasVisiveis, precisaoValor]);

  const refreshAll = useCallback(() => {
    carregarCabecalho(undefined);
    carregarLista(undefined);
    dispatchRefreshPendentes();
  }, [carregarCabecalho, carregarLista]);

  const removerPadraoComFade = useCallback((padrao) => {
    const key = chavePadraoRecorrencia(padrao);
    setFadingKeys((prev) => new Set(prev).add(key));
    window.setTimeout(() => {
      setRecorrencias((prev) => prev.filter((p) => chavePadraoRecorrencia(p) !== key));
      setFadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setTotalElements((t) => Math.max(0, t - 1));
    }, 280);
  }, []);

  const descartarPadrao = useCallback(
    async (padrao) => {
      const key = chavePadraoRecorrencia(padrao);
      setBusyKey(key);
      try {
        await descartarRecorrenciaApi({
          descricaoNorm: padrao.descricaoNorm,
          numeroBanco: padrao.numeroBanco,
        });
        toast.success('Padrão descartado.');
        removerPadraoComFade(padrao);
      } catch (e) {
        toast.error(e?.message || 'Erro ao descartar sugestão.');
      } finally {
        setBusyKey(null);
      }
    },
    [toast, removerPadraoComFade],
  );

  const loteEmAndamento = Boolean(loteProgress || aprovarTodosProgress);

  const padroesSelecionados = useMemo(
    () => recorrenciasVisiveis.filter((p) => selectedKeys.has(chavePadraoRecorrencia(p))),
    [recorrenciasVisiveis, selectedKeys],
  );

  const toggleSelecao = useCallback((padrao) => {
    const key = chavePadraoRecorrencia(padrao);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelecionarPagina = useCallback(() => {
    const keysPagina = recorrenciasVisiveis.map((p) => chavePadraoRecorrencia(p));
    const todosMarcados = keysPagina.length > 0 && keysPagina.every((k) => selectedKeys.has(k));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (todosMarcados) {
        keysPagina.forEach((k) => next.delete(k));
      } else {
        keysPagina.forEach((k) => next.add(k));
      }
      return next;
    });
  }, [recorrenciasVisiveis, selectedKeys]);

  const aplicarPadraoDireto = useCallback(async (padrao, precisao, escopo) => {
    const res = await aplicarRecorrenciaApi({
      descricaoNorm: padrao.descricaoNorm,
      numeroBanco: padrao.numeroBanco,
      contaContabilId: padrao.contaContabilId,
      clienteId: padrao.clienteId ?? null,
      processoId: padrao.processoId ?? null,
      escopo,
      precisaoValor: precisao,
      criarRegra: false,
      dryRun: false,
    });
    return Number(res?.aplicadosNovos ?? 0) + Number(res?.aplicadosCompletados ?? 0);
  }, []);

  const processarLoteSelecionados = useCallback(
    async (modo) => {
      if (padroesSelecionados.length === 0) return;
      cancelarLoteRef.current = false;
      const total = padroesSelecionados.length;
      let aplicados = 0;
      let descartados = 0;
      const isConfirmar = precisaoValor === 'IGNORAR_VALOR';
      setLoteProgress({
        current: 0,
        total,
        label:
          modo === 'aprovar'
            ? isConfirmar
              ? `Confirmando 0 de ${total}…`
              : `Aprovando 0 de ${total}…`
            : `Descartando 0 de ${total}…`,
        detail: modo === 'aprovar' ? '0 classificados' : '0 descartados',
      });

      for (let i = 0; i < padroesSelecionados.length; i += 1) {
        if (cancelarLoteRef.current) break;
        const p = padroesSelecionados[i];
        try {
          if (modo === 'aprovar') {
            if (!padraoElegivelLoteSelecionado(p, precisaoValor)) continue;
            const acao = resolverAcaoLoteRecorrencia(p, precisaoValor);
            aplicados += await aplicarPadraoDireto(p, acao.precisaoValor, acao.escopo);
          } else {
            await descartarRecorrenciaApi({
              descricaoNorm: p.descricaoNorm,
              numeroBanco: p.numeroBanco,
            });
            descartados += 1;
            removerPadraoComFade(p);
          }
        } catch (e) {
          toast.warn(`Falha em ${p.descricaoExemplo}: ${e?.message || 'erro'}`);
        }
        setLoteProgress({
          current: i + 1,
          total,
          label:
            modo === 'aprovar'
              ? isConfirmar
                ? `Confirmando ${i + 1} de ${total}…`
                : `Aprovando ${i + 1} de ${total}…`
              : `Descartando ${i + 1} de ${total}…`,
          detail:
            modo === 'aprovar'
              ? `${aplicados.toLocaleString('pt-BR')} classificados`
              : `${descartados.toLocaleString('pt-BR')} descartados`,
        });
      }

      if (modo === 'aprovar') {
        toast.success(
          isConfirmar
            ? `${aplicados.toLocaleString('pt-BR')} lançamento${aplicados === 1 ? '' : 's'} confirmado${aplicados === 1 ? '' : 's'} em lote`
            : `${aplicados.toLocaleString('pt-BR')} lançamento${aplicados === 1 ? '' : 's'} classificado${aplicados === 1 ? '' : 's'} em lote`,
        );
        refreshAll();
      } else {
        toast.success(
          descartados === 1
            ? '1 padrão descartado'
            : `${descartados.toLocaleString('pt-BR')} padrões descartados`,
        );
        if (descartados > 0) {
          refreshAll();
        }
      }
      setSelectedKeys(new Set());
      setLoteProgress(null);
    },
    [padroesSelecionados, precisaoValor, aplicarPadraoDireto, toast, refreshAll, removerPadraoComFade],
  );

  const abrirDialog = useCallback(
    async (padrao, precisao) => {
      setDialogPadrao(padrao);
      setPrecisaoAplicar(precisao);
      setCriarRegra(false);
      setDryRunResult(null);
      setBusyKey(chavePadraoRecorrencia(padrao));
      try {
        const preview = await aplicarRecorrenciaApi({
          descricaoNorm: padrao.descricaoNorm,
          numeroBanco: padrao.numeroBanco,
          contaContabilId: padrao.contaContabilId,
          clienteId: padrao.clienteId ?? null,
          processoId: padrao.processoId ?? null,
          escopo: 'TODOS',
          precisaoValor: precisao,
          criarRegra: false,
          dryRun: true,
        });
        setDryRunResult(preview);
      } catch (e) {
        toast.error(e?.message || 'Erro ao simular aplicação.');
        setDialogPadrao(null);
      } finally {
        setBusyKey(null);
      }
    },
    [toast],
  );

  const aplicarPadrao = useCallback(
    async (padrao) => {
      const { escopo, precisaoValor: prec } = resolverAcaoCard(precisaoValor);
      const isMedia = String(padrao?.confianca ?? '').toUpperCase() === 'MEDIA';
      const isSoNome = precisaoValor === 'IGNORAR_VALOR';
      if (isMedia || isSoNome) {
        abrirDialog(padrao, prec);
        return;
      }
      const key = chavePadraoRecorrencia(padrao);
      setBusyKey(key);
      try {
        const count = await aplicarPadraoDireto(padrao, prec, escopo);
        if (count <= 0) {
          toast.info('Nenhum lançamento alterado.');
          return;
        }
        toast.success(
          `${count.toLocaleString('pt-BR')} lançamento${count === 1 ? '' : 's'} atualizado${count === 1 ? '' : 's'}`,
        );
        refreshAll();
      } catch (e) {
        toast.error(e?.message || 'Erro ao aplicar padrão.');
      } finally {
        setBusyKey(null);
      }
    },
    [precisaoValor, abrirDialog, aplicarPadraoDireto, toast, refreshAll],
  );

  const confirmarAplicar = useCallback(
    async () => {
      if (!dialogPadrao) return;
      setAplicando(true);
      try {
        const res = await aplicarRecorrenciaApi({
          descricaoNorm: dialogPadrao.descricaoNorm,
          numeroBanco: dialogPadrao.numeroBanco,
          contaContabilId: dialogPadrao.contaContabilId,
          clienteId: dialogPadrao.clienteId ?? null,
          processoId: dialogPadrao.processoId ?? null,
          escopo: 'TODOS',
          precisaoValor: precisaoAplicar,
          criarRegra,
          dryRun: false,
        });
        const novos = Number(res?.aplicadosNovos ?? 0);
        const completados = Number(res?.aplicadosCompletados ?? 0);
        const total = novos + completados;
        let msg =
          total > 0
            ? `${total.toLocaleString('pt-BR')} lançamento${total === 1 ? '' : 's'} atualizado${total === 1 ? '' : 's'}`
            : 'Nenhum lançamento alterado';
        if (res?.regraCriadaId && !res?.jaExistiaRegra) {
          msg += ' · regra criada';
        }
        toast.success(msg);
        setDialogPadrao(null);
        refreshAll();
      } catch (e) {
        toast.error(e?.message || 'Erro ao aplicar padrão.');
      } finally {
        setAplicando(false);
      }
    },
    [dialogPadrao, precisaoAplicar, criarRegra, toast, refreshAll],
  );

  useEffect(() => {
    if (!dialogPadrao || aplicando) return;
    let cancelled = false;
    (async () => {
      try {
        const preview = await aplicarRecorrenciaApi({
          descricaoNorm: dialogPadrao.descricaoNorm,
          numeroBanco: dialogPadrao.numeroBanco,
          contaContabilId: dialogPadrao.contaContabilId,
          clienteId: dialogPadrao.clienteId ?? null,
          processoId: dialogPadrao.processoId ?? null,
          escopo: 'TODOS',
          precisaoValor: precisaoAplicar,
          criarRegra: false,
          dryRun: true,
        });
        if (!cancelled) setDryRunResult(preview);
      } catch {
        /* preview anterior permanece */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogPadrao, precisaoAplicar, aplicando]);

  const aprovarTodosAlta = useCallback(async () => {
    cancelarAprovarTodosRef.current = false;
    try {
      const res = await listarRecorrenciasApi({
        confiancaMinima: 'ALTA',
        numeroBanco: bancoAtivo,
        apenasAcionaveis: true,
        precisaoValor: 'EXATO',
        somenteConfiancaPerfeita,
        page: 0,
        size: 1000,
      });
      const padroesAlta = (res?.content ?? []).filter(
        (p) => String(p.confianca ?? '').toUpperCase() === 'ALTA' && somaCandidatosExato(p) > 0,
      );
      if (padroesAlta.length === 0) {
        toast.info(
          somenteConfiancaPerfeita
            ? 'Nenhum padrão com 100% de consistência e confiança alta.'
            : 'Nenhum padrão de alta confiança com pendentes.',
        );
        return;
      }
      setAprovarTodosProgress({ current: 0, total: padroesAlta.length, aplicados: 0 });
      let totalAplicados = 0;
      for (let i = 0; i < padroesAlta.length; i += 1) {
        if (cancelarAprovarTodosRef.current) break;
        const p = padroesAlta[i];
        try {
          const r = await aplicarRecorrenciaApi({
            descricaoNorm: p.descricaoNorm,
            numeroBanco: p.numeroBanco,
            contaContabilId: p.contaContabilId,
            clienteId: p.clienteId ?? null,
            processoId: p.processoId ?? null,
            escopo: 'TODOS',
            precisaoValor: 'EXATO',
            criarRegra: false,
            dryRun: false,
          });
          totalAplicados += Number(r?.aplicadosNovos ?? 0) + Number(r?.aplicadosCompletados ?? 0);
        } catch (e) {
          toast.warn(`Falha em ${p.descricaoExemplo}: ${e?.message || 'erro'}`);
        }
        setAprovarTodosProgress({ current: i + 1, total: padroesAlta.length, aplicados: totalAplicados });
      }
      toast.success(
        `${totalAplicados.toLocaleString('pt-BR')} lançamento${totalAplicados === 1 ? '' : 's'} classificado${totalAplicados === 1 ? '' : 's'} em lote`,
      );
      refreshAll();
    } finally {
      setAprovarTodosProgress(null);
    }
  }, [bancoAtivo, toast, refreshAll, somenteConfiancaPerfeita]);

  const selecionarTodosPerfeitosPagina = useCallback(() => {
    const keys = recorrenciasVisiveis
      .filter((p) => padraoConfiancaPerfeita(p))
      .map((p) => chavePadraoRecorrencia(p));
    setSelectedKeys(new Set(keys));
  }, [recorrenciasVisiveis]);

  const todosPaginaSelecionados =
    recorrenciasVisiveis.length > 0 &&
    recorrenciasVisiveis.every((p) => selectedKeys.has(chavePadraoRecorrencia(p)));
  const algumPaginaSelecionado = recorrenciasVisiveis.some((p) => selectedKeys.has(chavePadraoRecorrencia(p)));

  useEffect(() => {
    if (selecionarPaginaRef.current) {
      selecionarPaginaRef.current.indeterminate = algumPaginaSelecionado && !todosPaginaSelecionados;
    }
  }, [algumPaginaSelecionado, todosPaginaSelecionados]);

  const carregandoIndicadores = headerLoading && saude == null;
  const atualizandoIndicadores = headerLoading && saude != null;
  const carregandoRecorrencias = listaLoading && recorrenciasVisiveis.length === 0 && !listaErro;
  const paginaCarregando = carregandoIndicadores || carregandoRecorrencias;

  if (!featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">API financeiro desativada.</div>
    );
  }

  if (carregandoIndicadores) {
    return <AnalisesPageSkeleton />;
  }

  return (
    <div className="min-h-0 h-full overflow-auto p-4 space-y-4 max-w-5xl" aria-busy={paginaCarregando}>
      <header>
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Análises contábeis</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>
      </header>

      {paginaCarregando || atualizandoIndicadores ? (
        <AnalisesStatusCarregando
          mensagem={
            carregandoRecorrencias
              ? 'Detectando padrões recorrentes…'
              : 'Atualizando indicadores…'
          }
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Confiança:</span>
        <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
          {[
            { id: 'ALTA', label: 'Alta' },
            { id: 'MEDIA', label: 'Média+' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setConfiancaMinima(id)}
              className={`text-xs px-3 py-1 ${
                confiancaMinima === id
                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 font-medium'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              aria-pressed={confiancaMinima === id}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Valor:</span>
        <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
          {[
            { id: 'EXATO', label: 'Exato' },
            { id: 'TODOS', label: '+ aproximados' },
            { id: 'IGNORAR_VALOR', label: 'Só nome' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPrecisaoValor(id)}
              className={`text-xs px-3 py-1 ${
                precisaoValor === id
                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 font-medium'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              aria-pressed={precisaoValor === id}
            >
              {label}
            </button>
          ))}
        </div>
        <label
          className="inline-flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 ml-1"
          title="Confiança alta com consistência histórica (e vínculo, quando houver) em 100%"
        >
          <input
            type="checkbox"
            checked={somenteConfiancaPerfeita}
            onChange={(e) => {
              const ativo = e.target.checked;
              setSomenteConfiancaPerfeita(ativo);
              if (ativo && confiancaMinima !== 'ALTA') {
                setConfiancaMinima('ALTA');
              }
            }}
            className="rounded border-emerald-400 dark:border-emerald-600"
          />
          Só 100% consistência
        </label>
        {bancoAtivo ? (
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            Banco: <strong>{bancoNome}</strong> (sidebar)
          </span>
        ) : null}
      </div>

      <div
        className={`grid grid-cols-2 lg:grid-cols-4 gap-2 transition-opacity ${atualizandoIndicadores ? 'opacity-60' : ''}`}
      >
        <KpiCard
          label="Total lançamentos"
          value={totalLanc.toLocaleString('pt-BR')}
          loading={atualizandoIndicadores}
        />
        <KpiCard
          label="% classificado"
          value={`${pctClass}%`}
          tone="emerald"
          loading={atualizandoIndicadores}
        />
        <KpiCard
          label="Pendentes (N)"
          value={pendentes.toLocaleString('pt-BR')}
          tone="amber"
          loading={atualizandoIndicadores}
        />
        <KpiCard
          label="Classificáveis por recorrência"
          value={classificaveisRecorrencia.toLocaleString('pt-BR')}
          sublabel="nas recorrências detectadas"
          tone="emerald"
          loading={atualizandoIndicadores}
        />
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">
          Distribuição por conta (quantidade)
        </h3>
        <DistribuicaoBar totaisPorConta={totaisPorConta} loading={atualizandoIndicadores} />
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Recorrências detectadas</h3>
          <span className="text-xs text-slate-500 tabular-nums flex items-center gap-2">
            {listaLoading && recorrenciasVisiveis.length > 0 ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden="true" />
            ) : null}
            {carregandoRecorrencias
              ? '…'
              : `${totalElements.toLocaleString('pt-BR')} ${totalElements === 1 ? 'padrão' : 'padrões'}`}
          </span>
        </div>

        {carregandoRecorrencias ? (
          <AnalisesRecorrenciasSkeleton />
        ) : listaErro ? (
          <div className="p-4 text-sm text-red-600 dark:text-red-400">{listaErro}</div>
        ) : recorrenciasVisiveis.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum padrão recorrente encontrado com os filtros atuais.
            {confiancaMinima === 'ALTA' ? (
              <p className="mt-2 text-xs">Tente &quot;Média+&quot; ou confira se o backfill de descrição foi concluído.</p>
            ) : null}
          </div>
        ) : (
          <>
            <AnalisesBatchBar
              count={selectedKeys.size}
              busy={loteEmAndamento}
              progress={loteProgress}
              modoConfirmar={precisaoValor === 'IGNORAR_VALOR'}
              onAprovar={() => processarLoteSelecionados('aprovar')}
              onDescartar={() => processarLoteSelecionados('descartar')}
              onLimpar={() => setSelectedKeys(new Set())}
              onCancelar={() => {
                cancelarLoteRef.current = true;
              }}
            />
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  ref={selecionarPaginaRef}
                  type="checkbox"
                  checked={todosPaginaSelecionados}
                  disabled={loteEmAndamento || listaLoading}
                  onChange={toggleSelecionarPagina}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                Selecionar página
              </label>
              {somenteConfiancaPerfeita ? (
                <button
                  type="button"
                  disabled={loteEmAndamento || listaLoading}
                  onClick={selecionarTodosPerfeitosPagina}
                  className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline disabled:opacity-50"
                >
                  Selecionar todos 100%
                </button>
              ) : null}
            </div>
            <ul className={`p-3 space-y-2 transition-opacity ${listaLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            {recorrenciasVisiveis.map((p) => {
              const key = chavePadraoRecorrencia(p);
              return (
                <li key={key}>
                  <RecorrenciaCard
                    padrao={p}
                    fading={fadingKeys.has(key)}
                    busy={busyKey === key}
                    selected={selectedKeys.has(key)}
                    selectionDisabled={loteEmAndamento}
                    onToggleSelect={toggleSelecao}
                    precisaoValor={precisaoValor}
                    lancamentosDivergentes={previewsDivergentes.get(key) ?? []}
                    onAplicar={aplicarPadrao}
                    onDescartar={descartarPadrao}
                  />
                </li>
              );
            })}
            </ul>
          </>
        )}

        {totalElements > 0 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalElements}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(0);
            }}
          />
        ) : null}

        <footer className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80">
          {aprovarTodosProgress ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Aprovando {aprovarTodosProgress.current} de {aprovarTodosProgress.total}…
                </span>
                <span className="tabular-nums">
                  {aprovarTodosProgress.aplicados.toLocaleString('pt-BR')} classificados
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: `${(aprovarTodosProgress.current / aprovarTodosProgress.total) * 100}%`,
                  }}
                />
              </div>
              <button
                type="button"
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                onClick={() => {
                  cancelarAprovarTodosRef.current = true;
                }}
              >
                Cancelar após o lote atual
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={aprovarTodosAlta}
                disabled={
                  precisaoValor !== 'EXATO' ||
                  (confiancaMinima !== 'ALTA' && !somenteConfiancaPerfeita) ||
                  listaLoading ||
                  loteEmAndamento
                }
                className={`text-xs px-3 py-1.5 rounded-md border disabled:opacity-40 ${
                  somenteConfiancaPerfeita
                    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-700'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                aria-label={
                  somenteConfiancaPerfeita
                    ? 'Aprovar todos os padrões com 100% de consistência'
                    : 'Aprovar todos os padrões de alta confiança'
                }
                title={
                  precisaoValor !== 'EXATO'
                    ? 'Disponível apenas no modo Valor: Exato'
                    : confiancaMinima !== 'ALTA' && !somenteConfiancaPerfeita
                      ? 'Disponível com filtro Confiança: Alta'
                      : undefined
                }
              >
                {somenteConfiancaPerfeita
                  ? 'Aprovar todos com 100% consistência'
                  : 'Aprovar todos de alta confiança'}
              </button>
              {somenteConfiancaPerfeita ? (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Aprovação direta, sem revisão
                </span>
              ) : null}
            </div>
          )}
        </footer>
      </section>

      <AplicarRecorrenciaDialog
        open={Boolean(dialogPadrao)}
        padrao={dialogPadrao}
        dryRunResult={dryRunResult}
        loading={aplicando}
        criarRegra={criarRegra}
        onCriarRegraChange={setCriarRegra}
        precisaoValor={precisaoAplicar}
        onConfirm={confirmarAplicar}
        onCancel={() => !aplicando && setDialogPadrao(null)}
      />
    </div>
  );
}
