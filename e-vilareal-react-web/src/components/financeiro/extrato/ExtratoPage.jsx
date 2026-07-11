import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { featureFlags } from '../../../config/featureFlags.js';
import { isNumeroCartaoFinanceiro } from '../../../data/financeiroData.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
  montarContasContabeisParaSelectExtrato,
} from '../../../data/financeiroData.js';
import {
  aplicarSugestoesLoteApi,
  buscarLancamentoFinanceiroApi,
  listarContasFinanceiro,
  listarLancamentosExtratoPaginados,
  obterSaldoBancoFinanceiro,
  parearGrupoCompensacaoApi,
  removerLancamentosFinanceiroApiEmLote,
} from '../../../repositories/financeiroRepository.js';
import { useFinanceiro } from '../FinanceiroContext.jsx';
import {
  getBancosExtratoPermitidosUsuario,
  usuarioPodeAcessarExtratoBanco,
} from '../../../data/financeiroExtratoAcesso.js';
import { isSortDataAsc } from '../hooks/useExtratoFilters.js';
import { useExtratoMesAoSelecionarBanco } from '../hooks/useExtratoMesAoSelecionarBanco.js';
import { FINANCEIRO_REFRESH_PENDENTES, dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { FINANCEIRO_CONTA_LIMPA } from './limparContaFinanceiro.js';
import { Pagination } from '../shared/Pagination.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { ExtratoFilters } from './ExtratoFilters.jsx';
import { ExtratoTable } from './ExtratoTable.jsx';
import { ExtratoDetailPanel } from './ExtratoDetailPanel.jsx';
import { ExtratoBatchBar } from './ExtratoBatchBar.jsx';
import { mesAnoFromDataLancamento } from './extratoMesUtils.js';
import { scrollExtratoParaLancamento, buildCartaoUrlParaLancamento } from './extratoDeepLink.js';
import { mapApiLancamentoToExtratoRow } from './extratoMappers.js';
import { filtroCompensacaoSemParAtivo } from './compensacaoSemPar.js';
import { useExtratoParearPorClique } from './useExtratoParearPorClique.js';
import { ModoParearBanner } from './ModoParearBanner.jsx';
import { ContaAcertoAlerta } from './ContaAcertoAlerta.jsx';

export function ExtratoPage() {
  const navigate = useNavigate();
  const {
    apiQuery,
    filters,
    setPage,
    setSize,
    setMes,
    setBanco,
    setBusca,
    bancoAtivo,
    toggleSortData,
    contaExigeSomaZero,
  } = useFinanceiro();
  const toast = useFinanceiroToast();

  useExtratoMesAoSelecionarBanco(bancoAtivo, filters.mes, setMes);

  useEffect(() => {
    const permitidos = getBancosExtratoPermitidosUsuario();
    if (permitidos == null) return undefined;

    if (bancoAtivo != null && !usuarioPodeAcessarExtratoBanco(bancoAtivo)) {
      setBanco(permitidos[0] ?? null);
      return undefined;
    }
    if (bancoAtivo == null && permitidos.length > 0) {
      setBanco(permitidos[0]);
    }
    return undefined;
  }, [bancoAtivo, setBanco]);

  const scrollRef = useRef(null);
  const fetchKeyRef = useRef('');
  const paginasCacheRef = useRef(new Map());
  const lancamentoFocusRef = useRef(null);
  const vinculoOverlayRef = useRef(new Map());

  const limparCachePaginas = useCallback(() => {
    paginasCacheRef.current.clear();
  }, []);
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [detailItem, setDetailItem] = useState(null);
  const [contasApi, setContasApi] = useState([]);
  const [saldoBanco, setSaldoBanco] = useState(null);
  const [saldoBancoLoading, setSaldoBancoLoading] = useState(false);
  const [extratoRefreshKey, setExtratoRefreshKey] = useState(0);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [contaLoteId, setContaLoteId] = useState('');
  const [bulkClassifying, setBulkClassifying] = useState(false);
  const [pareandoGrupo, setPareandoGrupo] = useState(false);

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  const fetchParams = useMemo(() => ({ ...apiQuery }), [apiQuery]);

  const fetchKey = useMemo(() => JSON.stringify(fetchParams), [fetchParams]);

  const contasExtrato = useMemo(() => montarContasContabeisParaSelectExtrato(contasApi), [contasApi]);

  const bulkBusy = bulkDeleting || bulkClassifying;

  useEffect(() => {
    const ac = new AbortController();
    listarContasFinanceiro({ signal: ac.signal })
      .then((c) => setContasApi(Array.isArray(c) ? c : []))
      .catch(() => setContasApi([]));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setRows([]);
      setLoading(false);
      return undefined;
    }
    const myKey = fetchKey;
    fetchKeyRef.current = myKey;
    const cached = paginasCacheRef.current.get(myKey);
    if (cached) {
      setRows(cached.rows);
      setTotalElements(cached.totalElements);
      setTotalPages(cached.totalPages);
      setLoading(false);
      setErro('');
      return undefined;
    }

    const ac = new AbortController();
    let cancelled = false;
    setRows([]);
    setSelectedIds(new Set());
    if (!filters.lancamento) setDetailItem(null);
    setLoading(true);
    setErro('');
    (async () => {
      try {
        const res = await listarLancamentosExtratoPaginados(fetchParams, { signal: ac.signal });
        if (cancelled || fetchKeyRef.current !== myKey) return;
        const content = (res?.content ?? []).map((l) => mapApiLancamentoToExtratoRow(l, contaToLetra));
        const mesclarVinculo = (m, anterior) => {
          const o = vinculoOverlayRef.current.get(Number(m.id));
          const cod = m.codCliente || anterior?.codCliente || o?.codCliente || '';
          const proc = m.proc || anterior?.proc || o?.proc || '';
          const clienteId = m.clienteId ?? anterior?.clienteId ?? o?.clienteId ?? null;
          const processoId = m.processoId ?? anterior?.processoId ?? o?.processoId ?? null;
          if (!cod && !proc && !clienteId && !processoId) return m;
          return { ...m, codCliente: cod, proc, clienteId, processoId };
        };
        const totalEl = Number(res?.totalElements) || 0;
        const totalPg = Number(res?.totalPages) || 0;
        let mergedRows = content;
        setRows((prev) => {
          const byId = new Map((prev || []).map((r) => [Number(r.id), r]));
          mergedRows = content.map((m) => mesclarVinculo(m, byId.get(Number(m.id))));
          return mergedRows;
        });
        setTotalElements(totalEl);
        setTotalPages(totalPg);
        if (paginasCacheRef.current.size > 20) {
          const firstKey = paginasCacheRef.current.keys().next().value;
          paginasCacheRef.current.delete(firstKey);
        }
        paginasCacheRef.current.set(myKey, {
          rows: mergedRows,
          totalElements: totalEl,
          totalPages: totalPg,
        });
      } catch (e) {
        if (cancelled || e?.name === 'AbortError' || fetchKeyRef.current !== myKey) return;
        setErro(e?.message || 'Erro ao carregar extrato.');
        setRows([]);
      } finally {
        if (!cancelled && fetchKeyRef.current === myKey) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [fetchKey, fetchParams, contaToLetra, extratoRefreshKey, filters.lancamento]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || bancoAtivo == null) {
      setSaldoBanco(null);
      setSaldoBancoLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    let cancelled = false;
    setSaldoBancoLoading(true);
    obterSaldoBancoFinanceiro(bancoAtivo, { signal: ac.signal })
      .then((res) => {
        if (!cancelled) setSaldoBanco(res);
      })
      .catch((e) => {
        if (!cancelled && e?.name !== 'AbortError') setSaldoBanco(null);
      })
      .finally(() => {
        if (!cancelled) setSaldoBancoLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [bancoAtivo, extratoRefreshKey]);

  useEffect(() => {
    const onRefresh = () => {
      limparCachePaginas();
      setExtratoRefreshKey((n) => n + 1);
    };
    window.addEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
    return () => window.removeEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
  }, [limparCachePaginas]);

  useEffect(() => {
    const onContaLimpa = (event) => {
      const detail = event?.detail ?? {};
      if (detail.tipo !== 'banco') return;
      const nb = detail.numeroBanco;
      if (nb != null && Number(filters.banco) !== Number(nb)) return;
      limparCachePaginas();
      setRows([]);
      setTotalElements(0);
      setTotalPages(0);
      setSelectedIds(new Set());
      setDetailItem(null);
      setSaldoBanco(null);
      setExtratoRefreshKey((n) => n + 1);
    };
    window.addEventListener(FINANCEIRO_CONTA_LIMPA, onContaLimpa);
    return () => window.removeEventListener(FINANCEIRO_CONTA_LIMPA, onContaLimpa);
  }, [filters.banco, limparCachePaginas]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters.page, filters.size, filters.banco, filters.mes, filters.etapa, filters.letras, filters.letrasModo, filters.cadastro, filters.busca, filters.sort]);

  useEffect(() => {
    limparCachePaginas();
  }, [filters.busca, limparCachePaginas]);

  useEffect(() => {
    const id = filters.lancamento;
    if (!id || !isNumeroCartaoFinanceiro(filters.banco)) return;
    navigate(
      buildCartaoUrlParaLancamento({
        lancamentoId: id,
        numeroCartao: filters.banco,
        mes: filters.mes,
      }),
      { replace: true },
    );
  }, [filters.lancamento, filters.banco, filters.mes, navigate]);

  useEffect(() => {
    const id = filters.lancamento;
    if (!id || !featureFlags.useApiFinanceiro) return undefined;
    if (lancamentoFocusRef.current === id) return undefined;

    const naPagina = rows.find((r) => Number(r.id) === Number(id));
    if (naPagina) {
      setDetailItem(naPagina);
      lancamentoFocusRef.current = id;
      requestAnimationFrame(() => scrollExtratoParaLancamento(id));
      return undefined;
    }

    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const api = await buscarLancamentoFinanceiroApi(id, { signal: ac.signal });
        if (cancelled || !api) return;
        const nb = Number(api.numeroBanco);
        if (Number.isFinite(nb) && nb !== filters.banco) setBanco(nb);
        const mes = mesAnoFromDataLancamento(api.dataLancamento);
        if (mes && mes !== filters.mes) setMes(mes);
        const mapped = mapApiLancamentoToExtratoRow(api, contaToLetra);
        if (!cancelled) {
          setDetailItem(mapped);
          lancamentoFocusRef.current = id;
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          setErro(e?.message || 'Não foi possível abrir o lançamento solicitado.');
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [filters.lancamento, filters.banco, filters.mes, rows, contaToLetra, setBanco, setMes]);

  useEffect(() => {
    if (!filters.lancamento) lancamentoFocusRef.current = null;
  }, [filters.lancamento]);

  useEffect(() => {
    const id = filters.lancamento;
    if (!id || loading) return undefined;
    const naPagina = rows.find((r) => Number(r.id) === Number(id));
    if (!naPagina) return undefined;
    requestAnimationFrame(() => scrollExtratoParaLancamento(id));
    return undefined;
  }, [filters.lancamento, rows, loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = rows.map((r) => r.id);
      const all = ids.length > 0 && ids.every((id) => prev.has(id));
      return all ? new Set() : new Set(ids);
    });
  }, [rows]);

  const atualizarLinhasAposParear = useCallback((origemMerged, contrapartidaMerged) => {
    limparCachePaginas();
    setRows((prev) =>
      prev.map((r) => {
        if (Number(r.id) === Number(origemMerged.id)) return origemMerged;
        if (Number(r.id) === Number(contrapartidaMerged.id)) return contrapartidaMerged;
        return r;
      }),
    );
    setExtratoRefreshKey((n) => n + 1);
  }, [limparCachePaginas]);

  const {
    modoParearAtivo,
    modoParearOrigemKey,
    pareando,
    handleModoParearChange,
    handleRowClick: handleRowClickParear,
  } = useExtratoParearPorClique({
    detailItem,
    setDetailItem,
    onPareadoRows: atualizarLinhasAposParear,
  });

  const handleRowClick = useCallback(
    (item) => {
      void handleRowClickParear(item, setDetailItem);
    },
    [handleRowClickParear],
  );

  const handleRowSaved = (updated) => {
    vinculoOverlayRef.current.set(Number(updated.id), {
      codCliente: updated.codCliente,
      proc: updated.proc,
      clienteId: updated.clienteId,
      processoId: updated.processoId,
    });
    limparCachePaginas();
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetailItem(updated);
    setExtratoRefreshKey((n) => n + 1);
  };

  const handleRowDeleted = (apiId) => {
    limparCachePaginas();
    setRows((prev) => prev.filter((r) => Number(r.id) !== Number(apiId)));
    setTotalElements((n) => Math.max(0, Number(n) - 1));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(apiId);
      return next;
    });
    setDetailItem(null);
    setExtratoRefreshKey((n) => n + 1);
  };

  const aplicarExclusoesLocais = useCallback(
    (removidos) => {
      if (!removidos?.length) return;
      const removedSet = new Set(removidos.map((id) => Number(id)));
      limparCachePaginas();
      setRows((prev) => prev.filter((r) => !removedSet.has(Number(r.id))));
      setTotalElements((n) => Math.max(0, Number(n) - removidos.length));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of removidos) next.delete(id);
        return next;
      });
      setDetailItem((prev) => (prev && removedSet.has(Number(prev.id)) ? null : prev));
      setExtratoRefreshKey((k) => k + 1);
      dispatchRefreshPendentes();
    },
    [limparCachePaginas],
  );

  const handleLimparSelecao = useCallback(() => {
    setSelectedIds(new Set());
    setContaLoteId('');
  }, []);

  const handleBulkTrocarLetra = async () => {
    if (!contaLoteId || selectedIds.size === 0) return;
    const conta = contasExtrato.find((c) => String(c.id) === String(contaLoteId));
    if (!conta) return;

    const cod = String(conta.codigo ?? '').trim().toUpperCase();
    const ids = [...selectedIds];
    const rowById = new Map(rows.map((r) => [Number(r.id), r]));
    const aplicacoes = ids.map((id) => {
      const row = rowById.get(Number(id));
      const limparVinculo = cod === 'E';
      return {
        lancamentoId: id,
        contaContabilId: conta.id,
        clienteId: limparVinculo ? null : (row?.clienteId ?? null),
        processoId: limparVinculo ? null : (row?.processoId ?? null),
      };
    });

    setBulkClassifying(true);
    try {
      const res = await aplicarSugestoesLoteApi(aplicacoes);
      const ok = Number(res?.aplicados ?? 0);
      const erros = Array.isArray(res?.erros) ? res.erros : [];

      limparCachePaginas();
      setRows((prev) =>
        prev.map((r) => {
          if (!selectedIds.has(r.id)) return r;
          return {
            ...r,
            contaCodigo: cod,
            contaContabilId: conta.id,
            contaContabilNome: conta.nome ?? r.contaContabilNome,
            ...(cod === 'E' ? { codCliente: '', proc: '', clienteId: null, processoId: null } : {}),
          };
        }),
      );
      setDetailItem((prev) => {
        if (!prev || !selectedIds.has(prev.id)) return prev;
        return {
          ...prev,
          contaCodigo: cod,
          contaContabilId: conta.id,
          contaContabilNome: conta.nome ?? prev.contaContabilNome,
          ...(cod === 'E' ? { codCliente: '', proc: '', clienteId: null, processoId: null } : {}),
        };
      });
      if (cod === 'E') {
        for (const id of ids) vinculoOverlayRef.current.delete(Number(id));
      }
      setExtratoRefreshKey((n) => n + 1);
      dispatchRefreshPendentes();

      if (ok > 0) {
        toast.success(
          ok === 1
            ? `1 lançamento alterado para conta ${cod}.`
            : `${ok.toLocaleString('pt-BR')} lançamentos alterados para conta ${cod}.`,
        );
      }
      if (erros.length) {
        toast.warn(
          `${erros.length.toLocaleString('pt-BR')} falha(s) ao alterar letra. ${erros.slice(0, 2).join(' · ')}`,
        );
      }
      setSelectedIds(new Set());
      setContaLoteId('');
    } catch (e) {
      toast.error(e?.message || 'Falha ao alterar letra dos lançamentos.');
    } finally {
      setBulkClassifying(false);
    }
  };

  const isContaAcertoAtiva = bancoAtivo != null && contaExigeSomaZero?.(bancoAtivo) === true;

  const parearGrupoInfo = useMemo(() => {
    if (!isContaAcertoAtiva || selectedIds.size < 2) return null;
    const selecionados = rows.filter((r) => selectedIds.has(r.id));
    if (selecionados.length < 2) return null;
    const soma = selecionados.reduce(
      (acc, r) => acc + (r.natureza === 'DEBITO' ? -Number(r.valor) : Number(r.valor)),
      0,
    );
    const somaZero = Math.abs(soma) < 0.005;
    const chavesVinculo = new Set(
      selecionados.map((r) =>
        Number(r.clienteId) > 0
          ? `cli-${Number(r.clienteId)}`
          : Number(r.pessoaRefId) > 0
            ? `pes-${Number(r.pessoaRefId)}`
            : 'sem-vinculo',
      ),
    );
    const semVinculo = chavesVinculo.has('sem-vinculo');
    const mesmoVinculo = !semVinculo && chavesVinculo.size === 1;
    const jaAgrupado = selecionados.some((r) => String(r.grupoCompensacao ?? '').trim() !== '');
    let motivoInvalido = '';
    if (!somaZero) motivoInvalido = 'A soma da seleção precisa ser exatamente zero.';
    else if (semVinculo) motivoInvalido = 'Há lançamento sem vínculo (cliente ou pessoa/imóvel).';
    else if (!mesmoVinculo) motivoInvalido = 'Todos os lançamentos devem ter o mesmo vínculo.';
    else if (jaAgrupado) motivoInvalido = 'Há lançamento que já pertence a um grupo compensado.';
    return {
      soma,
      somaZero,
      valido: !motivoInvalido,
      motivoInvalido,
      busy: pareandoGrupo,
    };
  }, [isContaAcertoAtiva, selectedIds, rows, pareandoGrupo]);

  const handleParearGrupo = async () => {
    const ids = [...selectedIds].map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length < 2) return;
    setPareandoGrupo(true);
    try {
      const res = await parearGrupoCompensacaoApi({ lancamentoIds: ids });
      toast.success(
        `Grupo ${res?.grupoCompensacao ?? ''} compensado (${Number(res?.lancamentos ?? ids.length).toLocaleString('pt-BR')} lançamentos, soma zero).`,
      );
      limparCachePaginas();
      setSelectedIds(new Set());
      setExtratoRefreshKey((n) => n + 1);
      dispatchRefreshPendentes();
    } catch (e) {
      toast.error(e?.message || 'Falha ao parear grupo.');
    } finally {
      setPareandoGrupo(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) {
      setConfirmBulkDelete(false);
      return;
    }
    setBulkDeleting(true);
    try {
      const { removidos, erros } = await removerLancamentosFinanceiroApiEmLote(ids);
      if (removidos.length) {
        aplicarExclusoesLocais(removidos);
        toast.success(
          removidos.length === 1
            ? '1 lançamento excluído do extrato.'
            : `${removidos.length.toLocaleString('pt-BR')} lançamentos excluídos do extrato.`,
        );
      }
      if (erros.length) {
        toast.warn(
          `${erros.length.toLocaleString('pt-BR')} falha(s) ao excluir. ${erros
            .slice(0, 2)
            .map((e) => e.message)
            .join(' · ')}`,
        );
      }
    } catch (e) {
      toast.error(e?.message || 'Falha ao excluir lançamentos.');
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  if (!featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">
        {erro || 'API financeiro desativada.'}{' '}
        <a href="/financeiro/legado" className="text-blue-600 hover:underline dark:text-blue-400">
          Abrir extrato legado
        </a>
      </div>
    );
  }

  const semParCompensacaoAtivo = filtroCompensacaoSemParAtivo(filters);

  return (
    <div className="relative flex flex-col min-h-0 h-full">
      <ExtratoFilters
        totalNaPagina={rows.length}
        totalGeral={totalElements}
        saldoBanco={saldoBanco}
        saldoBancoLoading={saldoBancoLoading}
      />

      {semParCompensacaoAtivo ? (
        <p className="mx-3 mb-1 text-xs text-slate-600 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          Filtro <strong>Somente E</strong> + <strong>Pendente</strong>: conta compensação (E) sem par
          concluído — inclui pendentes, classificados e grupos incompletos.
        </p>
      ) : null}

      {isContaAcertoAtiva ? (
        <ContaAcertoAlerta
          numeroBanco={bancoAtivo}
          refreshKey={extratoRefreshKey}
          onFiltrarVinculo={(v) => setBusca(String(v.codigoCliente ?? '').trim())}
        />
      ) : null}

      {modoParearAtivo ? <ModoParearBanner pareando={pareando} /> : null}

      <ExtratoBatchBar
        count={selectedIds.size}
        busy={bulkBusy}
        contas={contasExtrato}
        contaLoteId={contaLoteId}
        onContaLoteChange={setContaLoteId}
        onAplicarLetra={() => void handleBulkTrocarLetra()}
        onExcluir={() => setConfirmBulkDelete(true)}
        onLimparSelecao={handleLimparSelecao}
        parearGrupo={
          parearGrupoInfo ? { ...parearGrupoInfo, onParear: () => void handleParearGrupo() } : null
        }
      />

      {erro ? (
        <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40">{erro}</p>
      ) : null}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900">
        <ExtratoTable
          data={rows}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          onSelectAll={toggleSelectAll}
          onRowClick={handleRowClick}
          isLoading={loading}
          sortDataAsc={isSortDataAsc(filters.sort)}
          onSortDataDoubleClick={toggleSortData}
          highlightLancamentoId={filters.lancamento}
          modoParearAtivo={modoParearAtivo}
          modoParearOrigemKey={modoParearOrigemKey}
        />
      </div>

      <Pagination
        page={filters.page}
        totalPages={totalPages}
        totalItems={totalElements}
        pageSize={filters.size}
        onPageChange={setPage}
        onPageSizeChange={setSize}
      />

      {detailItem ? (
        <>
          {modoParearAtivo ? (
            <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden />
          ) : (
            <button
              type="button"
              className="absolute inset-0 z-10 bg-black/20"
              aria-label="Fechar painel"
              data-financeiro-fechar-detalhe
              onClick={() => setDetailItem(null)}
            />
          )}
          <ExtratoDetailPanel
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onModoParearChange={handleModoParearChange}
            onSaved={handleRowSaved}
            onDeleted={handleRowDeleted}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={confirmBulkDelete}
        title="Excluir lançamentos selecionados?"
        message={`${selectedIds.size.toLocaleString('pt-BR')} lançamento(s) será(ão) removido(s) do extrato. Esta ação não pode ser desfeita.`}
        confirmLabel={bulkDeleting ? 'Excluindo…' : 'Excluir'}
        danger
        onCancel={() => {
          if (!bulkDeleting) setConfirmBulkDelete(false);
        }}
        onConfirm={() => {
          if (!bulkDeleting) void handleConfirmBulkDelete();
        }}
      />
    </div>
  );
}
