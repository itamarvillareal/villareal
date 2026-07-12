import { FolderOpen, Landmark } from 'lucide-react';

/**
 * Ações de consulta rápida (proc + conta corrente) sem alterar o estado da tela de acerto.
 */
export function AcertoConsultaRapidaButtons({
  codigoCliente,
  numeroInterno,
  processoId,
  onAbrirProcesso,
  onAbrirContaCorrente,
}) {
  if (!codigoCliente || (!onAbrirProcesso && !onAbrirContaCorrente)) return null;

  const ctx = { numeroInterno, processoId };
  const procRotulo = numeroInterno != null ? `proc. ${numeroInterno}` : 'proc. 0 (mensalidades)';
  const btnClass =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-[10px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {onAbrirProcesso ? (
        <button
          type="button"
          className={btnClass}
          title={`Abrir cadastro do processo (${procRotulo}) em modal — não altera esta tela`}
          aria-label={`Processo ${procRotulo}`}
          onClick={() => onAbrirProcesso(ctx)}
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Proc</span>
        </button>
      ) : null}
      {onAbrirContaCorrente ? (
        <button
          type="button"
          className={btnClass}
          title={`Abrir conta corrente (${procRotulo}) em modal — compare com os lançamentos da CONTA ZERO`}
          aria-label={`Conta corrente ${procRotulo}`}
          onClick={() => onAbrirContaCorrente(ctx)}
        >
          <Landmark className="w-3.5 h-3.5 shrink-0" />
          <span>CC</span>
        </button>
      ) : null}
    </span>
  );
}
