import { ClipboardCheck, X } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { ConferenciaContratosHonorariosPanel } from './ConferenciaContratosHonorariosPanel.jsx';

/**
 * Modal de conferência em lote — revisão e aprovação da fila de importação de contratos celebrados.
 */
export function ModalConferenciaContratosHonorarios({
  open,
  codigoCliente,
  onClose,
}) {
  useCloseOnEscape(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-1 sm:p-2"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-conferencia-contratos-titulo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-0.5rem)] w-full max-w-[min(1400px,100%)] flex-col overflow-hidden rounded-xl border border-emerald-200/90 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-200/70 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 px-3 py-2 text-white">
          <div className="min-w-0 flex-1">
            <h2
              id="modal-conferencia-contratos-titulo"
              className="flex items-center gap-1.5 text-sm font-semibold sm:text-base"
            >
              <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />
              Conferência de contratos importados
            </h2>
            <p className="truncate text-[11px] text-emerald-100/95">
              Revise dados, conta corrente e aprove na fila
              {codigoCliente ? ` · Cliente ${codigoCliente}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ConferenciaContratosHonorariosPanel codigoClienteFiltro={codigoCliente} />
      </div>
    </div>
  );
}
