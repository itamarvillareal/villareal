import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Link2Off, Loader2 } from 'lucide-react';
import {
  conferirLancamentosAcertoApi,
  desparearCompensacaoApi,
  listarLancamentosExtratoPaginados,
  obterTotaisExtratoApi,
} from '../../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../../shared/financeiroFormat.js';
import { Pagination } from '../../shared/Pagination.jsx';
import { ConfirmDialog } from '../../shared/ConfirmDialog.jsx';
import { useFinanceiroToast } from '../../shared/Toast.jsx';
import {
  fmtDataAcerto,
  fmtDataHoraAcerto,
  lancamentoPendente,
  refExibicaoAcerto,
  valorAssinadoAcerto,
} from './acertoUtils.js';

const BUSCA_DEBOUNCE_MS = 350;

/**
 * Aba "Lançamentos" do acerto (Etapa 5): paginação server-side com filtros, barra de totais
 * do recorte filtrado (backend), conferência individual e desparear na tela.
 */
export function AcertoLancamentosView({
  numeroBanco,
  clienteId,
  refreshKey,
  onRefresh,
  selectedIds,
  onToggleSelect,
  onAbrirLancamento,
  versaoLancamentos,
}) {
  const toast = useFinanceiroToast();
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [procFiltro, setProcFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);
  const [soOcultos, setSoOcultos] = useState(false);
  const [soNaoConferidos, setSoNaoConferidos] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totais, setTotais] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [conferindoId, setConferindoId] = useState(null);
  const [desparearGrupo, setDesparearGrupo] = useState(null);
  const [despareando, setDespareando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), BUSCA_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busca]);

  const filtros = useMemo(
    () => ({
      numeroBanco,
      clienteId,
      busca: buscaDebounced || undefined,
      numeroInternoProcesso: procFiltro.trim() !== '' ? procFiltro.trim() : undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      semGrupoCompensacao: soPendentes,
      visivelCliente: soOcultos ? false : undefined,
      conferido: soNaoConferidos ? false : undefined,
    }),
    [numeroBanco, clienteId, buscaDebounced, procFiltro, dataInicio, dataFim, soPendentes, soOcultos, soNaoConferidos],
  );

  useEffect(() => {
    setPage(0);
  }, [buscaDebounced, procFiltro, dataInicio, dataFim, soPendentes, soOcultos, soNaoConferidos]);

  useEffect(() => {
    if (numeroBanco == null || !clienteId) return undefined;
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    Promise.all([
      listarLancamentosExtratoPaginados(
        { ...filtros, page, size: pageSize, sort: 'dataLancamento,asc' },
        { signal: ac.signal },
      ),
      obterTotaisExtratoApi(filtros, { signal: ac.signal }),
    ])
      .then(([res, tot]) => {
        setRows(res?.content ?? []);
        setTotalElements(Number(res?.totalElements ?? 0));
        setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
        setTotais(tot ?? null);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') {
          setErro(e?.message || 'Falha ao carregar lançamentos.');
          setRows([]);
          setTotais(null);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setCarregando(false);
      });
    return () => ac.abort();
  }, [numeroBanco, clienteId, filtros, page, pageSize, refreshKey, versaoLancamentos]);

  const conferirLinha = async (l) => {
    const marcar = !l.conferidoEm;
    setConferindoId(l.id);
    try {
      await conferirLancamentosAcertoApi({ lancamentoIds: [Number(l.id)], conferido: marcar });
      onRefresh?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao marcar conferência.');
    } finally {
      setConferindoId(null);
    }
  };

  const confirmarDesparear = async () => {
    if (!desparearGrupo) return;
    setDespareando(true);
    try {
      await desparearCompensacaoApi(desparearGrupo);
      toast.success(`Grupo ${desparearGrupo} despareado.`);
      onRefresh?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao desparear o grupo.');
    } finally {
      setDespareando(false);
      setDesparearGrupo(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          Busca (devedor/descrição)
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="ex.: nome do devedor"
            className="w-52 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Proc (nº interno)
          <input
            type="text"
            inputMode="numeric"
            value={procFiltro}
            onChange={(e) => setProcFiltro(e.target.value.replace(/\D/g, ''))}
            placeholder="ex.: 1234"
            className="w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          De
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Até
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
          />
        </label>
        <label className="inline-flex items-center gap-1.5 pb-1.5">
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
          só pendentes
        </label>
        <label className="inline-flex items-center gap-1.5 pb-1.5">
          <input type="checkbox" checked={soOcultos} onChange={(e) => setSoOcultos(e.target.checked)} />
          só ocultos do cliente
        </label>
        <label className="inline-flex items-center gap-1.5 pb-1.5">
          <input
            type="checkbox"
            checked={soNaoConferidos}
            onChange={(e) => setSoNaoConferidos(e.target.checked)}
          />
          só não conferidos
        </label>
      </div>

      {totais ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur px-3 py-2 text-xs">
          <span>
            <strong>{Number(totais.quantidade).toLocaleString('pt-BR')}</strong> lançamentos no recorte
          </span>
          <span className="text-emerald-700 dark:text-emerald-300">
            créditos {formatMoeda(Number(totais.somaCreditos ?? 0))}
          </span>
          <span className="text-red-700 dark:text-red-300">
            débitos {formatMoeda(Number(totais.somaDebitos ?? 0))}
          </span>
          <span className="font-semibold">saldo {formatMoeda(Number(totais.saldo ?? 0))}</span>
          <span className={Number(totais.pendentes) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}>
            {Number(totais.pendentes).toLocaleString('pt-BR')} sem grupo
          </span>
          <span className={Number(totais.naoConferidos) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}>
            {Number(totais.naoConferidos).toLocaleString('pt-BR')} sem conferir
          </span>
          {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : null}
        </div>
      ) : null}

      {erro ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-left">
              <tr>
                <th className="px-2 py-1.5 w-6" />
                <th className="px-2 py-1.5">Data</th>
                <th className="px-2 py-1.5">Nº</th>
                <th className="px-2 py-1.5">Ref</th>
                <th className="px-2 py-1.5">Descrição</th>
                <th className="px-2 py-1.5">Grupo</th>
                <th className="px-2 py-1.5 text-center">Cliente vê</th>
                <th className="px-2 py-1.5 text-center">Conf.</th>
                <th className="px-2 py-1.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const v = valorAssinadoAcerto(l);
                const pendente = lancamentoPendente(l);
                return (
                  <tr
                    key={l.id}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => onAbrirLancamento?.(l)}
                  >
                    <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(Number(l.id))}
                        onChange={() => onToggleSelect?.(Number(l.id), l)}
                      />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{fmtDataAcerto(l.dataLancamento)}</td>
                    <td className="px-2 py-1 font-mono text-[10px] whitespace-nowrap">
                      {l.numeroLancamento || l.id}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{refExibicaoAcerto(l)}</td>
                    <td className="px-2 py-1 max-w-[320px]">
                      <span className="block truncate" title={l.descricao}>
                        {l.descricao}
                      </span>
                      {String(l.descricaoDetalhada ?? '').trim() ? (
                        <span className="block truncate text-[10px] text-slate-400" title={l.descricaoDetalhada}>
                          {l.descricaoDetalhada}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {pendente ? (
                        <span className="text-amber-700 dark:text-amber-300">pendente</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {l.grupoCompensacao}
                          <button
                            type="button"
                            title="Desparear este grupo"
                            onClick={() => setDesparearGrupo(String(l.grupoCompensacao))}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Link2Off className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {l.visivelCliente === false
                        ? 'não'
                        : l.valorCliente != null
                          ? `sim (${formatMoeda(Number(l.valorCliente))})`
                          : 'sim'}
                    </td>
                    <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={conferindoId === l.id}
                        onClick={() => void conferirLinha(l)}
                        title={
                          l.conferidoEm
                            ? `Conferido em ${fmtDataHoraAcerto(l.conferidoEm)}${l.conferidoPorNome ? ` por ${l.conferidoPorNome}` : ''} — clique para desfazer`
                            : 'Marcar como conferido'
                        }
                        className="disabled:opacity-50"
                      >
                        {conferindoId === l.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : l.conferidoEm ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                    </td>
                    <td
                      className={`px-2 py-1 text-right tabular-nums font-medium whitespace-nowrap ${
                        v < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {formatMoeda(v)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !carregando ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Nenhum lançamento neste recorte.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
      </div>

      <ConfirmDialog
        open={desparearGrupo != null}
        title="Desparear o grupo?"
        message={`Todos os lançamentos do grupo ${desparearGrupo ?? ''} voltarão a ficar pendentes de compensação.`}
        confirmLabel={despareando ? 'Despareando…' : 'Desparear'}
        danger
        onCancel={() => setDesparearGrupo(null)}
        onConfirm={() => void confirmarDesparear()}
      />
    </div>
  );
}
