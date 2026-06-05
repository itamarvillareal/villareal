import { CalendarClock, ChevronLeft, X } from 'lucide-react';
import { ConsultaPeriodicaProcessoSecao } from './ConsultaPeriodicaProcessoSecao.jsx';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';

/**
 * Modal flutuante com agendamentos, monitor manual e destinatários do processo.
 * Sub-modais da seção (cadência) usam z-index maior (90) e abrem por cima deste (75).
 *
 * @param {{
 *   open: boolean,
 *   onClose?: () => void,
 *   processoApiId?: number|string|null,
 *   numeroCnj?: string,
 *   clienteNome?: string,
 * }} props
 */
export function ModalConsultaPeriodicaProcesso({
  open,
  onClose,
  processoApiId,
  numeroCnj,
  clienteNome,
}) {
  useCloseOnEscape(open, onClose);

  if (!open) return null;

  const cnj = String(numeroCnj ?? '').trim();
  const cliente = String(clienteNome ?? '').trim();

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-consulta-periodica-titulo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-[#141c2c]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-indigo-200/40 bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-800 px-3 py-2 text-white shadow-sm">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:hidden"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2
              id="modal-consulta-periodica-titulo"
              className="flex items-center gap-1.5 text-sm font-semibold leading-tight sm:text-base"
            >
              <CalendarClock className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">Consulta periódica</span>
            </h2>
            <p className="truncate text-[11px] text-indigo-100/95">
              {cnj ? <span className="font-mono font-medium text-white">{cnj}</span> : 'Processo'}
              {cliente ? ` · ${cliente}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:flex"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <ConsultaPeriodicaProcessoSecao
            processoApiId={processoApiId}
            numeroCnj={numeroCnj}
            clienteNome={clienteNome}
          />
        </div>
      </div>
    </div>
  );
}
