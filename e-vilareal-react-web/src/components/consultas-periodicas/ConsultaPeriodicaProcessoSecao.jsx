import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  formatarDateTimePainel,
  resumoCadenciaAgendamento,
} from '../../domain/agendamentoCadencia.js';
import { interpretarResultadoMonitoramento } from '../../domain/monitoramentoProjudi.js';
import {
  getConsultaPeriodicaHabilitada,
  listarAgendamentosProcesso,
  pausarAgendamento,
  putConsultaPeriodicaHabilitada,
  removerAgendamento,
  retomarAgendamento,
} from '../../repositories/agendamentoRepository.js';
import { monitorarProcesso } from '../../repositories/processosRepository.js';
import {
  processosBtnGhost,
  processosBtnOutlineIndigo,
  ProcessosToast,
} from '../processos/ProcessosAdminLayout.jsx';
import { ModalAgendamentoCadencia } from './ModalAgendamentoCadencia.jsx';
import { DestinatariosProcessoSecao } from '../notificacao/DestinatariosProcessoSecao.jsx';
import { HistoricoExecucoesProcessoSecao } from './HistoricoExecucoesProcessoSecao.jsx';

/**
 * Central de consulta periódica no modal do processo: interruptor, cadência, adicionais, histórico.
 * @param {{
 *   processoApiId?: number|string|null,
 *   numeroCnj?: string,
 *   clienteNome?: string,
 * }} props
 */
export function ConsultaPeriodicaProcessoSecao({ processoApiId, numeroCnj, clienteNome }) {
  const procId = Number(processoApiId);
  const habilitado = Number.isFinite(procId) && procId > 0;

  const [consultaAtiva, setConsultaAtiva] = useState(true);
  const [carregandoMestre, setCarregandoMestre] = useState(false);
  const [salvandoMestre, setSalvandoMestre] = useState(false);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState('');
  const [operacaoChave, setOperacaoChave] = useState(null);
  const [monitorando, setMonitorando] = useState(false);
  const [modal, setModal] = useState(null);

  const recarregarAgendamentos = useCallback(async () => {
    if (!habilitado) {
      setItens([]);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const rows = await listarAgendamentosProcesso(procId);
      setItens(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar agendamentos do processo.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [habilitado, procId]);

  const recarregarMestre = useCallback(async () => {
    if (!habilitado) return;
    setCarregandoMestre(true);
    try {
      const dto = await getConsultaPeriodicaHabilitada(procId);
      setConsultaAtiva(Boolean(dto?.habilitada));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar interruptor da consulta periódica.');
    } finally {
      setCarregandoMestre(false);
    }
  }, [habilitado, procId]);

  useEffect(() => {
    void recarregarMestre();
    void recarregarAgendamentos();
  }, [recarregarMestre, recarregarAgendamentos]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const monitorarAgora = useCallback(async () => {
    if (!habilitado || monitorando) return;
    setMonitorando(true);
    setErro('');
    try {
      const r = await monitorarProcesso(procId);
      const { erro: errMsg, toast: msg } = interpretarResultadoMonitoramento(r);
      if (errMsg) {
        setErro(errMsg);
        return;
      }
      if (msg) setToast(msg);
      await recarregarAgendamentos();
    } catch (e) {
      setErro(e?.message || 'Falha ao monitorar movimentações do PROJUDI.');
    } finally {
      setMonitorando(false);
    }
  }, [habilitado, monitorando, procId, recarregarAgendamentos]);

  async function alternarConsultaAtiva() {
    if (!habilitado || salvandoMestre) return;
    const novo = !consultaAtiva;
    setSalvandoMestre(true);
    setErro('');
    try {
      const dto = await putConsultaPeriodicaHabilitada(procId, novo);
      setConsultaAtiva(Boolean(dto?.habilitada));
      setToast(
        dto?.habilitada
          ? 'Consulta periódica ativada para este processo.'
          : 'Consulta periódica desativada (fora do painel e do agendamento automático).',
      );
    } catch (e) {
      setErro(e?.message || 'Falha ao atualizar consulta periódica.');
    } finally {
      setSalvandoMestre(false);
    }
  }

  if (!habilitado) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Salve o processo na API para configurar consultas automáticas ao PROJUDI.
      </p>
    );
  }

  const busy = operacaoChave != null || monitorando;

  async function executarAcao(agId, acao) {
    setOperacaoChave(`${acao}-${agId}`);
    setErro('');
    try {
      if (acao === 'pausar') await pausarAgendamento(agId);
      else if (acao === 'retomar') await retomarAgendamento(agId);
      else if (acao === 'remover') await removerAgendamento(agId);
      await recarregarAgendamentos();
      if (acao === 'pausar') setToast('Agendamento pausado.');
      else if (acao === 'retomar') setToast('Agendamento retomado.');
      else setToast('Agendamento removido.');
    } catch (e) {
      setErro(e?.message || `Falha ao ${acao} agendamento.`);
    } finally {
      setOperacaoChave(null);
    }
  }

  function confirmarRemover(ag) {
    const ok = window.confirm(
      `Remover o agendamento (${resumoCadenciaAgendamento(ag)})?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    void executarAcao(Number(ag.id), 'remover');
  }

  return (
    <>
      <ProcessosToast message={toast} onClose={() => setToast('')} />

      <div className="space-y-4">
        <div className="rounded-lg border border-indigo-200/50 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 px-3 py-2.5">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={consultaAtiva}
              disabled={carregandoMestre || salvandoMestre}
              onChange={() => void alternarConsultaAtiva()}
            />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Consulta periódica ativa para este processo
            </span>
            {salvandoMestre ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 ml-auto shrink-0" aria-hidden />
            ) : null}
          </label>
          {!consultaAtiva ? (
            <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200/90 leading-relaxed pl-6">
              Desligado: este processo não aparece no painel «Consultas periódicas» e o scheduler não
              executa agendamentos automáticos. «Monitorar agora» e o histórico abaixo continuam
              disponíveis.
            </p>
          ) : null}
        </div>

        {erro ? (
          <p className="text-xs text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 px-2 py-1.5">
            {erro}
          </p>
        ) : null}

        <section
          className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#0d1018]/40 p-3"
          aria-labelledby="cadencia-processo-titulo"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3
              id="cadencia-processo-titulo"
              className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
              Cadência
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={processosBtnOutlineIndigo}
                disabled={carregando || busy}
                title="Monitorar movimentações PROJUDI (somente listagem)"
                onClick={() => void monitorarAgora()}
              >
                {monitorando ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="w-4 h-4" aria-hidden />
                )}
                Monitorar agora
              </button>
              <button
                type="button"
                className={processosBtnOutlineIndigo}
                disabled={carregando || busy}
                onClick={() => setModal({ modo: 'criar' })}
              >
                <Plus className="w-4 h-4" aria-hidden />
                Novo agendamento
              </button>
            </div>
          </div>

          {carregando ? (
            <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 py-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Carregando agendamentos…
            </p>
          ) : itens.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
              Nenhum agendamento neste processo. Use «Novo agendamento» para consultas automáticas ao
              PROJUDI.
            </p>
          ) : (
            <ul className="space-y-2">
              {itens.map((ag) => {
                const agId = Number(ag.id);
                const ativo = Boolean(ag.ativo);
                return (
                  <li
                    key={agId}
                    className="rounded-md border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0d1018]/80 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              ativo
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {ativo ? 'Ativo' : 'Pausado'}
                          </span>
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-100">
                            {resumoCadenciaAgendamento(ag)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          Próxima: {formatarDateTimePainel(ag.proximaExecucao)}
                          {ag.ultimaExecucao
                            ? ` · Última: ${formatarDateTimePainel(ag.ultimaExecucao)}`
                            : ' · Sem execução ainda'}
                        </p>
                        {ag.motivo ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                            {ag.motivo}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0">
                        <button
                          type="button"
                          className={processosBtnGhost}
                          disabled={busy}
                          onClick={() => setModal({ modo: 'editar', agendamentoId: agId })}
                          title="Editar cadência"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden />
                          <span className="sr-only">Editar</span>
                        </button>
                        {ativo ? (
                          <button
                            type="button"
                            className={processosBtnGhost}
                            disabled={busy || operacaoChave === `pausar-${agId}`}
                            onClick={() => void executarAcao(agId, 'pausar')}
                            title="Pausar"
                          >
                            <Pause className="w-3.5 h-3.5" aria-hidden />
                            <span className="sr-only">Pausar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={processosBtnGhost}
                            disabled={busy || operacaoChave === `retomar-${agId}`}
                            onClick={() => void executarAcao(agId, 'retomar')}
                            title="Retomar"
                          >
                            <Play className="w-3.5 h-3.5" aria-hidden />
                            <span className="sr-only">Retomar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={processosBtnGhost}
                          disabled={busy || operacaoChave === `remover-${agId}`}
                          onClick={() => confirmarRemover(ag)}
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-700 dark:text-red-300" aria-hidden />
                          <span className="sr-only">Remover</span>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <DestinatariosProcessoSecao processoApiId={procId} />

        <HistoricoExecucoesProcessoSecao processoApiId={procId} />
      </div>

      <ModalAgendamentoCadencia
        open={Boolean(modal)}
        modo={modal?.modo === 'criar' ? 'criar' : 'editar'}
        agendamentoId={modal?.agendamentoId}
        processoId={procId}
        numeroCnj={numeroCnj}
        clienteNome={clienteNome}
        onClose={() => setModal(null)}
        onSaved={() => {
          void recarregarAgendamentos();
          setToast(modal?.modo === 'criar' ? 'Agendamento criado.' : 'Cadência atualizada.');
        }}
      />
    </>
  );
}
