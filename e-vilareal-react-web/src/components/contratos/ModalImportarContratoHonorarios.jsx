import { FileSignature, X } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { ImportarContratoHonorariosPanel } from './ImportarContratoHonorariosPanel.jsx';

/**
 * Modal — importação de contratos de honorários celebrados (censo).
 */
export function ModalImportarContratoHonorarios({
  open,
  codigoCliente,
  processoId,
  nomeCliente,
  onClose,
}) {
  useCloseOnEscape(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-importar-contrato-titulo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-indigo-200/90 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-indigo-200/70 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-3 py-2 text-white">
          <div className="min-w-0 flex-1">
            <h2
              id="modal-importar-contrato-titulo"
              className="flex items-center gap-1.5 text-sm font-semibold sm:text-base"
            >
              <FileSignature className="h-4 w-4 shrink-0" aria-hidden />
              Importar contratos de honorários
            </h2>
            <p className="truncate text-[11px] text-indigo-100/95">
              {codigoCliente ? `Cliente ${codigoCliente}` : 'Qualquer cliente'}
              {nomeCliente ? ` · ${nomeCliente}` : ''}
              {processoId ? ` · proc. ${processoId}` : ''}
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
        <ImportarContratoHonorariosPanel
          codigoCliente={codigoCliente}
          processoId={processoId}
          onFechar={onClose}
        />
      </div>
    </div>
  );
}
