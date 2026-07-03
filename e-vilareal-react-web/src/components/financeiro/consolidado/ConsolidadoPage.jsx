import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
  normalizarCodigoClienteFinanceiro,
  normalizarNumeroImovelFinanceiro,
  normalizarProcFinanceiro,
} from '../../../data/financeiroData.js';
import {
  listarContasFinanceiro,
  listarLancamentosFinanceiroPaginados,
  obterResumoConsolidadoContasApi,
  obterTotaisLancamentosFiltradosApi,
} from '../../../repositories/financeiroRepository.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { Pagination } from '../shared/Pagination.jsx';
import { PeriodoSelector } from '../shared/PeriodoSelector.jsx';
import { isPeriodoTotal, periodoParaListagemApi } from '../shared/periodoFinanceiro.js';
import { EtapaFiltroSelect } from '../shared/EtapaFiltroSelect.jsx';
import { ExtratoTable } from '../extrato/ExtratoTable.jsx';
import { ExtratoDetailPanel } from '../extrato/ExtratoDetailPanel.jsx';
import { mapApiLancamentoToExtratoRow } from '../extrato/extratoMappers.js';
import { ConsolidadoEvolucaoChart } from './ConsolidadoEvolucaoChart.jsx';
import { ConsolidadoImoveisBatchBar } from './ConsolidadoImoveisBatchBar.jsx';
import { vincularNumeroImovelLancamentosEmLote } from './consolidadoVinculoImovelLote.js';
import { ModalBuscaImovel } from '../../imoveis/ModalBuscaImovel.jsx';
import { carregarImovelCadastroPorNumeroPlanilha, listarVinculosProcessoImovel } from '../../../repositories/imoveisRepository.js';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import {
  lancamentoBateFiltroImovel,
  montarCtxFiltroImovel,
} from './consolidadoFiltroImovel.js';
import {
  CONTAS_LETRAS,
  labelContaTab,
  mesAtualIso,
  somarLancamentosExtratoRows,
} from './consolidadoUtils.js';
import {
  CADASTRO_PARCIAL,
  CADASTRO_PLENO,
  CADASTRO_TODOS,
  cadastroParaQueryApi,
} from '../extrato/extratoCadastroFiltro.js';

const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BUSCA_DEBOUNCE_MS = 300;

export function ConsolidadoPage() {
  const { conta: contaParam } = useParams();
  const navigate = useNavigate();
  const toast = useFinanceiroToast();
  const codigoAtivo = useMemo(() => {
    const c = String(contaParam ?? 'A').trim().toUpperCase();
    return CONTAS_LETRAS.includes(c) ? c : 'A';
  }, [contaParam]);

  const [mes, setMes] = useState(mesAtualIso);
  /** Conta A: cadastro pleno/parcial (bolinha azul/vermelha). Demais contas: etapa do workflow. */
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [buscaLocal, setBuscaLocal] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroCodLocal, setFiltroCodLocal] = useState('');
  const [filtroProcLocal, setFiltroProcLocal] = useState('');
  const [filtroImovelLocal, setFiltroImovelLocal] = useState('');
  const [filtroCodDebounced, setFiltroCodDebounced] = useState('');
  const [filtroProcDebounced, setFiltroProcDebounced] = useState('');
  const [filtroImovelDebounced, setFiltroImovelDebounced] = useState('');
  const [modalFiltroImovel, setModalFiltroImovel] = useState(false);
  const [ctxFiltroImovel, setCtxFiltroImovel] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [contasApi, setContasApi] = useState([]);
  const [tabCounts, setTabCounts] = useState({});
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingTable, setLoadingTable] = useState(false);
  const [erro, setErro] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [detailItem, setDetailItem] = useState(null);
  const [modalVinculoImovelLote, setModalVinculoImovelLote] = useState(false);
  const [bulkVinculandoImovel, setBulkVinculandoImovel] = useState(false);
  const [resumoFiltrados, setResumoFiltrados] = useState(null);
  const [loadingResumoFiltrados, setLoadingResumoFiltrados] = useState(false);

  const [chartMeses, setChartMeses] = useState(12);
  const [resumoConsolidado, setResumoConsolidado] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  const contaAtiva = useMemo(
    () => contasApi.find((c) => String(c.codigo ?? '').toUpperCase() === codigoAtivo),
    [contasApi, codigoAtivo],
  );

  const contaContabilId = contaAtiva?.id;

  useEffect(() => {
    if (contaParam && String(contaParam).toUpperCase() !== codigoAtivo) {
      navigate(`/financeiro/consolidado/${codigoAtivo}`, { replace: true });
    }
  }, [contaParam, codigoAtivo, navigate]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    listarContasFinanceiro({ signal: ac.signal })
      .then((c) => setContasApi(Array.isArray(c) ? c : []))
      .catch(() => setContasApi([]));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    setChartLoading(true);
    obterResumoConsolidadoContasApi({ signal: ac.signal, meses: chartMeses })
      .then((res) => {
        if (ac.signal.aborted) return;
        setResumoConsolidado(res);
        const totais = res?.totaisPorConta ?? {};
        const counts = {};
        for (const cod of CONTAS_LETRAS) {
          counts[cod] = Number(totais[cod] ?? 0);
        }
        setTabCounts(counts);
      })
      .catch(() => {
        if (!ac.signal.aborted) setTabCounts({});
      })
      .finally(() => {
        if (!ac.signal.aborted) setChartLoading(false);
      });
    return () => ac.abort();
  }, [chartMeses]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [codigoAtivo, mes]);

  useEffect(() => {
    setFiltroEtapa('');
    if (codigoAtivo !== 'A') {
      setFiltroCodLocal('');
      setFiltroProcLocal('');
    }
    if (codigoAtivo !== 'I') {
      setFiltroImovelLocal('');
    }
  }, [codigoAtivo]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [filtroEtapa, buscaDebounced, filtroCodDebounced, filtroProcDebounced, filtroImovelDebounced]);

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(buscaLocal.trim()), BUSCA_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [buscaLocal]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setFiltroCodDebounced(normalizarCodigoClienteFinanceiro(filtroCodLocal)),
      BUSCA_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [filtroCodLocal]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setFiltroProcDebounced(normalizarProcFinanceiro(filtroProcLocal)),
      BUSCA_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [filtroProcLocal]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setFiltroImovelDebounced(normalizarNumeroImovelFinanceiro(filtroImovelLocal)),
      BUSCA_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [filtroImovelLocal]);

  useEffect(() => {
    if (codigoAtivo !== 'I' || !filtroImovelDebounced) {
      setCtxFiltroImovel(null);
      return undefined;
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const [vinculos, imovel] = await Promise.all([
          listarVinculosProcessoImovel({ numeroPlanilha: Number(filtroImovelDebounced) }),
          carregarImovelCadastroPorNumeroPlanilha(filtroImovelDebounced, { signal: ac.signal }).catch(
            () => null,
          ),
        ]);
        if (ac.signal.aborted) return;
        setCtxFiltroImovel(montarCtxFiltroImovel(filtroImovelDebounced, vinculos, imovel));
      } catch {
        if (!ac.signal.aborted) {
          setCtxFiltroImovel(montarCtxFiltroImovel(filtroImovelDebounced));
        }
      }
    })();
    return () => ac.abort();
  }, [codigoAtivo, filtroImovelDebounced]);

  const filtroChaveAtivo = Boolean(
    filtroCodDebounced || filtroProcDebounced !== '' || filtroImovelDebounced,
  );
  const filtroListaAtivo = Boolean(
    buscaDebounced ||
      filtroEtapa ||
      filtroCodDebounced ||
      filtroProcDebounced !== '' ||
      filtroImovelDebounced,
  );

  const filtrosListaApi = useMemo(() => {
    const usaFiltroCadastro = codigoAtivo === 'A' || codigoAtivo === 'I';
    const filtroApi =
      usaFiltroCadastro &&
      (filtroEtapa === CADASTRO_PLENO || filtroEtapa === CADASTRO_PARCIAL)
        ? cadastroParaQueryApi(filtroEtapa)
        : usaFiltroCadastro
          ? {}
          : { etapa: filtroEtapa || undefined };
    return {
      contaContabilId,
      ...periodoParaListagemApi(mes),
      busca: buscaDebounced || undefined,
      ...(codigoAtivo === 'A' && filtroCodDebounced ? { codigoCliente: filtroCodDebounced } : {}),
      ...(codigoAtivo === 'A' && filtroProcDebounced !== ''
        ? { numeroInternoProcesso: Number(filtroProcDebounced) }
        : {}),
      ...(codigoAtivo === 'I' && filtroImovelDebounced ? { numeroImovel: filtroImovelDebounced } : {}),
      ...filtroApi,
    };
  }, [
    contaContabilId,
    codigoAtivo,
    mes,
    buscaDebounced,
    filtroEtapa,
    filtroCodDebounced,
    filtroProcDebounced,
    filtroImovelDebounced,
  ]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || !contaContabilId) {
      setRows([]);
      return undefined;
    }
    const ac = new AbortController();
    setLoadingTable(true);
    setErro('');
    const filtroApi =
      codigoAtivo === 'A' || codigoAtivo === 'I'
        ? cadastroParaQueryApi(
            filtroEtapa === CADASTRO_PLENO || filtroEtapa === CADASTRO_PARCIAL
              ? filtroEtapa
              : CADASTRO_TODOS,
          )
        : { etapa: filtroEtapa || undefined };

    listarLancamentosFinanceiroPaginados(
      {
        contaContabilId,
        ...periodoParaListagemApi(mes),
        page,
        size: pageSize,
        sort: 'dataLancamento,desc',
        busca: buscaDebounced || undefined,
        ...(codigoAtivo === 'A' && filtroCodDebounced ? { codigoCliente: filtroCodDebounced } : {}),
        ...(codigoAtivo === 'A' && filtroProcDebounced !== ''
          ? { numeroInternoProcesso: Number(filtroProcDebounced) }
          : {}),
        ...(codigoAtivo === 'I' && filtroImovelDebounced ? { numeroImovel: filtroImovelDebounced } : {}),
        ...filtroApi,
      },
      { signal: ac.signal },
    )
      .then((res) => {
        let content = (res?.content ?? []).map((l) => mapApiLancamentoToExtratoRow(l, contaToLetra));
        if (codigoAtivo === 'I' && ctxFiltroImovel) {
          content = content.filter((row) => lancamentoBateFiltroImovel(row, ctxFiltroImovel));
        }
        setRows(content);
        setTotalElements(Number(res?.totalElements) || 0);
        setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setErro(e?.message || 'Erro ao carregar lançamentos.');
        setRows([]);
      })
      .finally(() => setLoadingTable(false));
    return () => ac.abort();
  }, [
    contaContabilId,
    codigoAtivo,
    mes,
    page,
    pageSize,
    contaToLetra,
    filtroEtapa,
    buscaDebounced,
    filtroCodDebounced,
    filtroProcDebounced,
    filtroImovelDebounced,
    ctxFiltroImovel,
  ]);

  const resumoPagina = useMemo(() => somarLancamentosExtratoRows(rows), [rows]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || !contaContabilId || !filtroListaAtivo) {
      setResumoFiltrados(null);
      setLoadingResumoFiltrados(false);
      return undefined;
    }
    if (loadingTable) return undefined;

    if (totalElements > 0 && totalElements <= rows.length) {
      setResumoFiltrados(somarLancamentosExtratoRows(rows));
      setLoadingResumoFiltrados(false);
      return undefined;
    }

    const ac = new AbortController();
    setLoadingResumoFiltrados(true);
    obterTotaisLancamentosFiltradosApi(filtrosListaApi, { signal: ac.signal })
      .then((t) => {
        if (!ac.signal.aborted) setResumoFiltrados(t);
      })
      .catch(() => {
        if (!ac.signal.aborted) setResumoFiltrados(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingResumoFiltrados(false);
      });
    return () => ac.abort();
  }, [
    contaContabilId,
    filtroListaAtivo,
    filtrosListaApi,
    loadingTable,
    totalElements,
    rows,
  ]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = rows.map((r) => r.id);
    const all = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds(all ? new Set() : new Set(ids));
  };

  const limparFiltroImovel = useCallback(() => {
    setFiltroImovelLocal('');
    setFiltroImovelDebounced('');
    setCtxFiltroImovel(null);
  }, []);

  const limparFiltrosLista = useCallback(() => {
    setBuscaLocal('');
    setBuscaDebounced('');
    setFiltroEtapa('');
    setFiltroCodLocal('');
    setFiltroProcLocal('');
    setFiltroCodDebounced('');
    setFiltroProcDebounced('');
    limparFiltroImovel();
  }, [limparFiltroImovel]);

  const linhasSelecionadas = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  const handleVincularImovelLote = useCallback(
    async (imovel) => {
      const np = normalizarNumeroImovelFinanceiro(imovel?.numeroPlanilha);
      if (!np) {
        toast.warn('Selecione um imóvel com nº de planilha válido.');
        return;
      }
      if (!linhasSelecionadas.length) {
        toast.warn('Nenhum lançamento selecionado.');
        return;
      }
      setModalVinculoImovelLote(false);
      if (featureFlags.useApiImoveis) {
        const cad = await carregarImovelCadastroPorNumeroPlanilha(np);
        if (!cad?.encontrado) {
          toast.error(`Imóvel nº ${np} não encontrado no cadastro.`);
          return;
        }
      }
      setBulkVinculandoImovel(true);
      try {
        const { aplicados, mergedById, erros } = await vincularNumeroImovelLancamentosEmLote(
          linhasSelecionadas,
          np,
          {
            contaContabilId: contaAtiva?.id,
            contaContabilNome: contaAtiva?.nome ?? 'Conta Imóveis',
            contaToLetra,
          },
        );
        if (aplicados > 0) {
          setRows((prev) =>
            prev.map((r) => (mergedById.has(Number(r.id)) ? mergedById.get(Number(r.id)) : r)),
          );
          setDetailItem((prev) =>
            prev && mergedById.has(Number(prev.id)) ? mergedById.get(Number(prev.id)) : prev,
          );
          dispatchRefreshPendentes();
          toast.success(
            aplicados === 1
              ? `1 lançamento vinculado ao imóvel nº ${np}.`
              : `${aplicados.toLocaleString('pt-BR')} lançamentos vinculados ao imóvel nº ${np}.`,
          );
          setSelectedIds(new Set());
        }
        if (erros.length) {
          toast.warn(
            `${erros.length.toLocaleString('pt-BR')} falha(s). ${erros.slice(0, 2).join(' · ')}`,
          );
        }
      } catch (e) {
        toast.error(e?.message || 'Falha ao vincular imóveis em lote.');
      } finally {
        setBulkVinculandoImovel(false);
      }
    },
    [linhasSelecionadas, contaAtiva, contaToLetra, toast],
  );

  if (!featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">
        API financeiro desativada.{' '}
        <a href="/financeiro/legado" className="text-blue-600 hover:underline dark:text-blue-400">
          Abrir consolidado legado
        </a>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <nav
        className="flex gap-0 overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
        aria-label="Contas contábeis"
      >
        {CONTAS_LETRAS.map((cod) => {
          const n = tabCounts[cod];
          return (
            <NavLink
              key={cod}
              to={`/financeiro/consolidado/${cod}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'font-medium border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`
              }
            >
              <ContaBadge codigo={cod} size="sm" />
              <span className="hidden sm:inline max-w-[120px] truncate">{labelContaTab(cod)}</span>
              {n != null ? (
                <span className="text-xs text-slate-400 tabular-nums">
                  ({Number(n).toLocaleString('pt-BR')})
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4 max-w-6xl w-full mx-auto">
        <header>
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ContaBadge codigo={codigoAtivo} size="md" />
            {labelContaTab(codigoAtivo)}
          </h1>
          {contaAtiva ? null : (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              Conta «{codigoAtivo}» não encontrada na API.
            </p>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResumoCard label="Total créditos" value={resumoPagina.creditos} tone="credit" />
          <ResumoCard label="Total débitos" value={resumoPagina.debitos} tone="debit" />
          <ResumoCard
            label="Saldo (página)"
            value={resumoPagina.saldo}
            sub={`${totalElements.toLocaleString('pt-BR')} lançamentos${isPeriodoTotal(mes) ? ' (total)' : ' no período'}`}
          />
        </div>

        <ConsolidadoEvolucaoChart
          resumo={resumoConsolidado}
          codigoAtivo={codigoAtivo}
          loading={chartLoading}
          meses={chartMeses}
          onMesesChange={setChartMeses}
        />

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
            <PeriodoSelector value={mes} onChange={setMes} incluirTotal />
            <EtapaFiltroSelect
              value={filtroEtapa}
              onChange={setFiltroEtapa}
              modoEscritorio={codigoAtivo === 'A'}
              modoImoveis={codigoAtivo === 'I'}
            />
            {codigoAtivo === 'A' ? (
              <>
                <label
                  className={`flex w-[5.5rem] items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${
                    filtroCodDebounced
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80'
                  }`}
                >
                  <span className="text-slate-500 shrink-0">Cód.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={filtroCodLocal}
                    onChange={(e) => setFiltroCodLocal(e.target.value)}
                    placeholder="…"
                    className="w-full min-w-0 bg-transparent border-0 text-slate-900 dark:text-slate-100 focus:outline-none"
                    aria-label="Filtrar por código do cliente"
                  />
                </label>
                <label
                  className={`flex w-[4.5rem] items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${
                    filtroProcDebounced !== ''
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80'
                  }`}
                >
                  <span className="text-slate-500 shrink-0">Proc.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={filtroProcLocal}
                    onChange={(e) => setFiltroProcLocal(e.target.value)}
                    placeholder="…"
                    className="w-full min-w-0 bg-transparent border-0 text-slate-900 dark:text-slate-100 focus:outline-none"
                    aria-label="Filtrar por número do processo"
                  />
                </label>
              </>
            ) : null}
            {codigoAtivo === 'I' ? (
              <>
                <label
                  className={`flex min-w-[5.5rem] items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${
                    filtroImovelDebounced
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80'
                  }`}
                >
                  <span className="text-slate-500 shrink-0">Imóvel</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={filtroImovelLocal}
                    onChange={(e) => setFiltroImovelLocal(e.target.value)}
                    placeholder="…"
                    className="w-full min-w-[1.5rem] max-w-[3rem] bg-transparent border-0 text-slate-900 dark:text-slate-100 focus:outline-none"
                    aria-label="Filtrar por número do imóvel"
                  />
                  {filtroImovelLocal || filtroImovelDebounced ? (
                    <button
                      type="button"
                      onClick={limparFiltroImovel}
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label="Limpar filtro de imóvel"
                      title="Limpar filtro de imóvel"
                    >
                      <X className="w-3 h-3" aria-hidden />
                    </button>
                  ) : null}
                </label>
                <button
                  type="button"
                  onClick={() => setModalFiltroImovel(true)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  aria-label="Buscar imóvel no cadastro"
                  title="Buscar imóvel no cadastro"
                >
                  <Search className="w-3.5 h-3.5" aria-hidden />
                </button>
              </>
            ) : null}
            <label
              className={`flex min-w-[160px] flex-1 max-w-md items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                buscaDebounced
                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-700'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
              <input
                type="search"
                value={buscaLocal}
                onChange={(e) => setBuscaLocal(e.target.value)}
                placeholder="Buscar descrição ou valor…"
                className="flex-1 min-w-0 bg-transparent border-0 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                aria-label="Buscar na descrição ou valor"
              />
              {buscaLocal || buscaDebounced ? (
                <button
                  type="button"
                  onClick={() => {
                    setBuscaLocal('');
                    setBuscaDebounced('');
                  }}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label="Limpar busca"
                  title="Limpar busca"
                >
                  <X className="w-3 h-3" aria-hidden />
                </button>
              ) : null}
            </label>
            {filtroListaAtivo ? (
              <button
                type="button"
                onClick={limparFiltrosLista}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shrink-0"
                title="Limpar todos os filtros da lista"
              >
                <X className="w-3 h-3" aria-hidden />
                Limpar filtros
              </button>
            ) : null}
            <span className="text-xs text-slate-500 ml-auto shrink-0">
              {buscaDebounced || filtroChaveAtivo ? (
                <>
                  {totalElements.toLocaleString('pt-BR')} encontrado{totalElements === 1 ? '' : 's'}
                  {rows.length > 0 ? (
                    <span className="block text-[10px]">
                      exibindo {rows.length.toLocaleString('pt-BR')} nesta página
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {rows.length} na página · {totalElements.toLocaleString('pt-BR')}{' '}
                  {isPeriodoTotal(mes) ? 'no total' : 'no período'}
                </>
              )}
            </span>
          </div>
          {filtroListaAtivo && totalElements > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 text-xs">
              <span className="font-medium text-indigo-900 dark:text-indigo-200">
                Soma dos {totalElements.toLocaleString('pt-BR')} filtrados
              </span>
              {loadingResumoFiltrados || !resumoFiltrados ? (
                <span className="text-slate-500">Calculando…</span>
              ) : (
                <>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    Créditos {fmtBrl.format(resumoFiltrados.creditos)}
                  </span>
                  <span className="text-red-700 dark:text-red-400 tabular-nums">
                    Débitos {fmtBrl.format(resumoFiltrados.debitos)}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      Number(resumoFiltrados.saldo) < 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    Saldo {fmtBrl.format(resumoFiltrados.saldo)}
                  </span>
                </>
              )}
            </div>
          ) : null}
          {erro ? (
            <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{erro}</p>
          ) : null}
          {codigoAtivo === 'I' ? (
            <ConsolidadoImoveisBatchBar
              count={selectedIds.size}
              busy={bulkVinculandoImovel}
              onVincularImovel={() => setModalVinculoImovelLote(true)}
              onLimparSelecao={() => setSelectedIds(new Set())}
            />
          ) : null}
          <ExtratoTable
            data={rows}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            onSelectAll={toggleSelectAll}
            onRowClick={setDetailItem}
            isLoading={loadingTable}
            etapaModoEscritorio={codigoAtivo === 'A'}
            etapaModoImoveis={codigoAtivo === 'I'}
          />
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
        </section>
      </div>

      {detailItem ? (
        <>
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/20"
            aria-label="Fechar painel"
            onClick={() => setDetailItem(null)}
          />
          <ExtratoDetailPanel
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onSaved={(updated) => {
              setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
              setDetailItem(updated);
            }}
            onDeleted={(apiId) => {
              setRows((prev) => prev.filter((r) => Number(r.id) !== Number(apiId)));
              setTotalElements((n) => Math.max(0, Number(n) - 1));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(apiId);
                return next;
              });
              setDetailItem(null);
            }}
          />
        </>
      ) : null}

      <ModalBuscaImovel
        open={modalVinculoImovelLote}
        onClose={() => setModalVinculoImovelLote(false)}
        onSelecionar={(im) => void handleVincularImovelLote(im)}
      />

      <ModalBuscaImovel
        open={modalFiltroImovel}
        onClose={() => setModalFiltroImovel(false)}
        onSelecionar={(im) => {
          const np = normalizarNumeroImovelFinanceiro(im?.numeroPlanilha);
          if (np) setFiltroImovelLocal(np);
          setModalFiltroImovel(false);
        }}
      />
    </div>
  );
}

function ResumoCard({ label, value, sub, tone }) {
  const color =
    tone === 'credit'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'debit'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <p className={`text-xl font-medium tabular-nums ${color}`}>{fmtBrl.format(Number(value) || 0)}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      {sub ? <p className="text-xs text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}
