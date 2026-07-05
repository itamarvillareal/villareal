import { X } from 'lucide-react';
import { ExtratoRepararPanel } from './ExtratoRepararPanel.jsx';
import {
  isInstituicaoExtratoOfxBloqueado,
  rotuloFormatosExtratoImport,
} from '../../../utils/extratoPdfImport.js';

/**
 * @param {{
 *   open: boolean,
 *   bancoNome: string,
 *   numeroBanco: number,
 *   onClose: () => void,
 * }} props
 */
export function ExtratoRepararDialog({ open, bancoNome, numeroBanco, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extrato-reparar-titulo"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="extrato-reparar-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Reparar extrato — {bancoNome}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isInstituicaoExtratoOfxBloqueado(bancoNome)
                ? `Compara o PDF com o que está gravado (${rotuloFormatosExtratoImport(bancoNome)}). Use o histórico completo para alinhar o saldo.`
                : 'Compara o OFX ou PDF com o que está gravado. Use o histórico completo para alinhar o saldo.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <ExtratoRepararPanel bancoNome={bancoNome} numeroBanco={numeroBanco} showFileInput />
        </div>

        <footer className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
