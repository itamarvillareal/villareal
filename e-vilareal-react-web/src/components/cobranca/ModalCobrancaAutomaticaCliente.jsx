import { ChevronLeft, FileSpreadsheet, X } from 'lucide-react';
import { CobrancaAutomaticaPanel } from './CobrancaAutomaticaPanel.jsx';
import { padCliente8Cadastro } from '../../data/cadastroClientesStorage.js';

/**
 * Modal de cobrança automática (relatório .xls de inadimplência) na ficha do cliente.
 * @param {{ open: boolean, codigoCliente: string, nomeCliente?: string, onClose?: () => void }} props
 */
export function ModalCobrancaAutomaticaCliente({ open, codigoCliente, nomeCliente, onClose }) {
  if (!open) return null;

  const codPad = padCliente8Cadastro(codigoCliente);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cobranca-automatica-titulo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-sky-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sky-200/70 bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-600 px-3 py-2 text-white shadow-sm">
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
              id="modal-cobranca-automatica-titulo"
              className="flex items-center gap-1.5 text-sm font-semibold leading-tight sm:text-base"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">Cobrança automática</span>
            </h2>
            <p className="truncate text-[11px] text-sky-100/95">
              Relatório .xls de inadimplência — cliente{' '}
              <span className="font-mono font-medium text-white">{codPad}</span>
              {nomeCliente ? ` · ${nomeCliente}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <CobrancaAutomaticaPanel clienteCodigo={codPad} clienteNome={nomeCliente} />
        </div>
      </div>
    </div>
  );
}
