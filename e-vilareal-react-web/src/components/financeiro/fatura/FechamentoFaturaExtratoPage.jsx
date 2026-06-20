import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  listarCartoesFinanceiro,
  listarContasFinanceiro,
  listarLancamentosCartaoFinanceiro,
  listarVinculosPagamentoFaturaApi,
} from '../../../repositories/financeiroRepository.js';
import { Pagination } from '../shared/Pagination.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { formatDataCurta, formatMoeda } from '../shared/financeiroFormat.js';
import { ExtratoTable } from '../extrato/ExtratoTable.jsx';
import { ExtratoDetailPanel } from '../extrato/ExtratoDetailPanel.jsx';
import { EtapaFiltroSelect } from '../shared/EtapaFiltroSelect.jsx';
import { mapApiLancamentoCartaoToExtratoRow } from '../extrato/extratoMappers.js';

function inicioFimMes(mesIso) {
  const [y, m] = String(mesIso ?? '').split('-').map(Number);
  if (!y || !m) return { inicio: undefined, fim: undefined };
  const ultimo = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    inicio: `${y}-${pad(m)}-01`,
    fim: `${y}-${pad(m)}-${pad(ultimo)}`,
  };
}

/** Extrato consolidado de fechamentos automáticos (AUTO-FAT) — todos os cartões. */
export function FechamentoFaturaExtratoPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [cartoes, setCartoes] = useState([]);
  const [contasApi, setContasApi] = useState([]);
  const [cartaoFiltro, setCartaoFiltro] = useState('');
  const [mes, setMes] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [etapaFiltro, setEtapaFiltro] = useState('');
  const [vinculadosIds, setVinculadosIds] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortDataAsc, setSortDataAsc] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    Promise.all([
      listarCartoesFinanceiro({ signal: ac.signal }),
      listarContasFinanceiro({ signal: ac.signal }),
      listarVinculosPagamentoFaturaApi().catch(() => []),
    ])
      .then(([c, contas, vinculos]) => {
        setCartoes(Array.isArray(c) ? c : []);
        setContasApi(Array.isArray(contas) ? contas : []);
        const ids = new Set(
          (Array.isArray(vinculos) ? vinculos : []).map((v) => Number(v.lancamentoCartaoId)).filter(Boolean),
        );
        setVinculadosIds(ids);
      })
      .catch(() => {
        setCartoes([]);
        setContasApi([]);
      });
    return () => ac.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setRows([]);
      return undefined;
    }
    const ac = new AbortController();
    const { inicio, fim } = mes ? inicioFimMes(mes) : { inicio: undefined, fim: undefined };
    setLoading(true);
    setErro('');
    listarLancamentosCartaoFinanceiro(
      {
        fechamentoAutomatico: true,
        cartaoId: cartaoFiltro ? Number(cartaoFiltro) : undefined,
        dataInicio: inicio,
        dataFim: fim,
      },
      { signal: ac.signal },
    )
      .then((lista) => {
        let mapped = (Array.isArray(lista) ? lista : []).map((l) => {
          const row = mapApiLancamentoCartaoToExtratoRow(l, contaToLetra);
          const vinculado = vinculadosIds.has(Number(l.id));
          return {
            ...row,
            observacao: vinculado ? 'Pagamento bancário vinculado' : 'Aguardando débito no banco',
            vinculadoBanco: vinculado,
          };
        });
        if (statusFiltro === 'pendente') {
          mapped = mapped.filter((r) => !r.vinculadoBanco && String(r.contaCodigo) === 'N');
        } else if (statusFiltro === 'conferido') {
          mapped = mapped.filter((r) => r.vinculadoBanco || String(r.contaCodigo) === 'E');
        }
        if (etapaFiltro) {
          mapped = mapped.filter(
            (r) => String(r.etapa ?? 'IMPORTADO').toUpperCase() === etapaFiltro,
          );
        }
        setRows(mapped);
        setPage(0);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Erro ao carregar fechamentos.');
        setRows([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [mes, cartaoFiltro, statusFiltro, etapaFiltro, contaToLetra, vinculadosIds, reloadKey]);

  const rowsOrdenadas = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = String(a.dataLancamento ?? '');
      const db = String(b.dataLancamento ?? '');
      const cmp = da.localeCompare(db);
      if (cmp !== 0) return sortDataAsc ? cmp : -cmp;
      return String(a.cartaoNome ?? '').localeCompare(String(b.cartaoNome ?? ''));
    });
  }, [rows, sortDataAsc]);

  const total = rowsOrdenadas.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rowsOrdenadas.slice(page * pageSize, page * pageSize + pageSize);

  const somaPagina = useMemo(
    () => rowsOrdenadas.reduce((s, r) => s + (r.natureza === 'DEBITO' ? -r.valor : r.valor), 0),
    [rowsOrdenadas],
  );

  const handleRowSaved = useCallback((updated) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetailItem(updated);
    setReloadKey((n) => n + 1);
  }, []);

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

  if (!featureFlags.useApiFinanceiro) {
    return <p className="p-4 text-sm text-slate-600">API financeiro desativada.</p>;
  }

  return (
    <div className="relative flex flex-col min-h-0 h-full bg-white dark:bg-slate-900">
      <header className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Extrato fechamentos fatura (AUTO-FAT)
          </h2>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span>Mês</span>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
            />
            {mes ? (
              <button
                type="button"
                onClick={() => setMes('')}
                className="text-blue-600 hover:underline"
              >
                Todos
              </button>
            ) : (
              <span className="text-slate-400">(todos)</span>
            )}
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span>Cartão</span>
            <select
              value={cartaoFiltro}
              onChange={(e) => setCartaoFiltro(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 max-w-[10rem]"
            >
              <option value="">Todos</option>
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <EtapaFiltroSelect
            value={etapaFiltro}
            onChange={(v) => {
              setEtapaFiltro(v);
              setPage(0);
            }}
          />
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span>Status</span>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Aguardando banco (N)</option>
              <option value="conferido">Vinculado / conta E</option>
            </select>
          </label>
          {total > 0 ? (
            <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {total} lanç. · Σ {formatMoeda(somaPagina)}
            </span>
          ) : null}
        </div>
        <Link to="/financeiro/fatura" className="text-xs text-blue-600 hover:underline shrink-0">
          Regras e vínculos
        </Link>
      </header>

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
            onRowClick={setDetailItem}
            isLoading={false}
            sortDataAsc={sortDataAsc}
            onSortDataDoubleClick={() => setSortDataAsc((v) => !v)}
            modoCartao
            modoFechamentoFatura
          />
        )}
      </div>

      {total > 0 && !loading ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}

      {detailItem ? (
        <ExtratoDetailPanel
          item={detailItem}
          fonteExtrato="cartao"
          contas={contasApi}
          onClose={() => setDetailItem(null)}
          onSaved={handleRowSaved}
          onDeleted={() => {
            setDetailItem(null);
            setReloadKey((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}
