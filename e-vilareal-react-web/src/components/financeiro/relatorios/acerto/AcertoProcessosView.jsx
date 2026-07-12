import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Loader2 } from 'lucide-react';
import {
  conferirProcessoAcertoApi,
  listarLancamentosExtratoPaginados,
  obterAcertoResumoProcessosApi,
} from '../../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../../shared/financeiroFormat.js';
import { useFinanceiroToast } from '../../shared/Toast.jsx';
import {
  fmtDataAcerto,
  fmtDataHoraAcerto,
  lancamentoPendente,
  valorAssinadoAcerto,
} from './acertoUtils.js';

const CHAVE_SEM_PROC = 'sem-proc';

function chaveProc(p) {
  return p.processoId != null ? String(p.processoId) : CHAVE_SEM_PROC;
}

/**
 * Visão do acerto agrupada por processo (Etapa 5): somas por proc, expansão sob demanda dos
 * lançamentos, conferência em cascata com progresso (Etapa 5b).
 */
export function AcertoProcessosView({
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
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);
  const [soNaoConferidos, setSoNaoConferidos] = useState(false);

  const [expandido, setExpandido] = useState(() => new Set());
  const [lancamentosPorProc, setLancamentosPorProc] = useState({});
  const [carregandoProc, setCarregandoProc] = useState(() => new Set());
  const [conferindoProc, setConferindoProc] = useState(null);

  useEffect(() => {
    if (numeroBanco == null || !clienteId) return undefined;
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    obterAcertoResumoProcessosApi(
      {
        numeroBanco,
        clienteId,
        busca: buscaAplicada || undefined,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        apenasPendentes: soPendentes,
        apenasNaoConferidos: soNaoConferidos,
      },
      { signal: ac.signal },
    )
      .then((r) => setDados(r ?? null))
      .catch((e) => {
        if (e?.name !== 'AbortError') {
          setErro(e?.message || 'Falha ao carregar a visão por processo.');
          setDados(null);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setCarregando(false);
      });
    return () => ac.abort();
  }, [numeroBanco, clienteId, buscaAplicada, dataInicio, dataFim, soPendentes, soNaoConferidos, refreshKey]);

  const carregarLancamentosProc = useCallback(
    async (proc) => {
      const chave = chaveProc(proc);
      setCarregandoProc((s) => new Set(s).add(chave));
      try {
        const res = await listarLancamentosExtratoPaginados({
          numeroBanco,
          clienteId,
          processoId: proc.processoId ?? undefined,
          semProcesso: proc.processoId == null,
          size: 500,
          page: 0,
          sort: 'dataLancamento,asc',
        });
        setLancamentosPorProc((m) => ({ ...m, [chave]: res?.content ?? [] }));
      } catch (e) {
        toast.error(e?.message || 'Falha ao carregar lançamentos do processo.');
      } finally {
        setCarregandoProc((s) => {
          const n = new Set(s);
          n.delete(chave);
          return n;
        });
      }
    },
    [numeroBanco, clienteId, toast],
  );

  // Recarrega os procs expandidos quando um lançamento é editado/compensado fora daqui.
  useEffect(() => {
    if (!dados) return;
    for (const chave of expandido) {
      const proc = dados.processos.find((p) => chaveProc(p) === chave);
      if (proc) void carregarLancamentosProc(proc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoLancamentos]);

  const alternarExpansao = (proc) => {
    const chave = chaveProc(proc);
    setExpandido((s) => {
      const n = new Set(s);
      if (n.has(chave)) {
        n.delete(chave);
      } else {
        n.add(chave);
        if (!lancamentosPorProc[chave]) void carregarLancamentosProc(proc);
      }
      return n;
    });
  };

  const conferirProc = async (proc, conferido) => {
    const chave = chaveProc(proc);
    setConferindoProc(chave);
    try {
      const r = await conferirProcessoAcertoApi({
        numeroBanco: Number(numeroBanco),
        clienteId: Number(clienteId),
        processoId: proc.processoId ?? null,
        conferido,
      });
      toast.success(
        conferido
          ? `${r?.atualizados ?? 0} lançamento(s) conferido(s).`
          : `Conferência desfeita em ${r?.atualizados ?? 0} lançamento(s).`,
      );
      onRefresh?.();
      if (expandido.has(chave)) void carregarLancamentosProc(proc);
    } catch (e) {
      toast.error(e?.message || 'Falha ao marcar conferência.');
    } finally {
      setConferindoProc(null);
    }
  };

  const progresso = useMemo(() => {
    if (!dados) return null;
    return {
      conferidos: Number(dados.processosConferidos ?? 0),
      total: Number(dados.totalProcessos ?? 0),
      lancPendentes: Number(dados.lancamentosNaoConferidos ?? 0),
    };
  }, [dados]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          Busca (proc ou devedor)
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setBuscaAplicada(busca.trim());
            }}
            onBlur={() => setBuscaAplicada(busca.trim())}
            placeholder="nº interno ou nome"
            className="w-52 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
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
          só com pendência
        </label>
        <label className="inline-flex items-center gap-1.5 pb-1.5">
          <input
            type="checkbox"
            checked={soNaoConferidos}
            onChange={(e) => setSoNaoConferidos(e.target.checked)}
          />
          só não conferidos
        </label>
        {progresso ? (
          <span className="ml-auto pb-1.5 text-slate-600 dark:text-slate-300">
            Conferência: <strong>{progresso.conferidos.toLocaleString('pt-BR')}</strong> de{' '}
            {progresso.total.toLocaleString('pt-BR')} procs
            {progresso.lancPendentes > 0
              ? ` · ${progresso.lancPendentes.toLocaleString('pt-BR')} lanç. sem conferir`
              : ' · tudo conferido'}
          </span>
        ) : null}
      </div>

      {erro ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      ) : null}

      {carregando && !dados ? (
        <p className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando processos…
        </p>
      ) : null}

      {dados ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-left">
                <tr>
                  <th className="px-2 py-1.5 w-6" />
                  <th className="px-2 py-1.5">Proc</th>
                  <th className="px-2 py-1.5">Partes</th>
                  <th className="px-2 py-1.5 text-right">Lanç.</th>
                  <th className="px-2 py-1.5 text-right">Créditos</th>
                  <th className="px-2 py-1.5 text-right">Débitos</th>
                  <th className="px-2 py-1.5 text-right">Saldo</th>
                  <th className="px-2 py-1.5 text-right">Pend.</th>
                  <th className="px-2 py-1.5 text-center">Conferência</th>
                </tr>
              </thead>
              <tbody>
                {dados.processos.map((p) => {
                  const chave = chaveProc(p);
                  const aberto = expandido.has(chave);
                  const conferido = Number(p.naoConferidos) === 0;
                  const lancs = lancamentosPorProc[chave];
                  return [
                    <tr
                      key={chave}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => alternarExpansao(p)}
                    >
                      <td className="px-2 py-1.5 text-slate-400">
                        {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                        {p.numeroInterno != null ? p.numeroInterno : 'mensalidades/avulsos'}
                      </td>
                      <td className="px-2 py-1.5 max-w-[280px]">
                        <span className="block truncate" title={p.partes ?? ''}>
                          {p.partes || (p.processoId == null ? 'Sem processo (proc 0)' : '—')}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {p.primeiraData ? `${fmtDataAcerto(p.primeiraData)} a ${fmtDataAcerto(p.ultimaData)}` : ''}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {Number(p.qtdLancamentos).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatMoeda(Number(p.somaCreditos ?? 0))}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-red-700 dark:text-red-300">
                        {formatMoeda(Number(p.somaDebitos ?? 0))}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums font-medium ${
                          Math.abs(Number(p.saldo ?? 0)) < 0.005 ? 'text-slate-500' : ''
                        }`}
                      >
                        {formatMoeda(Number(p.saldo ?? 0))}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {Number(p.pendentes) > 0 ? (
                          <span className="text-amber-700 dark:text-amber-300 font-medium">{p.pendentes}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={conferindoProc === chave}
                          onClick={() => void conferirProc(p, !conferido)}
                          title={
                            conferido
                              ? `Conferido${p.ultimaConferencia ? ` em ${fmtDataHoraAcerto(p.ultimaConferencia)}` : ''} — clique para desfazer`
                              : `${p.naoConferidos} lanç. sem conferir — clique para conferir o proc inteiro`
                          }
                          className="inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {conferindoProc === chave ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : conferido ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                      </td>
                    </tr>,
                    aberto ? (
                      <tr key={`${chave}-det`} className="bg-slate-50/60 dark:bg-slate-800/40">
                        <td colSpan={9} className="px-4 py-2">
                          {carregandoProc.has(chave) && !lancs ? (
                            <p className="flex items-center gap-2 text-slate-500 py-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
                            </p>
                          ) : (lancs ?? []).length === 0 ? (
                            <p className="text-slate-500 py-2">Nenhum lançamento.</p>
                          ) : (
                            <table className="w-full text-[11px]">
                              <tbody>
                                {(lancs ?? []).map((l) => {
                                  const v = valorAssinadoAcerto(l);
                                  const pendente = lancamentoPendente(l);
                                  return (
                                    <tr
                                      key={l.id}
                                      className="border-t border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                                      onClick={() => onAbrirLancamento?.(l)}
                                    >
                                      <td className="px-1 py-1 w-6" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={selectedIds.has(Number(l.id))}
                                          onChange={() => onToggleSelect?.(Number(l.id), l)}
                                        />
                                      </td>
                                      <td className="px-1 py-1 whitespace-nowrap">{fmtDataAcerto(l.dataLancamento)}</td>
                                      <td className="px-1 py-1 font-mono text-[10px] whitespace-nowrap">
                                        {l.numeroLancamento || l.id}
                                      </td>
                                      <td className="px-1 py-1 max-w-[360px]">
                                        <span className="block truncate" title={l.descricaoDetalhada || l.descricao}>
                                          {l.descricao}
                                        </span>
                                      </td>
                                      <td className="px-1 py-1 font-mono text-[10px] whitespace-nowrap">
                                        {pendente ? (
                                          <span className="text-amber-700 dark:text-amber-300">pendente</span>
                                        ) : (
                                          l.grupoCompensacao
                                        )}
                                      </td>
                                      <td className="px-1 py-1 text-center whitespace-nowrap">
                                        {l.conferidoEm ? (
                                          <span
                                            className="text-emerald-700 dark:text-emerald-300"
                                            title={`Conferido em ${fmtDataHoraAcerto(l.conferidoEm)}${l.conferidoPorNome ? ` por ${l.conferidoPorNome}` : ''}`}
                                          >
                                            OK
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                      <td
                                        className={`px-1 py-1 text-right tabular-nums font-medium whitespace-nowrap ${
                                          v < 0
                                            ? 'text-red-700 dark:text-red-300'
                                            : 'text-emerald-700 dark:text-emerald-300'
                                        }`}
                                      >
                                        {formatMoeda(v)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
                {dados.processos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Nenhum processo neste recorte.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
