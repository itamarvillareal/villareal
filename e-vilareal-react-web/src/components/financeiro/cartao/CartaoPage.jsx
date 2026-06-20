import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CreditCard, Search, Trash2, Upload } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
  montarContasContabeisParaSelectExtrato,
} from '../../../data/financeiroData.js';
import {
  listarCartoesFinanceiro,
  listarContasFinanceiro,
  listarLancamentosCartaoFinanceiro,
  buscarLancamentoCartaoFinanceiroApi,
  removerLancamentosCartaoFinanceiroApiEmLote,
  salvarOuAtualizarLancamentoCartaoFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { Pagination } from '../shared/Pagination.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { formatDataCurta, formatMoeda } from '../shared/financeiroFormat.js';
import {
  listarVencimentosFaturaCartao,
  valorAssinadoLinhaCartao,
  vencimentoFaturaDeLancamento,
  ehLancamentoFechamentoAutomatico,
} from '../../../utils/cartaoFaturaVencimento.js';
import { LimparContaDialog } from '../shared/LimparContaDialog.jsx';
import { FaturaCartaoImportModal } from './FaturaCartaoImportModal.jsx';
import { FINANCEIRO_CONTA_LIMPA } from '../extrato/limparContaFinanceiro.js';
import { FINANCEIRO_CARTAO_IMPORTADO } from '../constants/financeiroConstants.js';
import { ExtratoTable } from '../extrato/ExtratoTable.jsx';
import { ExtratoDetailPanel } from '../extrato/ExtratoDetailPanel.jsx';
import { ExtratoBatchBar } from '../extrato/ExtratoBatchBar.jsx';
import { EtapaFiltroSelect } from '../shared/EtapaFiltroSelect.jsx';
import {
  extratoRowToUi,
  mapApiLancamentoCartaoToExtratoRow,
  mergeExtratoRowComRespostaApiCartao,
} from '../extrato/extratoMappers.js';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import {
  paginaDoLancamentoNaLista,
  scrollExtratoParaLancamento,
} from '../extrato/extratoDeepLink.js';

function linhaBateBuscaNome(row, termo) {
  const t = String(termo ?? '').trim().toLowerCase();
  if (!t) return true;
  const texto = [
    row.descricao,
    row.descricaoDetalhada,
    row.observacao,
    row.contaContabilNome,
  ]
    .map((c) => String(c ?? '').toLowerCase())
    .join(' ');
  return texto.includes(t);
}

export function CartaoPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const lancamentoFocusId = searchParams.get('lancamento');
  const lancamentoFocusRef = useRef(null);
  const numeroParam = id != null && id !== '' ? Number(id) : null;
  const toast = useFinanceiroToast();

  const [cartoes, setCartoes] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortDataAsc, setSortDataAsc] = useState(false);
  const [limparOpen, setLimparOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [vencimentoFiltro, setVencimentoFiltro] = useState('');
  const [etapaFiltro, setEtapaFiltro] = useState('');
  const [buscaNome, setBuscaNome] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [detailItem, setDetailItem] = useState(null);
  const [contasApi, setContasApi] = useState([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [contaLoteId, setContaLoteId] = useState('');
  const [bulkClassifying, setBulkClassifying] = useState(false);

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  const contasExtrato = useMemo(() => montarContasContabeisParaSelectExtrato(contasApi), [contasApi]);
  const bulkBusy = bulkDeleting || bulkClassifying;

  const cartaoAtivo = useMemo(() => {
    if (!numeroParam || !Number.isFinite(numeroParam)) return null;
    return cartoes.find((c) => Number(c.numeroCartao) === numeroParam) ?? null;
  }, [cartoes, numeroParam]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    Promise.all([
      listarCartoesFinanceiro({ signal: ac.signal }),
      listarContasFinanceiro({ signal: ac.signal }),
    ])
      .then(([c, contas]) => {
        setCartoes(Array.isArray(c) ? c : []);
        setContasApi(Array.isArray(contas) ? contas : []);
      })
      .catch(() => {
        setCartoes([]);
        setContasApi([]);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || !cartaoAtivo?.id) {
      setRows([]);
      return undefined;
    }
    const ac = new AbortController();
    setLoading(true);
    setErro('');
    listarLancamentosCartaoFinanceiro({ cartaoId: cartaoAtivo.id }, { signal: ac.signal })
      .then((lista) => {
        const mapped = (Array.isArray(lista) ? lista : [])
          .map((l) => mapApiLancamentoCartaoToExtratoRow(l, contaToLetra))
          .filter((row) => !ehLancamentoFechamentoAutomatico(row));
        setRows(mapped);
        setSelectedIds(new Set());
        setDetailItem(null);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Erro ao carregar extrato do cartão.');
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [cartaoAtivo?.id, reloadKey, contaToLetra]);

  useEffect(() => {
    const onContaLimpa = (event) => {
      const detail = event?.detail ?? {};
      if (detail.tipo !== 'cartao') return;
      if (
        detail.numeroCartao != null &&
        cartaoAtivo?.numeroCartao != null &&
        Number(detail.numeroCartao) !== Number(cartaoAtivo.numeroCartao)
      ) {
        return;
      }
      setRows([]);
      setSelectedIds(new Set());
      setDetailItem(null);
      setReloadKey((n) => n + 1);
    };
    const onCartaoImportado = () => setReloadKey((n) => n + 1);
    window.addEventListener(FINANCEIRO_CONTA_LIMPA, onContaLimpa);
    window.addEventListener(FINANCEIRO_CARTAO_IMPORTADO, onCartaoImportado);
    return () => {
      window.removeEventListener(FINANCEIRO_CONTA_LIMPA, onContaLimpa);
      window.removeEventListener(FINANCEIRO_CARTAO_IMPORTADO, onCartaoImportado);
    };
  }, [cartaoAtivo?.numeroCartao]);

  useEffect(() => {
    setPage(0);
    setVencimentoFiltro('');
    setEtapaFiltro('');
    setBuscaNome('');
    setSelectedIds(new Set());
    setDetailItem(null);
  }, [cartaoAtivo?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const vencimentosDisponiveis = useMemo(
    () =>
      listarVencimentosFaturaCartao(rows).map((v) => ({
        iso: v.iso,
        label: formatDataCurta(v.iso),
        count: v.count,
        total: v.total,
      })),
    [rows],
  );

  useEffect(() => {
    if (vencimentoFiltro || vencimentosDisponiveis.length !== 1) return;
    setVencimentoFiltro(vencimentosDisponiveis[0].iso);
  }, [vencimentoFiltro, vencimentosDisponiveis]);

  const rowsFiltradas = useMemo(() => {
    let list = rows;
    if (etapaFiltro) {
      list = list.filter((row) => String(row.etapa ?? 'IMPORTADO').toUpperCase() === etapaFiltro);
    }
    if (vencimentoFiltro) {
      list = list.filter((row) => vencimentoFaturaDeLancamento(row) === vencimentoFiltro);
    }
    if (buscaNome.trim()) {
      list = list.filter((row) => linhaBateBuscaNome(row, buscaNome));
    }
    list = [...list].sort((a, b) => {
      const da = String(a.dataLancamento ?? '');
      const db = String(b.dataLancamento ?? '');
      const cmp = da.localeCompare(db);
      return sortDataAsc ? cmp : -cmp;
    });
    return list;
  }, [rows, vencimentoFiltro, etapaFiltro, buscaNome, sortDataAsc]);

  const somaFatura = useMemo(
    () => rowsFiltradas.reduce((s, row) => s + valorAssinadoLinhaCartao(row), 0),
    [rowsFiltradas],
  );

  const total = rowsFiltradas.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rowsFiltradas.slice(page * pageSize, page * pageSize + pageSize);

  const focarLancamentoNaLista = useCallback(
    (row) => {
      if (!row?.id) return;
      let lista = rowsFiltradas;
      if (!lista.some((r) => Number(r.id) === Number(row.id))) {
        setVencimentoFiltro('');
        setBuscaNome('');
        lista = rows;
      }
      const pagina = paginaDoLancamentoNaLista(lista, row.id, pageSize);
      if (pagina != null) setPage(pagina);
      setDetailItem(row);
      lancamentoFocusRef.current = String(row.id);
      requestAnimationFrame(() => scrollExtratoParaLancamento(row.id));
    },
    [rows, rowsFiltradas, pageSize],
  );

  useEffect(() => {
    const idFocus = Number(lancamentoFocusId);
    if (!idFocus || !featureFlags.useApiFinanceiro || loading) return undefined;
    if (lancamentoFocusRef.current === String(idFocus)) return undefined;

    const naLista = rows.find((r) => Number(r.id) === idFocus);
    if (naLista) {
      focarLancamentoNaLista(naLista);
      return undefined;
    }

    if (rows.length === 0) return undefined;

    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const api = await buscarLancamentoCartaoFinanceiroApi(idFocus, { signal: ac.signal });
        if (cancelled || !api) return;
        const mapped = mapApiLancamentoCartaoToExtratoRow(api, contaToLetra);
        if (Number(api.numeroCartao) !== Number(cartaoAtivo?.numeroCartao)) {
          setErro(
            `Lançamento ${idFocus} pertence ao cartão ${api.cartaoNome ?? api.numeroCartao}, não a este extrato.`,
          );
          return;
        }
        setDetailItem(mapped);
        lancamentoFocusRef.current = String(idFocus);
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
  }, [
    lancamentoFocusId,
    rows,
    loading,
    cartaoAtivo?.numeroCartao,
    contaToLetra,
    focarLancamentoNaLista,
  ]);

  useEffect(() => {
    if (!lancamentoFocusId) lancamentoFocusRef.current = null;
  }, [lancamentoFocusId]);

  useEffect(() => {
    const idFocus = Number(lancamentoFocusId);
    if (!idFocus || loading) return undefined;
    const naPagina = pageRows.find((r) => Number(r.id) === idFocus);
    if (!naPagina) return undefined;
    requestAnimationFrame(() => scrollExtratoParaLancamento(idFocus));
    return undefined;
  }, [lancamentoFocusId, pageRows, loading]);

  const toggleSelect = useCallback((rowId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = pageRows.map((r) => r.id);
      const all = ids.length > 0 && ids.every((rowId) => prev.has(rowId));
      return all ? new Set() : new Set(ids);
    });
  }, [pageRows]);

  const handleRowClick = useCallback((item) => {
    setDetailItem(item);
  }, []);

  const handleRowSaved = useCallback((updated) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetailItem(updated);
    dispatchRefreshPendentes();
  }, []);

  const handleRowDeleted = useCallback((apiId) => {
    setRows((prev) => prev.filter((r) => Number(r.id) !== Number(apiId)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(apiId);
      return next;
    });
    setDetailItem(null);
    dispatchRefreshPendentes();
  }, []);

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
    let aplicados = 0;
    const erros = [];

    setBulkClassifying(true);
    try {
      for (const rowId of ids) {
        const row = rowById.get(Number(rowId));
        if (!row) {
          erros.push(`${rowId}: não encontrado`);
          continue;
        }
        const limparVinculo = cod === 'E';
        const nextRow = {
          ...row,
          contaCodigo: cod,
          contaContabilId: conta.id,
          contaContabilNome: conta.nome ?? row.contaContabilNome,
          ...(limparVinculo
            ? { codCliente: '', proc: '', clienteId: null, processoId: null, pessoaRefId: null }
            : {}),
        };
        try {
          const ui = extratoRowToUi(nextRow);
          const saved = await salvarOuAtualizarLancamentoCartaoFinanceiroApi(ui);
          if (!saved?.id) {
            erros.push(`${rowId}: falha ao salvar`);
            continue;
          }
          const merged = mergeExtratoRowComRespostaApiCartao(nextRow, saved, contaToLetra);
          rowById.set(Number(rowId), merged);
          aplicados += 1;
        } catch (e) {
          erros.push(`${rowId}: ${e?.message || 'erro'}`);
        }
      }

      setRows((prev) => prev.map((r) => rowById.get(Number(r.id)) ?? r));
      setDetailItem((prev) => {
        if (!prev || !selectedIds.has(prev.id)) return prev;
        return rowById.get(Number(prev.id)) ?? prev;
      });

      dispatchRefreshPendentes();

      if (aplicados > 0) {
        toast.success(
          aplicados === 1
            ? `1 lançamento alterado para conta ${cod}.`
            : `${aplicados.toLocaleString('pt-BR')} lançamentos alterados para conta ${cod}.`,
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

  const handleConfirmBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) {
      setConfirmBulkDelete(false);
      return;
    }
    setBulkDeleting(true);
    try {
      const { removidos, erros } = await removerLancamentosCartaoFinanceiroApiEmLote(ids);
      if (removidos.length) {
        const removedSet = new Set(removidos.map((rowId) => Number(rowId)));
        setRows((prev) => prev.filter((r) => !removedSet.has(Number(r.id))));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const rowId of removidos) next.delete(rowId);
          return next;
        });
        setDetailItem((prev) => (prev && removedSet.has(Number(prev.id)) ? null : prev));
        dispatchRefreshPendentes();
        toast.success(
          removidos.length === 1
            ? '1 lançamento excluído do cartão.'
            : `${removidos.length.toLocaleString('pt-BR')} lançamentos excluídos do cartão.`,
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
    return <p className="p-4 text-sm text-slate-600">API financeiro desativada.</p>;
  }

  if (!numeroParam || !Number.isFinite(numeroParam)) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Cartões</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cartoes.map((c) => (
            <li key={c.id}>
              <Link
                to={`/financeiro/cartao/${c.numeroCartao}`}
                className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400 transition-colors"
              >
                <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
        {cartoes.length === 0 ? (
          <p className="text-sm text-slate-500 mt-4">Nenhum cartão cadastrado.</p>
        ) : null}
      </div>
    );
  }

  if (!cartaoAtivo) {
    return (
      <p className="p-4 text-sm text-slate-600">
        Cartão não encontrado.{' '}
        <Link to="/financeiro/cartao" className="text-blue-600 hover:underline">
          Ver lista
        </Link>
      </p>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 h-full bg-white dark:bg-slate-900">
      <header className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {cartaoAtivo.nome}
          </h2>
          <EtapaFiltroSelect
            value={etapaFiltro}
            onChange={(v) => {
              setEtapaFiltro(v);
              setPage(0);
            }}
          />
          {vencimentosDisponiveis.length > 0 ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="whitespace-nowrap">Vencimento</span>
              <select
                value={vencimentoFiltro}
                onChange={(e) => {
                  setVencimentoFiltro(e.target.value);
                  setPage(0);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Todas as faturas ({rows.length})</option>
                {vencimentosDisponiveis.map((v) => (
                  <option key={v.iso} value={v.iso}>
                    Venc. {v.label} · {formatMoeda(v.total)} ({v.count})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="inline-flex items-center gap-1.5 min-w-[10rem] max-w-[14rem] flex-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
            <input
              type="search"
              value={buscaNome}
              onChange={(e) => {
                setBuscaNome(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por nome..."
              className="flex-1 min-w-0 bg-transparent border-0 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              aria-label="Buscar lançamento por nome na descrição"
            />
          </label>
          {(rowsFiltradas.length > 0 || buscaNome.trim()) ? (
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
              {buscaNome.trim() ? (
                <>
                  {rowsFiltradas.length.toLocaleString('pt-BR')} encontrado
                  {rowsFiltradas.length === 1 ? '' : 's'}
                  {vencimentoFiltro ? ` · venc. ${formatDataCurta(vencimentoFiltro)}` : ''}
                </>
              ) : vencimentoFiltro ? (
                <>
                  Fatura venc. {formatDataCurta(vencimentoFiltro)}: {formatMoeda(somaFatura)}
                  {' · '}
                  {rowsFiltradas.length} lanç.
                </>
              ) : (
                <>Total geral: {formatMoeda(somaFatura)}</>
              )}
            </span>
          ) : null}
          {rows.length > 0 && vencimentosDisponiveis.length === 0 ? (
            <span className="text-[11px] text-amber-800 dark:text-amber-300/90">
              Importe a fatura (Excel) para definir o vencimento único de cada fatura.
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
          >
            <Upload className="w-3 h-3" aria-hidden />
            Importar fatura
          </button>
          <button
            type="button"
            onClick={() => setLimparOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
          >
            <Trash2 className="w-3 h-3" aria-hidden />
            Limpar cartão
          </button>
          <Link
            to="/financeiro/fatura/fechamentos"
            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          >
            Fechamentos AUTO-FAT
          </Link>
          <Link to="/financeiro/cartao" className="text-xs text-blue-600 hover:underline">
            Todos os cartões
          </Link>
        </div>
      </header>

      <ExtratoBatchBar
        count={selectedIds.size}
        busy={bulkBusy}
        contas={contasExtrato}
        contaLoteId={contaLoteId}
        onContaLoteChange={setContaLoteId}
        onAplicarLetra={handleBulkTrocarLetra}
        onExcluir={() => setConfirmBulkDelete(true)}
        onLimparSelecao={handleLimparSelecao}
      />

      <LimparContaDialog
        open={limparOpen}
        tipo="cartao"
        nome={cartaoAtivo.nome}
        numero={cartaoAtivo.numeroCartao}
        onClose={() => setLimparOpen(false)}
        onSuccess={() => setReloadKey((n) => n + 1)}
      />

      <FaturaCartaoImportModal
        open={importOpen}
        cartao={cartaoAtivo}
        onClose={() => setImportOpen(false)}
        onSuccess={() => setReloadKey((n) => n + 1)}
      />

      {erro ? (
        <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400 shrink-0">{erro}</p>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <ExtratoSkeleton />
        ) : (
          <ExtratoTable
            data={pageRows}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            onSelectAll={toggleSelectAll}
            onRowClick={handleRowClick}
            isLoading={false}
            sortDataAsc={sortDataAsc}
            onSortDataDoubleClick={() => setSortDataAsc((v) => !v)}
            modoCartao
            highlightLancamentoId={lancamentoFocusId ? Number(lancamentoFocusId) : null}
          />
        )}
      </div>

      {rowsFiltradas.length > 0 && !loading ? (
        <div className="shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-400">
            {vencimentoFiltro
              ? `Total fatura (venc. ${formatDataCurta(vencimentoFiltro)})`
              : 'Total geral'}
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatMoeda(somaFatura)} · {rowsFiltradas.length} itens
          </span>
        </div>
      ) : null}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {detailItem ? (
        <ExtratoDetailPanel
          item={detailItem}
          fonteExtrato="cartao"
          onClose={() => setDetailItem(null)}
          onSaved={handleRowSaved}
          onDeleted={handleRowDeleted}
        />
      ) : null}

      <ConfirmDialog
        open={confirmBulkDelete}
        title="Excluir lançamentos selecionados?"
        message={`${selectedIds.size.toLocaleString('pt-BR')} lançamento(s) serão removidos permanentemente do cartão.`}
        confirmLabel={bulkDeleting ? 'Excluindo…' : 'Excluir'}
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => !bulkDeleting && setConfirmBulkDelete(false)}
      />
    </div>
  );
}
