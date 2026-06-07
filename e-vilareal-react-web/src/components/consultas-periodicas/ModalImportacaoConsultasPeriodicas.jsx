import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';

/**
 * @param {{ open: boolean, relatorio: object | null, onClose?: () => void }} props
 */
export function ModalImportacaoConsultasPeriodicas({ open, relatorio, onClose }) {
  useCloseOnEscape(open, onClose);

  if (!open || !relatorio) return null;

  const pulados = Array.isArray(relatorio.puladosCnjInexistente) ? relatorio.puladosCnjInexistente : [];
  const invalidas = Array.isArray(relatorio.linhasInvalidas) ? relatorio.linhasInvalidas : [];
  const temAlerta = pulados.length > 0 || invalidas.length > 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-import-csv-titulo"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141c2c] shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-[#141c2c] px-4 py-3">
          <h2
            id="modal-import-csv-titulo"
            className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100"
          >
            {temAlerta ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            )}
            Resultado da importação
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-slate-500 dark:text-slate-400">Linhas lidas</dt>
            <dd className="font-medium tabular-nums">{relatorio.linhasLidas ?? 0}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Processos atualizados</dt>
            <dd className="font-medium tabular-nums">{relatorio.processosAtualizados ?? 0}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Agendamentos criados</dt>
            <dd className="font-medium tabular-nums">{relatorio.agendamentosCriados ?? 0}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Destinatários criados</dt>
            <dd className="font-medium tabular-nums">{relatorio.destinatariosCriados ?? 0}</dd>
          </dl>

          {pulados.length > 0 ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/25 px-3 py-3">
              <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Pulados — CNJ não encontrado ({pulados.length})
              </p>
              <ul className="font-mono text-xs space-y-1 max-h-32 overflow-y-auto text-amber-950 dark:text-amber-50">
                {pulados.map((cnj) => (
                  <li key={cnj}>{cnj}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {invalidas.length > 0 ? (
            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/25 px-3 py-3">
              <p className="font-semibold text-red-900 dark:text-red-100 mb-2">
                Linhas inválidas ({invalidas.length})
              </p>
              <ul className="text-xs space-y-2 max-h-40 overflow-y-auto text-red-950 dark:text-red-50">
                {invalidas.map((item) => (
                  <li key={`${item.linha}-${item.motivo}`}>
                    <span className="font-semibold">Linha {item.linha}:</span> {item.motivo}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 dark:border-white/10 px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
