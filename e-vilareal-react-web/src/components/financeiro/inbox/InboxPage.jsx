import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  aplicarSugestaoClassificacaoApi,
  aplicarSugestoesLoteApi,
  listarContasFinanceiro,
  listarGruposCompensacaoInconsistentesApi,
  listarInboxClassificarPaginaApi,
  listarLancamentosFinanceiroPaginados,
  listarParesSugeridosCompensacaoApi,
  listarSugestoesPagamentoFaturaApi,
  obterSaudeFinanceiroApi,
  parearCompensacaoApi,
} from '../../../repositories/financeiroRepository.js';
import { ETAPAS, INBOX_TIPOS } from '../constants/financeiroConstants.js';
import { useFinanceiro } from '../FinanceiroContext.jsx';
import { PeriodoSelector } from '../shared/PeriodoSelector.jsx';
import {
  isPeriodoAnoInteiro,
  periodoParaAnoMesApi,
  periodoParaMesRefObrigatorio,
  periodoParaQueryApi,
} from '../shared/periodoFinanceiro.js';
import { Pagination } from '../shared/Pagination.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { InboxTabs } from './InboxTabs.jsx';
import { InboxBatchBar } from './InboxBatchBar.jsx';
import { InboxEmptyState } from './InboxEmptyState.jsx';
import { ClassificacaoCard } from './cards/ClassificacaoCard.jsx';
import { ClassificacaoGroupCard } from './cards/ClassificacaoGroupCard.jsx';
import {
  agruparLancamentosClassificacao,
  filtrarSugestoesClassificacao,
  melhorSugestao,
} from './inboxClassificacaoGrupos.js';
import { CompensacaoCard } from './cards/CompensacaoCard.jsx';
import { InconsistenciaCard } from './cards/InconsistenciaCard.jsx';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { scrollInboxCardIntoView, useInboxKeyboard } from '../hooks/useInboxKeyboard.js';
import {
  filtrarParesCompensacao,
  mapLancamentoInbox,
  mapParCompensacaoParaUi,
  parKey,
} from './inboxMappers.js';

const TIPOS_VALIDOS = new Set(Object.values(INBOX_TIPOS));
const FADE_MS = 280;
const COMPENSAR_PAGE_SIZE = 25;
const COUNTS_DEBOUNCE_MS = 500;

/** Valores de filters.tipoPar (URL ?tipoPar=) na aba Compensar. */
const TIPO_PAR_TODOS = 'TODOS';

const TIPO_DIA_TODOS = 'TODOS';

function queryFiltroTipoPar(tipoPar) {
  if (tipoPar === 'INTERBANCARIO') {
    return { apenasInterbancario: true, apenasMesmoBanco: false };
  }
  if (tipoPar === 'MESMO_BANCO') {
    return { apenasInterbancario: false, apenasMesmoBanco: true };
  }
  return { apenasInterbancario: false, apenasMesmoBanco: false };
}

function queryFiltroTipoDia(tipoDia) {
  if (tipoDia === 'MESMO_DIA') {
    return { apenasMesmoDiaCalendario: true, apenasDiaDivergente: false };
  }
  if (tipoDia === 'DIVERGENTE') {
    return { apenasMesmoDiaCalendario: false, apenasDiaDivergente: true };
  }
  return { apenasMesmoDiaCalendario: false, apenasDiaDivergente: false };
}

function normalizeSugestoesMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[Number(k)] = filtrarSugestoesClassificacao(Array.isArray(v) ? v : []);
  }
  return out;
}

export function InboxPage() {
  const { tipo: tipoParam } = useParams();
  const tipo = TIPOS_VALIDOS.has(tipoParam) ? tipoParam : INBOX_TIPOS.classificar;
  const { bancos, bancoAtivo, filters, setBanco, setMes, setTipoPar, setTipoDia } = useFinanceiro();
  const toast = useFinanceiroToast();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  const [counts, setCounts] = useState({});
  const [contas, setContas] = useState([]);

  const [lancamentos, setLancamentos] = useState([]);
  const [sugestoesMap, setSugestoesMap] = useState({});
  const [pares, setPares] = useState([]);
  const [grupos, setGrupos] = useState([]);

  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selected, setSelected] = useState(() => new Set());
  const [skipped, setSkipped] = useState(() => new Set());
  const [fading, setFading] = useState(() => new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef(null);
  const countsDebounceRef = useRef(null);
  const refazerRelatorioPendenteRef = useRef(false);

  const [reloadNonce, setReloadNonce] = useState(0);
  const [refazendoRelatorio, setRefazendoRelatorio] = useState(false);

  const periodo = useMemo(() => periodoParaQueryApi(filters.mes), [filters.mes]);
  const periodoAnoMes = useMemo(() => periodoParaAnoMesApi(filters.mes), [filters.mes]);
  const bancoFiltro = useMemo(() => {
    if (!Number.isFinite(bancoAtivo)) return undefined;
    return bancoAtivo;
  }, [bancoAtivo]);

  const filtroTipoPar = filters.tipoPar ?? TIPO_PAR_TODOS;
  const filtroTipoDia = filters.tipoDia ?? TIPO_DIA_TODOS;
  const queryTipoPar = useMemo(() => queryFiltroTipoPar(filtroTipoPar), [filtroTipoPar]);
  const queryTipoDia = useMemo(() => queryFiltroTipoDia(filtroTipoDia), [filtroTipoDia]);
  const queryCompensar = useMemo(
    () => ({ ...queryTipoPar, ...queryTipoDia }),
    [queryTipoPar, queryTipoDia],
  );

  const chaveFiltrosCompensar = useMemo(
    () => [filters.mes, bancoFiltro ?? '', filtroTipoPar, filtroTipoDia].join('|'),
    [filters.mes, bancoFiltro, filtroTipoPar, filtroTipoDia],
  );

  const chaveListaCompensar = useMemo(
    () =>
      [
        chaveFiltrosCompensar,
        page,
        Math.min(pageSize, COMPENSAR_PAGE_SIZE),
      ].join('|'),
    [chaveFiltrosCompensar, page, pageSize],
  );

  const cargaCompensarRef = useRef(null);
  const chaveFiltrosCompensarRef = useRef(chaveFiltrosCompensar);

  const loadCounts = useCallback(
    async (signal) => {
      const [classificarRes, fatura, saude, inconsistentesRes] = await Promise.all([
        listarLancamentosFinanceiroPaginados(
          {
            page: 0,
            size: 1,
            etapa: ETAPAS.IMPORTADO,
            ...periodo,
            numeroBanco: bancoFiltro,
          },
          { signal },
        ),
        listarSugestoesPagamentoFaturaApi(periodoParaMesRefObrigatorio(filters.mes), {
          signal,
          page: 0,
          size: 1,
        }),
        obterSaudeFinanceiroApi({ signal }),
        listarGruposCompensacaoInconsistentesApi({
          page: 0,
          size: 1,
          ...periodoAnoMes,
          numeroBanco: bancoFiltro,
          signal,
        }),
      ]);

      setCounts((prev) => ({
        [INBOX_TIPOS.classificar]: Number(classificarRes?.totalElements ?? 0),
        [INBOX_TIPOS.compensar]:
          tipo === INBOX_TIPOS.compensar && prev[INBOX_TIPOS.compensar] != null
            ? prev[INBOX_TIPOS.compensar]
            : Number(saude?.paresOrfaosSugeridos ?? 0),
        [INBOX_TIPOS.fatura]: Number(fatura?.totalSugestoes ?? 0),
        [INBOX_TIPOS.inconsistentes]: Number(inconsistentesRes?.total ?? 0),
      }));
    },
    [filters.mes, periodo, periodoAnoMes, bancoFiltro, tipo],
  );

  const scheduleLoadCounts = useCallback(() => {
    if (countsDebounceRef.current) clearTimeout(countsDebounceRef.current);
    countsDebounceRef.current = setTimeout(() => {
      countsDebounceRef.current = null;
      loadCounts().catch(() => {});
    }, COUNTS_DEBOUNCE_MS);
  }, [loadCounts]);

  const patchCount = useCallback((inboxTipo, delta) => {
    setCounts((c) => ({
      ...c,
      [inboxTipo]: Math.max(0, Number(c[inboxTipo] ?? 0) + delta),
    }));
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setLoading(false);
      setErro('API financeiro desativada.');
      return undefined;
    }
    const ac = new AbortController();
    listarContasFinanceiro({ signal: ac.signal })
      .then((rows) => setContas((rows || []).filter((c) => c.ativo !== false)))
      .catch(() => setContas([]));
    loadCounts(ac.signal).catch(() => {});
    return () => ac.abort();
  }, [loadCounts]);

  useEffect(
    () => () => {
      if (countsDebounceRef.current) clearTimeout(countsDebounceRef.current);
    },
    [],
  );

  useEffect(() => {
    setPage(0);
    setSelected(new Set());
    setFocusedIndex(-1);
    if (tipo === INBOX_TIPOS.compensar) {
      setPares([]);
      setPageSize((s) => (s > COMPENSAR_PAGE_SIZE ? COMPENSAR_PAGE_SIZE : s));
    }
  }, [tipo, filters.mes, bancoAtivo, filtroTipoPar, filtroTipoDia]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setErro('');

    const run = async () => {
      try {
        if (tipo === INBOX_TIPOS.compensar) {
          const filtrosMudaram = chaveFiltrosCompensarRef.current !== chaveFiltrosCompensar;
          chaveFiltrosCompensarRef.current = chaveFiltrosCompensar;
          if (filtrosMudaram && page !== 0) {
            setPage(0);
            return;
          }
        }

        if (tipo === INBOX_TIPOS.classificar) {
          setLancamentos([]);
          const res = await listarInboxClassificarPaginaApi(
            {
              page,
              size: pageSize,
              ...periodoAnoMes,
              numeroBanco: bancoFiltro,
              sort: 'dataLancamento,desc',
            },
            { signal: ac.signal },
          );
          const content = res?.content ?? [];
          const rows = content.map(mapLancamentoInbox);
          setLancamentos(rows);
          setTotalElements(Number(res?.totalElements ?? rows.length));
          setTotalPages(Number(res?.totalPages ?? 1));
          setSugestoesMap(normalizeSugestoesMap(res?.sugestoes));
          return;
        }

        if (tipo === INBOX_TIPOS.compensar) {
          const token = chaveListaCompensar;
          cargaCompensarRef.current = token;
          const res = await listarParesSugeridosCompensacaoApi({
            page,
            size: Math.min(pageSize, COMPENSAR_PAGE_SIZE),
            ...periodoAnoMes,
            numeroBanco: bancoFiltro,
            ...queryCompensar,
            signal: ac.signal,
          });
          if (cancelled || cargaCompensarRef.current !== token) return;
          const paresFiltrados = filtrarParesCompensacao(res?.pares ?? [], {
            tipoPar: filtroTipoPar,
            tipoDia: filtroTipoDia,
            periodo: filters.mes,
          });
          const total = Number(res?.totalPares ?? paresFiltrados.length);
          startTransition(() => {
            if (cargaCompensarRef.current !== token) return;
            setPares(paresFiltrados);
            setTotalElements(
              paresFiltrados.length < (res?.pares?.length ?? 0) ? paresFiltrados.length : total,
            );
            setTotalPages(Math.max(1, Number(res?.totalPages ?? 1)));
            setCounts((c) => ({
              ...c,
              [INBOX_TIPOS.compensar]:
                paresFiltrados.length < (res?.pares?.length ?? 0) ? paresFiltrados.length : total,
            }));
          });
          return;
        }

        if (tipo === INBOX_TIPOS.inconsistentes) {
          const res = await listarGruposCompensacaoInconsistentesApi({
            page,
            size: Math.min(pageSize, 20),
            ...periodoAnoMes,
            numeroBanco: bancoFiltro,
            signal: ac.signal,
          });
          const gruposLista = res?.grupos ?? [];
          setGrupos(gruposLista);
          const total = Number(res?.total ?? gruposLista.length);
          setTotalElements(total);
          setTotalPages(Math.max(1, Number(res?.totalPages ?? 1)));
          setCounts((c) => ({ ...c, [INBOX_TIPOS.inconsistentes]: total }));
          return;
        }

        setLancamentos([]);
        setPares([]);
        setGrupos([]);
        setTotalElements(0);
        setTotalPages(1);
      } catch (e) {
        if (cancelled || e?.name === 'AbortError') return;
        setErro(e?.message || 'Falha ao carregar inbox.');
        if (refazerRelatorioPendenteRef.current && tipo === INBOX_TIPOS.classificar) {
          refazerRelatorioPendenteRef.current = false;
          setRefazendoRelatorio(false);
          toast.error('Não foi possível refazer o relatório de classificação.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (refazerRelatorioPendenteRef.current && tipo === INBOX_TIPOS.classificar) {
            refazerRelatorioPendenteRef.current = false;
            setRefazendoRelatorio(false);
            loadCounts().catch(() => {});
            dispatchRefreshPendentes();
            const mesLabel = isPeriodoAnoInteiro(filters.mes)
              ? `ano ${filters.mes}`
              : String(filters.mes ?? '').replace(/^(\d{4})-(\d{2})$/, '$2/$1');
            toast.success(
              `Relatório de classificação atualizado${mesLabel ? ` (${mesLabel})` : ''}.`,
            );
          }
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    tipo,
    page,
    pageSize,
    periodo,
    periodoAnoMes,
    bancoFiltro,
    queryCompensar,
    chaveListaCompensar,
    chaveFiltrosCompensar,
    filtroTipoPar,
    filtroTipoDia,
    filters.mes,
    reloadNonce,
    loadCounts,
    toast,
  ]);

  const removeComFade = useCallback((keys, updater) => {
    setFading((prev) => new Set([...prev, ...keys]));
    window.setTimeout(() => {
      updater();
      setFading((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
      setSelected((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
    }, FADE_MS);
  }, []);

  const handleAprovarClassificacao = useCallback(
    async (body) => {
      setBusy(true);
      try {
        await aplicarSugestaoClassificacaoApi(body);
        const cod =
          contas.find((c) => c.id === body.contaContabilId)?.codigo ??
          sugestoesMap[body.lancamentoId]?.[0]?.contaCodigo ??
          '';
        toast.success(
          cod ? `Lançamento classificado como ${String(cod).toUpperCase()}` : 'Classificação aplicada.',
        );
        removeComFade([body.lancamentoId], () => {
          setLancamentos((prev) => prev.filter((l) => l.id !== body.lancamentoId));
          setTotalElements((t) => Math.max(0, t - 1));
        });
        patchCount(INBOX_TIPOS.classificar, -1);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
      } catch (e) {
        toast.error(`Falha ao classificar: ${e?.message || 'erro desconhecido'}`);
      } finally {
        setBusy(false);
      }
    },
    [toast, removeComFade, patchCount, scheduleLoadCounts, contas, sugestoesMap],
  );

  const handleParear = useCallback(
    async (par) => {
      const idA = par.lancamentoA?.id;
      const idB = par.lancamentoB?.id;
      if (!idA || !idB) return;
      setBusy(true);
      try {
        await parearCompensacaoApi({ pares: [{ lancamentoIdA: idA, lancamentoIdB: idB }] });
        toast.success('Par compensado com sucesso');
        const key = parKey(par);
        removeComFade([key], () => {
          setPares((prev) => prev.filter((p) => parKey(p) !== key));
          setTotalElements((t) => Math.max(0, t - 1));
        });
        patchCount(INBOX_TIPOS.compensar, -1);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
      } catch (e) {
        toast.error(`Falha ao parear: ${e?.message || 'erro desconhecido'}`);
      } finally {
        setBusy(false);
      }
    },
    [toast, removeComFade, patchCount, scheduleLoadCounts],
  );

  const handleBatchAprovar = useCallback(async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      if (tipo === INBOX_TIPOS.classificar) {
        const aplicacoes = [];
        for (const id of selected) {
          const sug = melhorSugestao(sugestoesMap[id]);
          if (!sug?.contaContabilId) continue;
          aplicacoes.push({
            lancamentoId: id,
            contaContabilId: sug.contaContabilId,
            clienteId: sug.clienteId ?? null,
            processoId: sug.processoId ?? null,
          });
        }
        if (!aplicacoes.length) {
          toast.warn('Nenhum item selecionado tem sugestão para aplicar.');
          return;
        }
        const res = await aplicarSugestoesLoteApi(aplicacoes);
        const ok = Number(res?.aplicados ?? aplicacoes.length);
        toast.success(`${ok} lançamento${ok !== 1 ? 's' : ''} classificados`);
        const ids = aplicacoes.map((a) => a.lancamentoId);
        removeComFade(ids, () => {
          setLancamentos((prev) => prev.filter((l) => !ids.includes(l.id)));
          setTotalElements((t) => Math.max(0, t - ids.length));
        });
        patchCount(INBOX_TIPOS.classificar, -ids.length);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
        return;
      }

      if (tipo === INBOX_TIPOS.compensar) {
        const paresBody = [];
        for (const key of selected) {
          const par = pares.find((p) => parKey(p) === key);
          if (!par) continue;
          paresBody.push({
            lancamentoIdA: par.lancamentoA?.id,
            lancamentoIdB: par.lancamentoB?.id,
          });
        }
        if (!paresBody.length) return;
        await parearCompensacaoApi({ pares: paresBody });
        toast.success(`${paresBody.length} pares compensados com sucesso`);
        removeComFade([...selected], () => {
          setPares((prev) => prev.filter((p) => !selected.has(parKey(p))));
          setTotalElements((t) => Math.max(0, t - paresBody.length));
        });
        patchCount(INBOX_TIPOS.compensar, -paresBody.length);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
      }
    } catch (e) {
      toast.error(e?.message || 'Erro na ação em lote.');
    } finally {
      setBusy(false);
    }
  }, [tipo, selected, sugestoesMap, pares, toast, removeComFade, patchCount, scheduleLoadCounts]);

  const handleBatchPular = useCallback(() => {
    const keys = [...selected];
    if (!keys.length) return;
    setSkipped((prev) => new Set([...prev, ...keys]));
    setSelected(new Set());
  }, [selected]);

  const lancamentosVisiveis = useMemo(
    () => lancamentos.filter((l) => !skipped.has(l.id) && !fading.has(l.id)),
    [lancamentos, skipped, fading],
  );

  const classificacaoAgrupada = useMemo(
    () => agruparLancamentosClassificacao(lancamentosVisiveis, sugestoesMap),
    [lancamentosVisiveis, sugestoesMap],
  );

  const handleAprovarGrupo = useCallback(
    async (grupo) => {
      const sug = grupo.sugestao;
      if (!sug?.contaContabilId) return;
      setBusy(true);
      try {
        const aplicacoes = grupo.lancamentos.map((l) => ({
          lancamentoId: l.id,
          contaContabilId: sug.contaContabilId,
          clienteId: sug.clienteId ?? null,
          processoId: sug.processoId ?? null,
        }));
        const res = await aplicarSugestoesLoteApi(aplicacoes);
        const cod =
          sug.contaCodigo ??
          contas.find((c) => c.id === sug.contaContabilId)?.codigo ??
          '—';
        const ok = Number(res?.aplicados ?? aplicacoes.length);
        toast.success(`${ok} lançamento${ok !== 1 ? 's' : ''} classificados como ${cod}`);
        const ids = aplicacoes.map((a) => a.lancamentoId);
        removeComFade(ids, () => {
          setLancamentos((prev) => prev.filter((l) => !ids.includes(l.id)));
          setTotalElements((t) => Math.max(0, t - ids.length));
        });
        patchCount(INBOX_TIPOS.classificar, -ids.length);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
      } catch (e) {
        toast.error(`Falha ao classificar grupo: ${e?.message || 'erro desconhecido'}`);
      } finally {
        setBusy(false);
      }
    },
    [toast, removeComFade, patchCount, scheduleLoadCounts, contas],
  );

  const handlePularIds = useCallback((ids) => {
    if (!ids?.length) return;
    setSkipped((prev) => new Set([...prev, ...ids]));
  }, []);

  const paresVisiveis = useMemo(() => {
    const filtros = {
      tipoPar: filtroTipoPar,
      tipoDia: filtroTipoDia,
      periodo: filters.mes,
    };
    return filtrarParesCompensacao(pares, filtros).filter(
      (p) => !skipped.has(parKey(p)) && !fading.has(parKey(p)),
    );
  }, [pares, skipped, fading, filtroTipoPar, filtroTipoDia, filters.mes]);

  const paresUi = useMemo(() => paresVisiveis.map(mapParCompensacaoParaUi), [paresVisiveis]);

  const gruposVisiveis = useMemo(
    () =>
      grupos.filter(
        (g) => !skipped.has(g.grupoCompensacao) && !fading.has(g.grupoCompensacao),
      ),
    [grupos, skipped, fading],
  );

  const itensNavegaveis = useMemo(() => {
    if (tipo === INBOX_TIPOS.classificar) {
      return lancamentosVisiveis;
    }
    if (tipo === INBOX_TIPOS.compensar) {
      return pares.filter((p) => !skipped.has(parKey(p)));
    }
    return [];
  }, [tipo, lancamentosVisiveis, pares, skipped]);

  const onAprovarFocado = useCallback(() => {
    const item = itensNavegaveis[focusedIndex];
    if (!item || busy) return;
    if (tipo === INBOX_TIPOS.classificar) {
      const sug = melhorSugestao(sugestoesMap[item.id]);
      if (!sug?.contaContabilId) {
        toast.warn('Sem sugestão para aprovar neste card.');
        return;
      }
      handleAprovarClassificacao({
        lancamentoId: item.id,
        contaContabilId: sug.contaContabilId,
        clienteId: sug.clienteId ?? null,
        processoId: sug.processoId ?? null,
      });
      return;
    }
    if (tipo === INBOX_TIPOS.compensar) {
      handleParear(item);
    }
  }, [
    itensNavegaveis,
    focusedIndex,
    busy,
    tipo,
    sugestoesMap,
    handleAprovarClassificacao,
    handleParear,
    toast,
  ]);

  const onPularFocado = useCallback(() => {
    const item = itensNavegaveis[focusedIndex];
    if (!item) return;
    if (tipo === INBOX_TIPOS.classificar) {
      setSkipped((s) => new Set([...s, item.id]));
    } else if (tipo === INBOX_TIPOS.compensar) {
      setSkipped((s) => new Set([...s, parKey(item)]));
    }
    setFocusedIndex((i) => Math.min(i, itensNavegaveis.length - 2));
  }, [itensNavegaveis, focusedIndex, tipo]);

  const onToggleSelecaoFocado = useCallback(() => {
    const item = itensNavegaveis[focusedIndex];
    if (!item) return;
    if (tipo === INBOX_TIPOS.classificar) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } else if (tipo === INBOX_TIPOS.compensar) {
      const key = parKey(item);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  }, [itensNavegaveis, focusedIndex, tipo]);

  useInboxKeyboard({
    tipo,
    enabled: !loading && !erro && itensNavegaveis.length > 0,
    focusedIndex,
    setFocusedIndex,
    itemCount: itensNavegaveis.length,
    onAprovarFocado,
    onPularFocado,
    onToggleSelecaoFocado,
    onAprovarTodos: handleBatchAprovar,
  });

  useEffect(() => {
    scrollInboxCardIntoView(focusedIndex);
  }, [focusedIndex]);

  useEffect(() => {
    const onLimpar = () => setSelected(new Set());
    window.addEventListener('financeiro:limpar-selecao', onLimpar);
    return () => window.removeEventListener('financeiro:limpar-selecao', onLimpar);
  }, []);

  const handleRefazerRelatorio = useCallback(() => {
    if (refazendoRelatorio || busy || loading) return;
    refazerRelatorioPendenteRef.current = true;
    setRefazendoRelatorio(true);
    setSkipped(new Set());
    setSelected(new Set());
    setFocusedIndex(-1);
    setPage(0);
    setReloadNonce((n) => n + 1);
  }, [refazendoRelatorio, busy, loading]);

  const showBatch = tipo === INBOX_TIPOS.classificar || tipo === INBOX_TIPOS.compensar;
  const empty =
    !loading &&
    !erro &&
    (tipo === INBOX_TIPOS.classificar
      ? classificacaoAgrupada.grupos.length === 0 &&
        classificacaoAgrupada.individuais.length === 0 &&
        classificacaoAgrupada.semSugestao.length === 0
      : tipo === INBOX_TIPOS.compensar
        ? paresVisiveis.length === 0
        : tipo === INBOX_TIPOS.inconsistentes
          ? gruposVisiveis.length === 0
          : Number(counts[INBOX_TIPOS.fatura] ?? 0) === 0);

  if (!featureFlags.useApiFinanceiro) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-400">{erro}</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <InboxTabs counts={counts} />

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <PeriodoSelector value={filters.mes} onChange={setMes} />
        <select
          value={bancoAtivo ?? ''}
          onChange={(e) => setBanco(e.target.value ? Number(e.target.value) : null)}
          className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
          aria-label="Filtrar banco"
        >
          <option value="">Todos os bancos</option>
          {bancos.map((b) => (
            <option key={b.numero} value={b.numero}>
              {b.nome}
            </option>
          ))}
        </select>
        {tipo === INBOX_TIPOS.compensar ? (
          <select
            value={filtroTipoPar}
            onChange={(e) => setTipoPar(e.target.value)}
            className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
            aria-label="Filtrar tipo de par"
          >
            <option value={TIPO_PAR_TODOS}>Mesmo banco e interbancário</option>
            <option value="MESMO_BANCO">Mesmo banco apenas</option>
            <option value="INTERBANCARIO">Interbancário apenas</option>
          </select>
        ) : null}
        {tipo === INBOX_TIPOS.compensar ? (
          <select
            value={filtroTipoDia}
            onChange={(e) => setTipoDia(e.target.value)}
            className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
            aria-label="Filtrar data do par"
          >
            <option value={TIPO_DIA_TODOS}>Mesmo dia e divergente</option>
            <option value="MESMO_DIA">Mesmo dia (exato)</option>
            <option value="DIVERGENTE">Dia divergente</option>
          </select>
        ) : null}
        {tipo === INBOX_TIPOS.classificar ? (
          <button
            type="button"
            onClick={handleRefazerRelatorio}
            disabled={refazendoRelatorio || busy}
            className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            title="Recarrega grupos e sugestões de classificação para o período e banco selecionados"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refazendoRelatorio ? 'animate-spin' : ''}`}
              aria-hidden
            />
            {refazendoRelatorio ? 'Atualizando…' : 'Refazer relatório'}
          </button>
        ) : null}
      </div>

      {showBatch ? (
        <InboxBatchBar
          count={selected.size}
          onAprovarTodos={handleBatchAprovar}
          onPular={handleBatchPular}
          aprovarLabel={tipo === INBOX_TIPOS.compensar ? 'Parear todos' : 'Aprovar todos'}
          busy={busy}
        />
      ) : null}

      <div ref={listRef} className="flex-1 min-h-0 overflow-auto p-3">
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Carregando…</p>
        ) : erro ? (
          <p className="text-sm text-red-600 dark:text-red-400 p-4">{erro}</p>
        ) : empty ? (
          <InboxEmptyState tipo={tipo} />
        ) : tipo === INBOX_TIPOS.classificar ? (
          <>
            {classificacaoAgrupada.grupos.map((grupo, idx) => {
              const ids = grupo.lancamentos.map((l) => l.id);
              const grupoFading = ids.some((id) => fading.has(id));
              return (
                <div key={grupo.chave} data-inbox-card-index={idx}>
                  <ClassificacaoGroupCard
                    grupo={grupo}
                    sugestoesMap={sugestoesMap}
                    contas={contas}
                    onAprovarGrupo={handleAprovarGrupo}
                    onAprovar={handleAprovarClassificacao}
                    onPularGrupo={handlePularIds}
                    isSelected={ids.length > 0 && ids.every((id) => selected.has(id))}
                    onSelectGrupo={(lancIds, on) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const id of lancIds) {
                          if (on) next.add(id);
                          else next.delete(id);
                        }
                        return next;
                      });
                    }}
                    fading={grupoFading}
                    busy={busy}
                  />
                </div>
              );
            })}
            {classificacaoAgrupada.individuais.map((l, idx) => {
                const cardIdx = classificacaoAgrupada.grupos.length + idx;
                return (
                  <div key={l.id} data-inbox-card-index={cardIdx}>
                    <ClassificacaoCard
                      lancamento={l}
                      sugestoes={sugestoesMap[l.id] ?? []}
                      contas={contas}
                      onAprovar={handleAprovarClassificacao}
                      onPular={(id) => setSkipped((s) => new Set([...s, id]))}
                      isSelected={selected.has(l.id)}
                      focused={cardIdx === focusedIndex}
                      onSelect={(id, on) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(id);
                          else next.delete(id);
                          return next;
                        });
                      }}
                      fading={fading.has(l.id)}
                      busy={busy}
                    />
                  </div>
                );
              },
            )}
            {classificacaoAgrupada.semSugestao.map((l, idx) => {
              const cardIdx =
                classificacaoAgrupada.grupos.length + classificacaoAgrupada.individuais.length + idx;
              return (
                <div key={l.id} data-inbox-card-index={cardIdx}>
                  <ClassificacaoCard
                    lancamento={l}
                    sugestoes={sugestoesMap[l.id] ?? []}
                    contas={contas}
                    onAprovar={handleAprovarClassificacao}
                    onPular={(id) => setSkipped((s) => new Set([...s, id]))}
                    isSelected={selected.has(l.id)}
                    focused={cardIdx === focusedIndex}
                    onSelect={(id, on) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(id);
                        else next.delete(id);
                        return next;
                      });
                    }}
                    fading={fading.has(l.id)}
                    busy={busy}
                  />
                </div>
              );
            })}
          </>
        ) : tipo === INBOX_TIPOS.compensar ? (
          paresUi.map((ui, idx) => (
            <div key={ui.key} data-inbox-card-index={idx}>
              <CompensacaoCard
                ui={ui}
                onParear={() => handleParear(ui.par)}
                onRejeitar={() => setSkipped((s) => new Set([...s, ui.key]))}
                onPular={() => setSkipped((s) => new Set([...s, ui.key]))}
                isSelected={selected.has(ui.key)}
                focused={idx === focusedIndex}
                onSelect={(on) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(ui.key);
                    else next.delete(ui.key);
                    return next;
                  });
                }}
                fading={fading.has(ui.key)}
                busy={busy}
              />
            </div>
          ))
        ) : tipo === INBOX_TIPOS.inconsistentes ? (
          grupos
            .filter((g) => !skipped.has(g.grupoCompensacao))
            .map((g) => (
              <InconsistenciaCard
                key={g.grupoCompensacao}
                grupo={g}
                onIgnorar={(id) => setSkipped((s) => new Set([...s, id]))}
                fading={fading.has(g.grupoCompensacao)}
              />
            ))
        ) : empty ? (
          <InboxEmptyState tipo={tipo} />
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">
            {Number(counts[INBOX_TIPOS.fatura] ?? 0).toLocaleString('pt-BR')} sugestões de fatura — interface em breve.
          </p>
        )}
      </div>

      {!empty && tipo !== INBOX_TIPOS.fatura ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={
            tipo === INBOX_TIPOS.inconsistentes
              ? Math.min(pageSize, 20)
              : tipo === INBOX_TIPOS.compensar
                ? Math.min(pageSize, COMPENSAR_PAGE_SIZE)
                : pageSize
          }
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(0);
          }}
          totalItems={totalElements}
        />
      ) : null}
    </div>
  );
}
