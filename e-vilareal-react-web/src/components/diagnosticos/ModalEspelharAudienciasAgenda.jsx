import { useCallback, useState } from 'react';
import { CalendarSync, Loader2, X } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { backfillAudienciasProcessosAgendaApi } from '../../repositories/agendaRepository.js';
import { mensagemErroAmigavel } from '../../utils/mensagemErroAmigavel.js';

/**
 * Confirma e executa o espelhamento processo → agenda (fonte canônica: processo.audiencia_*).
 */
export function ModalEspelharAudienciasAgenda({ open, onClose }) {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const fechar = useCallback(() => {
    if (executando) return;
    setResultado(null);
    setErro('');
    onClose?.();
  }, [executando, onClose]);

  useCloseOnEscape(open && !executando, fechar);

  async function executar() {
    setExecutando(true);
    setErro('');
    setResultado(null);
    try {
      const r = await backfillAudienciasProcessosAgendaApi({ todos: true });
      if (!r.ok) {
        setErro('Não foi possível espelhar as audiências na agenda. Verifique a conexão com a API.');
        return;
      }
      setResultado({
        processosProcessados: r.processosProcessados ?? 0,
        colaboradoresSincronizados: r.colaboradoresSincronizados ?? 0,
        eventosRemovidos: r.eventosRemovidos ?? 0,
        falhas: r.falhas ?? 0,
      });
    } catch (e) {
      setErro(mensagemErroAmigavel(e, 'espelhar audiências na agenda'));
    } finally {
      setExecutando(false);
    }
  }

  if (!open) return null;

  const concluido = resultado != null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-espelhar-audiencias-titulo"
      onClick={fechar}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-emerald-500/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarSync className="h-5 w-5 shrink-0" aria-hidden />
            <h3 id="modal-espelhar-audiencias-titulo" className="text-base font-semibold truncate">
              Espelhar audiências na agenda
            </h3>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={executando}
            className="p-1 rounded-lg text-white/90 hover:bg-white/15 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-slate-700">
          {!concluido ? (
            <>
              <p>
                A <strong>data, hora e tipo</strong> gravados em cada processo são a fonte canônica. Este procedimento
                cria ou atualiza os compromissos correspondentes na agenda de <strong>todos os colaboradores</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[13px] text-slate-600">
                <li>Processos sem audiência: eventos antigos na agenda são removidos.</li>
                <li>Eventos órfãos (processo inexistente) também são limpos.</li>
                <li>Use após importações ou se alguma audiência não aparecer na Agenda.</li>
              </ul>
              {executando ? (
                <div className="flex items-center justify-center gap-2 py-4 text-emerald-800" role="status">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  <span>Espelhando audiências… pode levar alguns segundos.</span>
                </div>
              ) : null}
              {erro ? (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                  {erro}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="font-medium text-emerald-900">Espelhamento concluído.</p>
              <dl className="grid grid-cols-2 gap-2 text-[13px]">
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <dt className="text-slate-500">Processos processados</dt>
                  <dd className="text-lg font-semibold tabular-nums">{resultado.processosProcessados}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <dt className="text-slate-500">Colaboradores atualizados</dt>
                  <dd className="text-lg font-semibold tabular-nums">{resultado.colaboradoresSincronizados}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <dt className="text-slate-500">Eventos removidos</dt>
                  <dd className="text-lg font-semibold tabular-nums">{resultado.eventosRemovidos}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <dt className="text-slate-500">Falhas</dt>
                  <dd
                    className={`text-lg font-semibold tabular-nums ${resultado.falhas > 0 ? 'text-amber-700' : 'text-emerald-700'}`}
                  >
                    {resultado.falhas}
                  </dd>
                </div>
              </dl>
              {resultado.falhas > 0 ? (
                <p className="text-xs text-amber-800">
                  Houve falhas em alguns processos. Abra Diagnósticos novamente ou consulte os logs do backend.
                </p>
              ) : (
                <p className="text-xs text-slate-600">
                  A Agenda deve refletir todas as audiências dos processos ativos. Recarregue a tela Agenda se necessário.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200/80 flex flex-wrap justify-center gap-2 bg-slate-50/90">
          {!concluido ? (
            <>
              <button
                type="button"
                onClick={fechar}
                disabled={executando}
                className="min-w-[100px] px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executar}
                disabled={executando}
                className="min-w-[140px] px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
              >
                {executando ? 'Executando…' : 'Espelhar agora'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={fechar}
              className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-500 hover:to-teal-500"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
