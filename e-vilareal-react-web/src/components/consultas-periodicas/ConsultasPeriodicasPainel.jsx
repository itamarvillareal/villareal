import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Upload,
} from 'lucide-react';
import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';
import {
  agruparPainelPorProcesso,
  formatarDateTimePainel,
  itemPainelEmFalha,
  labelFalhaPainel,
  labelStatusUltimaExecucao,
  ordenarPainelItens,
  textoBuscaProcessoPainel,
} from '../../domain/agendamentoCadencia.js';
import {
  exportarConsultasPeriodicasCsv,
  importarConsultasPeriodicasCsv,
  consultarPainelAgora,
  listarPainel,
} from '../../repositories/agendamentoRepository.js';
import { buscarProcessoPorId } from '../../repositories/processosRepository.js';
import { ProcessosToast } from '../processos/ProcessosAdminLayout.jsx';
import { ModalDestinatariosPadrao } from '../notificacao/ModalDestinatariosPadrao.jsx';
import { ModalImportacaoConsultasPeriodicas } from './ModalImportacaoConsultasPeriodicas.jsx';

/**
 * Painel global de consultas periódicas ativas (processos com interruptor mestre ligado).
 */
export function ConsultasPeriodicasPainel() {
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState('');
  const [busca, setBusca] = useState('');
  const [operacaoChave, setOperacaoChave] = useState(null);
  const [modalConfiguracoes, setModalConfiguracoes] = useState(false);
  const [modalImportacao, setModalImportacao] = useState(false);
  const [relatorioImportacao, setRelatorioImportacao] = useState(null);
  const inputImportarRef = useRef(null);

  const recarregarPainel = useCallback(async () => {
    setCarregando(true);
    setApiError('');
    try {
      const rows = await listarPainel();
      setItens(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setApiError(e?.message || 'Falha ao carregar painel de consultas periódicas.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  const atualizarPainel = useCallback(async () => {
    if (carregando || operacaoChave != null) return;
    setOperacaoChave('atualizar-painel');
    setApiError('');
    try {
      const resultado = await consultarPainelAgora();
      if (resultado?.ocupado) {
        setToast('Consulta em andamento no PROJUDI — tente em instantes.');
      } else {
        const processos = Number(resultado?.processosConsultados ?? 0);
        const novidade = Number(resultado?.comNovidade ?? 0);
        const erros = Number(resultado?.comErro ?? 0);
        if (processos === 0) {
          setToast('Nenhum processo monitorado para consultar.');
        } else if (novidade > 0) {
          setToast(
            `Consulta concluída: ${processos} processo(s), ${novidade} com novidade${erros > 0 ? `, ${erros} com erro` : ''}.`,
          );
        } else if (erros > 0) {
          setToast(`Consulta concluída: ${processos} processo(s), ${erros} com erro.`);
        } else {
          setToast(`Consulta concluída: ${processos} processo(s), sem novidade.`);
        }
      }
      await recarregarPainel();
    } catch (e) {
      setApiError(e?.message || 'Falha ao atualizar painel de consultas periódicas.');
    } finally {
      setOperacaoChave(null);
    }
  }, [carregando, operacaoChave, recarregarPainel]);

  useEffect(() => {
    void recarregarPainel();
  }, [recarregarPainel]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const processosPainel = useMemo(() => agruparPainelPorProcesso(itens), [itens]);
  const itensOrdenados = useMemo(() => ordenarPainelItens(processosPainel), [processosPainel]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itensOrdenados;
    return itensOrdenados.filter((row) => textoBuscaProcessoPainel(row).includes(q));
  }, [itensOrdenados, busca]);

  const abrirProcesso = useCallback(
    async (row) => {
      const procId = Number(row?.processoId);
      if (!Number.isFinite(procId) || procId < 1) {
        setApiError('Processo sem identificador na API.');
        return;
      }
      setOperacaoChave(`abrir-${procId}`);
      setApiError('');
      try {
        const p = await buscarProcessoPorId(procId);
        const cod = p?.codigoCliente;
        const num = p?.numeroInterno;
        const state =
          cod != null && String(cod).trim() !== ''
            ? buildRouterStateChaveClienteProcesso(cod, num ?? '')
            : { processoApiId: procId };
        navigate('/processos', { state });
      } catch (e) {
        setApiError(e?.message || 'Falha ao abrir processo.');
      } finally {
        setOperacaoChave(null);
      }
    },
    [navigate],
  );

  const exportarCsv = useCallback(async () => {
    setOperacaoChave('exportar-csv');
    setApiError('');
    try {
      const { blob, nomeArquivo } = await exportarConsultasPeriodicasCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
      setToast('CSV exportado com sucesso.');
    } catch (e) {
      setApiError(e?.message || 'Falha ao exportar CSV.');
    } finally {
      setOperacaoChave(null);
    }
  }, []);

  const abrirSeletorImportar = useCallback(() => {
    inputImportarRef.current?.click();
  }, []);

  const aoEscolherArquivoImportar = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setOperacaoChave('importar-csv');
      setApiError('');
      try {
        const relatorio = await importarConsultasPeriodicasCsv(file);
        setRelatorioImportacao(relatorio);
        setModalImportacao(true);
        await recarregarPainel();
      } catch (e) {
        setApiError(e?.message || 'Falha ao importar CSV.');
      } finally {
        setOperacaoChave(null);
      }
    },
    [recarregarPainel],
  );

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] text-slate-900 dark:text-slate-100">
      <ProcessosToast message={toast} onClose={() => setToast('')} />

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
            <CalendarClock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Consultas periódicas</h1>
          </div>
          <button
            type="button"
            onClick={() => setModalConfiguracoes(true)}
            disabled={carregando || operacaoChave != null}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-500/30 text-sm text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-50"
          >
            <Settings className="w-4 h-4" aria-hidden />
            Configurações
          </button>
          <button
            type="button"
            onClick={() => void exportarCsv()}
            disabled={carregando || operacaoChave != null}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm hover:bg-white/80 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {operacaoChave === 'exportar-csv' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Download className="w-4 h-4" aria-hidden />
            )}
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={abrirSeletorImportar}
            disabled={carregando || operacaoChave != null}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm hover:bg-white/80 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {operacaoChave === 'importar-csv' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="w-4 h-4" aria-hidden />
            )}
            Importar CSV
          </button>
          <input
            ref={inputImportarRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void aoEscolherArquivoImportar(e)}
          />
          <button
            type="button"
            onClick={() => void atualizarPainel()}
            disabled={carregando || operacaoChave != null}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm hover:bg-white/80 dark:hover:bg-white/5 disabled:opacity-50"
            title="Consulta PROJUDI de todos os processos monitorados e atualiza o painel"
          >
            {operacaoChave === 'atualizar-painel' || carregando ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden />
            )}
            Atualizar
          </button>
        </div>

        {apiError ? (
          <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/25 px-4 py-3 text-sm text-red-900 dark:text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
            <span>{apiError}</span>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 w-full">
              Processos monitorados ({filtrados.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 w-full -mt-2">
              Apenas processos com «Consulta periódica ativa» ligada no processo. Cadência e monitor manual
              ficam no modal do processo.
            </p>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 flex-1 min-w-[200px]">
              Busca
              <span className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="CNJ, cliente, cadência…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] text-sm"
                />
              </span>
            </label>
          </div>

          {carregando ? (
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              Carregando painel…
            </p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
              Nenhum processo monitorado no painel. Ative a consulta periódica no processo ou crie um
              agendamento no modal «Consulta periódica».
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/[0.06]">
              <table className="w-full text-sm text-left min-w-[720px]">
                <thead className="bg-slate-50 dark:bg-[#0d1018] text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="p-2 font-semibold w-12 text-center">Nº</th>
                    <th className="p-2 font-semibold">Processo / cliente</th>
                    <th className="p-2 font-semibold">Cadência</th>
                    <th className="p-2 font-semibold">Próxima</th>
                    <th className="p-2 font-semibold">Última execução</th>
                    <th className="p-2 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((row, idx) => {
                    const procId = row.processoId;
                    const statusLabel = row.ultimaExecucao
                      ? labelStatusUltimaExecucao(row.statusUltimaExecucao)
                      : '';
                    const emFalha = itemPainelEmFalha(row);
                    const falhaLabel = labelFalhaPainel(row);

                    return (
                      <tr
                        key={procId}
                        className="border-t border-slate-100 dark:border-white/[0.06] hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                      >
                        <td className="p-2 align-top text-center tabular-nums text-xs font-medium text-slate-500 dark:text-slate-400">
                          {String(idx + 1).padStart(3, '0')}
                        </td>
                        <td className="p-2 align-top">
                          <div className="font-mono text-xs text-slate-800 dark:text-slate-100">
                            {row.numeroCnj || '—'}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-[220px] truncate">
                            {row.cliente || '—'}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {emFalha ? (
                              <span
                                className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
                                title={row.ultimoErro || undefined}
                              >
                                {falhaLabel}
                              </span>
                            ) : null}
                            {row.emAtraso ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                Em atraso
                              </span>
                            ) : null}
                            {row.semNunca ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                Sem execução
                              </span>
                            ) : null}
                          </div>
                          {emFalha && row.ultimoErro ? (
                            <p
                              className="text-[10px] text-red-800/90 dark:text-red-200/90 mt-1 max-w-[280px] line-clamp-2"
                              title={row.ultimoErro}
                            >
                              {row.ultimoErro}
                            </p>
                          ) : null}
                        </td>
                        <td className="p-2 align-top text-slate-700 dark:text-slate-300 max-w-[280px]">
                          {row.cadenciaResumida || '—'}
                        </td>
                        <td className="p-2 align-top tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatarDateTimePainel(row.proximaExecucao)}
                        </td>
                        <td className="p-2 align-top text-slate-700 dark:text-slate-300">
                          <div className="tabular-nums whitespace-nowrap">
                            {row.ultimaExecucao ? formatarDateTimePainel(row.ultimaExecucao) : '—'}
                          </div>
                          {statusLabel ? (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {statusLabel}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2 align-top">
                          <button
                            type="button"
                            title="Abrir processo"
                            disabled={operacaoChave != null}
                            onClick={() => void abrirProcesso(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-white/15 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
                          >
                            {operacaoChave === `abrir-${procId}` ? (
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                            ) : (
                              <ExternalLink className="w-3 h-3" />
                            )}
                            Abrir processo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <ModalDestinatariosPadrao
        open={modalConfiguracoes}
        onClose={() => setModalConfiguracoes(false)}
        onSaved={() => setToast('Destinatários padrão salvos.')}
      />

      <ModalImportacaoConsultasPeriodicas
        open={modalImportacao}
        relatorio={relatorioImportacao}
        onClose={() => {
          setModalImportacao(false);
          setRelatorioImportacao(null);
        }}
      />
    </div>
  );
}
