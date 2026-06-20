import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  aplicarSugestaoClassificacaoApi,
  aplicarSugestoesLoteApi,
  listarContasFinanceiro,
  listarGruposCompensacaoInconsistentesApi,
  listarInboxClassificarPaginaApi,
  listarInboxSemelhantesApi,
  listarLancamentosFinanceiroPaginados,
  listarParesSugeridosCompensacaoApi,
  listarSugestoesPagamentoFaturaApi,
  obterSaudeFinanceiroApi,
  parearCompensacaoApi,
  descartarParesCompensacaoApi,
  descartarSemelhantesEscritorioApi,
  sugestoesClassificacaoLoteApi,
} from '../../../repositories/financeiroRepository.js';
import { INBOX_TIPOS, clampFinanceiroPageSize } from '../constants/financeiroConstants.js';
import { isNumeroCartaoFinanceiro } from '../../../data/financeiroData.js';
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
  coletarIdsClassificacaoVisivel,
  contagemPorLetraSugestao,
  filtrarClassificacaoPorLetra,
  filtrarSugestoesClassificacao,
  LETRA_SUGESTAO_SEM,
  LETRA_SUGESTAO_TODAS,
  melhorSugestao,
} from './inboxClassificacaoGrupos.js';
import { CompensacaoCard } from './cards/CompensacaoCard.jsx';
import { InconsistenciaCard } from './cards/InconsistenciaCard.jsx';
import { SemelhantesEscritorioGroupCard } from './cards/SemelhantesEscritorioGroupCard.jsx';
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
  const { bancos, cartoes, bancoAtivo, filters, setBanco, setMes, setTipoPar, setTipoDia, setLetraSugestao } =
    useFinanceiro();
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
  const [semelhantesGrupos, setSemelhantesGrupos] = useState([]);

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
  const [refatorandoIds, setRefatorandoIds] = useState(() => new Set());
  const [contaLoteId, setContaLoteId] = useState('');

  const periodo = useMemo(() => periodoParaQueryApi(filters.mes), [filters.mes]);
  const periodoAnoMes = useMemo(() => periodoParaAnoMesApi(filters.mes), [filters.mes]);
  const bancoFiltro = useMemo(() => {
    if (!Number.isFinite(bancoAtivo)) return undefined;
    if (isNumeroCartaoFinanceiro(bancoAtivo)) return undefined;
    return bancoAtivo;
  }, [bancoAtivo]);

  const cartaoFiltro = useMemo(() => {
    if (!Number.isFinite(bancoAtivo)) return undefined;
    if (!isNumeroCartaoFinanceiro(bancoAtivo)) return undefined;
    return bancoAtivo;
  }, [bancoAtivo]);

  const filtroInboxConta = useMemo(
    () => ({
      numeroBanco: bancoFiltro,
      numeroCartao: cartaoFiltro,
    }),
    [bancoFiltro, cartaoFiltro],
  );

  const filtroTipoPar = filters.tipoPar ?? TIPO_PAR_TODOS;
  const filtroTipoDia = filters.tipoDia ?? TIPO_DIA_TODOS;
  const filtroLetraSugestao = filters.letraSugestao ?? LETRA_SUGESTAO_TODAS;
  const queryTipoPar = useMemo(() => queryFiltroTipoPar(filtroTipoPar), [filtroTipoPar]);
  const queryTipoDia = useMemo(() => queryFiltroTipoDia(filtroTipoDia), [filtroTipoDia]);
  const queryCompensar = useMemo(
    () => ({ ...queryTipoPar, ...queryTipoDia }),
    [queryTipoPar, queryTipoDia],
  );

  const chaveFiltrosCompensar = useMemo(
    () => [filters.mes, bancoFiltro ?? '', cartaoFiltro ?? '', filtroTipoPar, filtroTipoDia].join('|'),
    [filters.mes, bancoFiltro, cartaoFiltro, filtroTipoPar, filtroTipoDia],
  );

  const pageSizeEfetivo = useMemo(() => clampFinanceiroPageSize(pageSize), [pageSize]);

  const chaveListaCompensar = useMemo(
    () => [chaveFiltrosCompensar, page, pageSizeEfetivo].join('|'),
    [chaveFiltrosCompensar, page, pageSizeEfetivo],
  );

  const cargaCompensarRef = useRef(null);
  const chaveFiltrosCompensarRef = useRef(chaveFiltrosCompensar);

  const loadCounts = useCallback(
    async (signal) => {
      const [classificarRes, fatura, saude, inconsistentesRes, semelhantesRes] = await Promise.all([
        listarInboxClassificarPaginaApi(
          {
            page: 0,
            size: 1,
            ...periodoAnoMes,
            ...filtroInboxConta,
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
        listarInboxSemelhantesApi(
          {
            page: 0,
            size: 1,
            ...periodoAnoMes,
            numeroBanco: bancoFiltro,
          },
          { signal },
        ).catch(() => ({ totalItensAcionaveis: 0 })),
      ]);

      setCounts((prev) => ({
        [INBOX_TIPOS.classificar]: Number(classificarRes?.totalElements ?? 0),
        [INBOX_TIPOS.compensar]:
          tipo === INBOX_TIPOS.compensar && prev[INBOX_TIPOS.compensar] != null
            ? prev[INBOX_TIPOS.compensar]
            : Number(saude?.paresOrfaosSugeridos ?? 0),
        [INBOX_TIPOS.fatura]: Number(fatura?.totalSugestoes ?? 0),
        [INBOX_TIPOS.inconsistentes]: Number(inconsistentesRes?.total ?? 0),
        [INBOX_TIPOS.semelhantes]: Number(semelhantesRes?.totalItensAcionaveis ?? 0),
      }));
    },
    [filters.mes, periodoAnoMes, filtroInboxConta, tipo],
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
    setContaLoteId('');
    if (tipo === INBOX_TIPOS.compensar) {
      setPares([]);
    }
    if (tipo === INBOX_TIPOS.semelhantes) {
      setSemelhantesGrupos([]);
    }
  }, [tipo, filters.mes, bancoAtivo, filtroTipoPar, filtroTipoDia, filtroLetraSugestao]);

  const contasClassificacao = useMemo(
    () =>
      contas
        .filter((c) => String(c.codigo ?? '').trim().toUpperCase() !== 'N')
        .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR')),
    [contas],
  );

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
              ...filtroInboxConta,
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
            size: pageSizeEfetivo,
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
            setTotalElements(total);
            setTotalPages(Math.max(1, Number(res?.totalPages ?? 1)));
            setCounts((c) => ({
              ...c,
              [INBOX_TIPOS.compensar]: total,
            }));
          });
          return;
        }

        if (tipo === INBOX_TIPOS.semelhantes) {
          const res = await listarInboxSemelhantesApi(
            {
              page,
              size: pageSize,
              ...periodoAnoMes,
              numeroBanco: bancoFiltro,
            },
            { signal: ac.signal },
          );
          const lista = res?.content ?? [];
          setSemelhantesGrupos(lista);
          setTotalElements(Number(res?.totalElements ?? lista.length));
          setTotalPages(Math.max(1, Number(res?.totalPages ?? 1)));
          setCounts((c) => ({
            ...c,
            [INBOX_TIPOS.semelhantes]: Number(res?.totalItensAcionaveis ?? 0),
          }));
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
    pageSizeEfetivo,
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

  const chaveGrupoSemelhantes = useCallback(
    (g) => `${g?.descricaoNorm ?? ''}|${g?.numeroBanco ?? ''}|${g?.valor ?? ''}`,
    [],
  );

  const aplicarSemelhantesItens = useCallback(
    async (itens) => {
      const aplicacoes = (itens ?? [])
        .filter((i) => i?.lancamentoId && i?.contaContabilId && i?.sugestaoClienteId && i?.sugestaoProcessoId)
        .map((i) => ({
          lancamentoId: i.lancamentoId,
          contaContabilId: i.contaContabilId,
          clienteId: i.sugestaoClienteId,
          processoId: i.sugestaoProcessoId,
        }));
      if (!aplicacoes.length) {
        toast.warn('Nenhum vínculo válido para aplicar.');
        return;
      }
      setBusy(true);
      try {
        const res = await aplicarSugestoesLoteApi(aplicacoes);
        const ok = Number(res?.aplicados ?? aplicacoes.length);
        const ids = aplicacoes.map((a) => a.lancamentoId);
        toast.success(
          ok === 1
            ? '1 lançamento vinculado na Conta Escritório.'
            : `${ok.toLocaleString('pt-BR')} lançamentos vinculados na Conta Escritório.`,
        );
        removeComFade(ids, () => {
          setSemelhantesGrupos((prev) => {
            const next = prev
              .map((g) => ({
                ...g,
                itens: (g.itens ?? []).filter((i) => !ids.includes(i.lancamentoId)),
              }))
              .filter((g) => (g.itens ?? []).length > 0);
            setTotalElements(next.length);
            return next;
          });
        });
        patchCount(INBOX_TIPOS.semelhantes, -ok);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
      } catch (e) {
        toast.error(e?.message || 'Falha ao vincular lançamentos.');
      } finally {
        setBusy(false);
      }
    },
    [toast, removeComFade, patchCount, scheduleLoadCounts],
  );

  const handleAprovarSemelhanteGrupo = useCallback(
    (grupo) => void aplicarSemelhantesItens(grupo?.itens ?? []),
    [aplicarSemelhantesItens],
  );

  const handleAprovarSemelhanteItem = useCallback(
    (item) => void aplicarSemelhantesItens([item]),
    [aplicarSemelhantesItens],
  );

  const handlePularSemelhantes = useCallback((ids) => {
    if (!ids?.length) return;
    setSkipped((prev) => new Set([...prev, ...ids]));
  }, []);

  const semelhanteItensParaDescarte = useCallback(
    (itens) =>
      (itens ?? [])
        .filter((i) => i?.lancamentoId && i?.sugestaoClienteId && i?.sugestaoProcessoId)
        .map((i) => ({
          lancamentoId: i.lancamentoId,
          clienteId: i.sugestaoClienteId,
          processoId: i.sugestaoProcessoId,
        })),
    [],
  );

  const handleRejeitarSemelhantes = useCallback(
    async (itens) => {
      const payload = semelhanteItensParaDescarte(itens);
      if (!payload.length || busy || loading) return;

      setBusy(true);
      try {
        const res = await descartarSemelhantesEscritorioApi({ itens: payload });
        const ok = Number(res?.descartados ?? 0);
        const ja = Number(res?.jaDescartados ?? 0);
        const ids = payload.map((i) => i.lancamentoId);

        removeComFade(ids, () => {
          setSemelhantesGrupos((prev) => {
            const next = prev
              .map((g) => ({
                ...g,
                itens: (g.itens ?? []).filter((i) => !ids.includes(i.lancamentoId)),
              }))
              .filter((g) => (g.itens ?? []).length > 0);
            setTotalElements(next.length);
            return next;
          });
        });

        if (ok > 0) {
          patchCount(INBOX_TIPOS.semelhantes, -ok);
          scheduleLoadCounts();
          dispatchRefreshPendentes();
          toast.success(
            ok === 1
              ? '1 sugestão rejeitada — não será exibida novamente.'
              : `${ok.toLocaleString('pt-BR')} sugestões rejeitadas — não serão exibidas novamente.`,
          );
        } else if (ja > 0) {
          toast.info('Sugestão já estava rejeitada; lista atualizada.');
        }
      } catch (e) {
        toast.error(`Falha ao rejeitar sugestão: ${e?.message || 'erro desconhecido'}`);
      } finally {
        setBusy(false);
      }
    },
    [
      semelhanteItensParaDescarte,
      busy,
      loading,
      toast,
      removeComFade,
      patchCount,
      scheduleLoadCounts,
    ],
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
    setContaLoteId('');
  }, [selected]);

  const handleBatchClassificarComConta = useCallback(async () => {
    if (selected.size === 0 || !contaLoteId) return;
    const conta = contasClassificacao.find((c) => String(c.id) === String(contaLoteId));
    if (!conta) return;

    setBusy(true);
    try {
      const ids = [...selected];
      const aplicacoes = ids.map((id) => ({
        lancamentoId: id,
        contaContabilId: conta.id,
        clienteId: null,
        processoId: null,
      }));
      const res = await aplicarSugestoesLoteApi(aplicacoes);
      const ok = Number(res?.aplicados ?? aplicacoes.length);
      const cod = String(conta.codigo ?? '').toUpperCase();
      toast.success(`${ok} lançamento${ok !== 1 ? 's' : ''} classificados como ${cod}`);
      removeComFade(ids, () => {
        setLancamentos((prev) => prev.filter((l) => !ids.includes(l.id)));
        setTotalElements((t) => Math.max(0, t - ids.length));
      });
      patchCount(INBOX_TIPOS.classificar, -ids.length);
      scheduleLoadCounts();
      dispatchRefreshPendentes();
      setSelected(new Set());
      setContaLoteId('');
    } catch (e) {
      toast.error(e?.message || 'Erro ao classificar seleção.');
    } finally {
      setBusy(false);
    }
  }, [
    selected,
    contaLoteId,
    contasClassificacao,
    toast,
    removeComFade,
    patchCount,
    scheduleLoadCounts,
  ]);

  const lancamentosVisiveis = useMemo(
    () => lancamentos.filter((l) => !skipped.has(l.id) && !fading.has(l.id)),
    [lancamentos, skipped, fading],
  );

  const classificacaoAgrupada = useMemo(
    () => agruparLancamentosClassificacao(lancamentosVisiveis, sugestoesMap),
    [lancamentosVisiveis, sugestoesMap],
  );

  const contagemLetrasSugestao = useMemo(
    () => contagemPorLetraSugestao(lancamentosVisiveis, sugestoesMap),
    [lancamentosVisiveis, sugestoesMap],
  );

  const classificacaoFiltrada = useMemo(
    () =>
      filtrarClassificacaoPorLetra(classificacaoAgrupada, filtroLetraSugestao, sugestoesMap),
    [classificacaoAgrupada, filtroLetraSugestao, sugestoesMap],
  );

  const idsClassificacaoFiltrados = useMemo(
    () => coletarIdsClassificacaoVisivel(classificacaoFiltrada),
    [classificacaoFiltrada],
  );

  const totalClassificacaoFiltrada = idsClassificacaoFiltrados.length;
  const filtroLetraAtivo = filtroLetraSugestao !== LETRA_SUGESTAO_TODAS;

  const opcoesLetraSugestao = useMemo(() => {
    const letras = new Set(contasClassificacao.map((c) => String(c.codigo).trim().toUpperCase()));
    for (const cod of Object.keys(contagemLetrasSugestao.porLetra)) {
      letras.add(cod);
    }
    return [...letras].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contasClassificacao, contagemLetrasSugestao.porLetra]);

  const handleAprovarTodosFiltradosClassificar = useCallback(async () => {
    if (busy || totalClassificacaoFiltrada === 0 || filtroLetraSugestao === LETRA_SUGESTAO_SEM) {
      return;
    }

    const aplicacoes = [];
    for (const g of classificacaoFiltrada.grupos) {
      const sug = g.sugestao;
      if (!sug?.contaContabilId) continue;
      for (const l of g.lancamentos) {
        aplicacoes.push({
          lancamentoId: l.id,
          contaContabilId: sug.contaContabilId,
          clienteId: sug.clienteId ?? null,
          processoId: sug.processoId ?? null,
        });
      }
    }
    for (const l of classificacaoFiltrada.individuais) {
      const sug = melhorSugestao(sugestoesMap[l.id]);
      if (!sug?.contaContabilId) continue;
      aplicacoes.push({
        lancamentoId: l.id,
        contaContabilId: sug.contaContabilId,
        clienteId: sug.clienteId ?? null,
        processoId: sug.processoId ?? null,
      });
    }
    if (!aplicacoes.length) {
      toast.warn('Nenhum lançamento filtrado tem sugestão para aplicar.');
      return;
    }

    setBusy(true);
    try {
      const res = await aplicarSugestoesLoteApi(aplicacoes);
      const ok = Number(res?.aplicados ?? aplicacoes.length);
      toast.success(
        `${ok} lançamento${ok !== 1 ? 's' : ''} classificados como ${filtroLetraSugestao}`,
      );
      const ids = aplicacoes.map((a) => a.lancamentoId);
      removeComFade(ids, () => {
        setLancamentos((prev) => prev.filter((l) => !ids.includes(l.id)));
        setTotalElements((t) => Math.max(0, t - ids.length));
      });
      patchCount(INBOX_TIPOS.classificar, -ids.length);
      scheduleLoadCounts();
      dispatchRefreshPendentes();
      setSelected(new Set());
    } catch (e) {
      toast.error(e?.message || 'Erro ao aprovar lançamentos filtrados.');
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    totalClassificacaoFiltrada,
    filtroLetraSugestao,
    classificacaoFiltrada,
    sugestoesMap,
    toast,
    removeComFade,
    patchCount,
    scheduleLoadCounts,
  ]);

  const handlePularTodosFiltradosClassificar = useCallback(() => {
    if (totalClassificacaoFiltrada === 0) return;
    setSkipped((prev) => new Set([...prev, ...idsClassificacaoFiltrados]));
    setSelected(new Set());
  }, [totalClassificacaoFiltrada, idsClassificacaoFiltrados]);

  const todosClassificarSelecionados =
    idsClassificacaoFiltrados.length > 0 &&
    idsClassificacaoFiltrados.every((id) => selected.has(id));

  const handleSelecionarTodosClassificarNaTela = useCallback(() => {
    if (totalClassificacaoFiltrada === 0) return;
    if (todosClassificarSelecionados) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(idsClassificacaoFiltrados));
  }, [totalClassificacaoFiltrada, todosClassificarSelecionados, idsClassificacaoFiltrados]);

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

  const handleRefatorarSugestao = useCallback(
    async (lancamentoIds) => {
      const ids = [...new Set(lancamentoIds ?? [])]
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) return;

      setRefatorandoIds((prev) => new Set([...prev, ...ids]));
      try {
        const res = await sugestoesClassificacaoLoteApi(ids);
        const novas = normalizeSugestoesMap(res?.sugestoes);
        const anteriores = Object.fromEntries(
          ids.map((id) => [id, melhorSugestao(sugestoesMap[id])?.contaCodigo ?? null]),
        );

        setSugestoesMap((prev) => ({ ...prev, ...novas }));

        const mudou = ids.some((id) => {
          const depois = melhorSugestao(novas[id])?.contaCodigo ?? null;
          return anteriores[id] !== depois;
        });
        if (mudou) {
          toast.success('Sugestão atualizada com as regras atuais.');
        } else {
          toast.info('Sugestão recalculada — sem alteração.');
        }
      } catch (e) {
        toast.error(`Falha ao refatorar sugestão: ${e?.message || 'erro desconhecido'}`);
      } finally {
        setRefatorandoIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [sugestoesMap, toast],
  );

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

  const handleRejeitarPares = useCallback(
    async (listaPar) => {
      const paresBody = (listaPar ?? [])
        .map((par) => ({
          lancamentoIdA: par.lancamentoA?.id,
          lancamentoIdB: par.lancamentoB?.id,
        }))
        .filter((p) => p.lancamentoIdA && p.lancamentoIdB);
      if (!paresBody.length || busy || loading) return;

      setBusy(true);
      try {
        const res = await descartarParesCompensacaoApi({ pares: paresBody });
        const ok = Number(res?.descartados ?? 0);
        const keysRemover = (listaPar ?? []).map(parKey);
        removeComFade(keysRemover, () => {
          setPares((prev) => prev.filter((p) => !keysRemover.includes(parKey(p))));
        });
        setSelected(new Set());
        setReloadNonce((n) => n + 1);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
        if (ok > 0) {
          toast.success(
            `${ok} sugestão${ok !== 1 ? 'ões' : ''} rejeitada${ok !== 1 ? 's' : ''} — reanalisando outros pares…`,
          );
        } else {
          toast.info('Sugestões já estavam rejeitadas; lista atualizada.');
        }
      } catch (e) {
        toast.error(`Falha ao rejeitar par: ${e?.message || 'erro desconhecido'}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, loading, toast, removeComFade, scheduleLoadCounts],
  );

  const handleRejeitarPar = useCallback(
    (par) => handleRejeitarPares([par]),
    [handleRejeitarPares],
  );

  const handleRejeitarTodosNaTela = useCallback(() => {
    handleRejeitarPares(paresVisiveis);
  }, [handleRejeitarPares, paresVisiveis]);

  const handleSelecionarTodosNaTela = useCallback(() => {
    if (paresVisiveis.length === 0) return;
    const keys = paresVisiveis.map(parKey);
    const todosSelecionados = keys.length > 0 && keys.every((k) => selected.has(k));
    if (todosSelecionados) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(keys));
  }, [paresVisiveis, selected]);

  const handleBatchRejeitar = useCallback(() => {
    const lista = [];
    for (const key of selected) {
      const par = pares.find((p) => parKey(p) === key);
      if (par) lista.push(par);
    }
    handleRejeitarPares(lista);
  }, [selected, pares, handleRejeitarPares]);

  const handleParearTodosNaTela = useCallback(async () => {
    if (busy || loading || paresVisiveis.length === 0) return;

    const paresBody = paresVisiveis
      .map((par) => ({
        lancamentoIdA: par.lancamentoA?.id,
        lancamentoIdB: par.lancamentoB?.id,
      }))
      .filter((p) => p.lancamentoIdA && p.lancamentoIdB);
    if (!paresBody.length) return;

    setBusy(true);
    try {
      const res = await parearCompensacaoApi({ pares: paresBody });
      const ok = Number(res?.pareados ?? 0);
      const errosList = Array.isArray(res?.erros) ? res.erros : [];
      const failedKeys = new Set(
        errosList.map((e) => `${e.lancamentoIdA}-${e.lancamentoIdB}`),
      );
      const keysRemover = paresVisiveis
        .filter((p) => !failedKeys.has(parKey(p)))
        .map(parKey);

      if (ok > 0) {
        removeComFade(keysRemover, () => {
          setPares((prev) => prev.filter((p) => !keysRemover.includes(parKey(p))));
          setTotalElements((t) => Math.max(0, t - ok));
        });
        patchCount(INBOX_TIPOS.compensar, -ok);
        scheduleLoadCounts();
        dispatchRefreshPendentes();
        setSelected(new Set());
      }

      if (errosList.length > 0) {
        toast.warn(
          ok > 0
            ? `${ok} par${ok !== 1 ? 'es' : ''} compensado${ok !== 1 ? 's' : ''}; ${errosList.length} com erro.`
            : `Nenhum par compensado — ${errosList.length} erro${errosList.length !== 1 ? 's' : ''}.`,
        );
      } else if (ok > 0) {
        toast.success(`${ok} par${ok !== 1 ? 'es' : ''} compensado${ok !== 1 ? 's' : ''} com sucesso`);
      }
    } catch (e) {
      toast.error(`Falha ao parear: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setBusy(false);
    }
  }, [busy, loading, paresVisiveis, toast, removeComFade, patchCount, scheduleLoadCounts]);

  const gruposVisiveis = useMemo(
    () =>
      grupos.filter(
        (g) => !skipped.has(g.grupoCompensacao) && !fading.has(g.grupoCompensacao),
      ),
    [grupos, skipped, fading],
  );

  const semelhantesVisiveis = useMemo(
    () =>
      semelhantesGrupos
        .map((g) => ({
          ...g,
          itens: (g.itens ?? []).filter(
            (i) => !skipped.has(i.lancamentoId) && !fading.has(i.lancamentoId),
          ),
        }))
        .filter((g) => (g.itens ?? []).length > 0),
    [semelhantesGrupos, skipped, fading],
  );

  const itensNavegaveis = useMemo(() => {
    if (tipo === INBOX_TIPOS.classificar) {
      if (filtroLetraAtivo) {
        return lancamentosVisiveis.filter((l) => idsClassificacaoFiltrados.includes(l.id));
      }
      return lancamentosVisiveis;
    }
    if (tipo === INBOX_TIPOS.compensar) {
      return pares.filter((p) => !skipped.has(parKey(p)));
    }
    return [];
  }, [tipo, lancamentosVisiveis, filtroLetraAtivo, idsClassificacaoFiltrados, pares, skipped]);

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
      ? classificacaoFiltrada.grupos.length === 0 &&
        classificacaoFiltrada.individuais.length === 0 &&
        classificacaoFiltrada.semSugestao.length === 0
      : tipo === INBOX_TIPOS.compensar
        ? paresVisiveis.length === 0
        : tipo === INBOX_TIPOS.semelhantes
          ? semelhantesVisiveis.length === 0
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
          className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 min-w-[10rem]"
          aria-label="Filtrar banco ou cartão"
        >
          <option value="">Todos os bancos</option>
          {bancos.map((b) => (
            <option key={b.numero} value={b.numero}>
              {b.nome}
            </option>
          ))}
          {cartoes.length > 0 ? (
            <optgroup label="Cartões">
              {cartoes.map((c) => (
                <option key={`cartao-${c.numero}`} value={c.numero}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          ) : null}
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
        {tipo === INBOX_TIPOS.compensar ? (
          <button
            type="button"
            onClick={handleParearTodosNaTela}
            disabled={busy || loading || paresVisiveis.length === 0}
            className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium"
            title="Pareia todos os pares sugeridos visíveis nesta página"
          >
            <Check className="w-3.5 h-3.5" aria-hidden />
            Parear todos na tela
            {paresVisiveis.length > 0 ? ` (${paresVisiveis.length})` : ''}
          </button>
        ) : null}
        {tipo === INBOX_TIPOS.compensar ? (
          <button
            type="button"
            onClick={handleSelecionarTodosNaTela}
            disabled={busy || loading || paresVisiveis.length === 0}
            className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            title="Marca todos os pares visíveis nesta página"
          >
            {paresVisiveis.length > 0 && paresVisiveis.every((p) => selected.has(parKey(p)))
              ? 'Limpar seleção'
              : 'Selecionar todos'}
            {paresVisiveis.length > 0 ? ` (${paresVisiveis.length})` : ''}
          </button>
        ) : null}
        {tipo === INBOX_TIPOS.compensar ? (
          <button
            type="button"
            onClick={handleRejeitarTodosNaTela}
            disabled={busy || loading || paresVisiveis.length === 0}
            className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 font-medium"
            title="Rejeita todas as sugestões visíveis para o sistema reanalizar outros pares"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            Não são par (todos na tela)
            {paresVisiveis.length > 0 ? ` (${paresVisiveis.length})` : ''}
          </button>
        ) : null}
        {tipo === INBOX_TIPOS.classificar ? (
          <>
            <select
              value={filtroLetraSugestao}
              onChange={(e) => setLetraSugestao(e.target.value)}
              className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 min-w-[11rem]"
              aria-label="Filtrar por letra da sugestão"
            >
              <option value={LETRA_SUGESTAO_TODAS}>
                Sugestão: todas ({lancamentosVisiveis.length})
              </option>
              {opcoesLetraSugestao.map((cod) => {
                const n = contagemLetrasSugestao.porLetra[cod] ?? 0;
                if (n <= 0) return null;
                const nome = contasClassificacao.find((c) => c.codigo === cod)?.nome ?? cod;
                return (
                  <option key={cod} value={cod}>
                    Sugestão {cod} — {nome} ({n})
                  </option>
                );
              })}
              {contagemLetrasSugestao.sem > 0 ? (
                <option value={LETRA_SUGESTAO_SEM}>
                  Sem sugestão ({contagemLetrasSugestao.sem})
                </option>
              ) : null}
            </select>
            {totalClassificacaoFiltrada > 0 ? (
              <button
                type="button"
                onClick={handleSelecionarTodosClassificarNaTela}
                disabled={busy || loading}
                className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                title="Marca todos os lançamentos visíveis nesta página"
              >
                {todosClassificarSelecionados ? 'Limpar seleção' : 'Selecionar todos'}
                {` (${totalClassificacaoFiltrada})`}
              </button>
            ) : null}
            {filtroLetraAtivo && totalClassificacaoFiltrada > 0 ? (
              <>
                {filtroLetraSugestao !== LETRA_SUGESTAO_SEM ? (
                  <button
                    type="button"
                    onClick={handleAprovarTodosFiltradosClassificar}
                    disabled={busy || loading}
                    className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium"
                    title={`Aprova todas as sugestões ${filtroLetraSugestao} visíveis nesta página`}
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden />
                    Aprovar todos {filtroLetraSugestao} ({totalClassificacaoFiltrada})
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handlePularTodosFiltradosClassificar}
                  disabled={busy || loading}
                  className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                  title="Remove da lista os lançamentos filtrados (pular)"
                >
                  Pular filtrados ({totalClassificacaoFiltrada})
                </button>
              </>
            ) : null}
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
          </>
        ) : null}
      </div>

      {showBatch ? (
        <InboxBatchBar
          count={selected.size}
          totalVisiveis={
            tipo === INBOX_TIPOS.classificar
              ? totalClassificacaoFiltrada
              : tipo === INBOX_TIPOS.compensar
                ? paresVisiveis.length
                : 0
          }
          onSelecionarTodos={
            tipo === INBOX_TIPOS.classificar
              ? handleSelecionarTodosClassificarNaTela
              : tipo === INBOX_TIPOS.compensar
                ? handleSelecionarTodosNaTela
                : undefined
          }
          todosSelecionados={
            tipo === INBOX_TIPOS.classificar
              ? todosClassificarSelecionados
              : tipo === INBOX_TIPOS.compensar
                ? paresVisiveis.length > 0 && paresVisiveis.every((p) => selected.has(parKey(p)))
                : false
          }
          onAprovarTodos={handleBatchAprovar}
          onPular={handleBatchPular}
          onRejeitar={tipo === INBOX_TIPOS.compensar ? handleBatchRejeitar : undefined}
          aprovarLabel={tipo === INBOX_TIPOS.compensar ? 'Parear selecionados' : 'Aprovar sugestão'}
          busy={busy}
          contas={tipo === INBOX_TIPOS.classificar ? contasClassificacao : []}
          contaLoteId={contaLoteId}
          onContaLoteChange={setContaLoteId}
          onClassificarComConta={
            tipo === INBOX_TIPOS.classificar ? handleBatchClassificarComConta : undefined
          }
        />
      ) : null}

      <div ref={listRef} className="flex-1 min-h-0 overflow-auto p-3">
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Carregando…</p>
        ) : erro ? (
          <p className="text-sm text-red-600 dark:text-red-400 p-4">{erro}</p>
        ) : empty ? (
          filtroLetraAtivo && lancamentosVisiveis.length > 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 p-4">
              Nenhum lançamento com sugestão{' '}
              {filtroLetraSugestao === LETRA_SUGESTAO_SEM ? 'pendente' : filtroLetraSugestao} nesta
              página. Tente outra letra ou aumente itens por página.
            </p>
          ) : (
            <InboxEmptyState tipo={tipo} />
          )
        ) : tipo === INBOX_TIPOS.classificar ? (
          <>
            {classificacaoFiltrada.grupos.map((grupo, idx) => {
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
                    onRefatorar={handleRefatorarSugestao}
                    refatorando={ids.some((id) => refatorandoIds.has(id))}
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
            {classificacaoFiltrada.individuais.map((l, idx) => {
                const cardIdx = classificacaoFiltrada.grupos.length + idx;
                return (
                  <div key={l.id} data-inbox-card-index={cardIdx}>
                    <ClassificacaoCard
                      lancamento={l}
                      sugestoes={sugestoesMap[l.id] ?? []}
                      contas={contas}
                      onAprovar={handleAprovarClassificacao}
                      onPular={(id) => setSkipped((s) => new Set([...s, id]))}
                      onRefatorar={() => handleRefatorarSugestao([l.id])}
                      refatorando={refatorandoIds.has(l.id)}
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
            {classificacaoFiltrada.semSugestao.map((l, idx) => {
              const cardIdx =
                classificacaoFiltrada.grupos.length + classificacaoFiltrada.individuais.length + idx;
              return (
                <div key={l.id} data-inbox-card-index={cardIdx}>
                  <ClassificacaoCard
                    lancamento={l}
                    sugestoes={sugestoesMap[l.id] ?? []}
                    contas={contas}
                    onAprovar={handleAprovarClassificacao}
                    onPular={(id) => setSkipped((s) => new Set([...s, id]))}
                    onRefatorar={() => handleRefatorarSugestao([l.id])}
                    refatorando={refatorandoIds.has(l.id)}
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
                onRejeitar={() => handleRejeitarPar(ui.par)}
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
        ) : tipo === INBOX_TIPOS.semelhantes ? (
          semelhantesVisiveis.map((grupo, idx) => {
            const ids = (grupo.itens ?? []).map((i) => i.lancamentoId);
            const grupoFading = ids.some((id) => fading.has(id));
            return (
              <div key={chaveGrupoSemelhantes(grupo)} data-inbox-card-index={idx}>
                <SemelhantesEscritorioGroupCard
                  grupo={grupo}
                  onAprovarGrupo={handleAprovarSemelhanteGrupo}
                  onAprovarItem={handleAprovarSemelhanteItem}
                  onRejeitarGrupo={handleRejeitarSemelhantes}
                  onRejeitarItem={(item) => void handleRejeitarSemelhantes([item])}
                  onPularGrupo={handlePularSemelhantes}
                  fading={grupoFading}
                  busy={busy}
                />
              </div>
            );
          })
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
            tipo === INBOX_TIPOS.inconsistentes ? Math.min(pageSizeEfetivo, 20) : pageSizeEfetivo
          }
          onPageSizeChange={(s) => {
            setPageSize(clampFinanceiroPageSize(s));
            setPage(0);
          }}
          totalItems={totalElements}
        />
      ) : null}
    </div>
  );
}
