/**
 * @param {{
 *   aberto: boolean,
 *   nomeDeclarante?: string,
 *   gerando?: boolean,
 *   onConfirmar: (exerceAtividadeRemunerada: boolean) => void,
 *   onCancelar: () => void,
 * }} props
 */
export function ModalDeclaracaoAtividadeRemunerada({
  aberto,
  nomeDeclarante,
  gerando = false,
  onConfirmar,
  onCancelar,
}) {
  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-declaracao-atividade-titulo"
      onClick={gerando ? undefined : onCancelar}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 id="modal-declaracao-atividade-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Declaração de rendimentos
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {nomeDeclarante
              ? `Informe a situação de ${nomeDeclarante} para gerar a declaração (Lei 7.115/83).`
              : 'O declarante exerce atividade remunerada?'}
          </p>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4">
          <button
            type="button"
            disabled={gerando}
            onClick={() => onConfirmar(true)}
            className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-left text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100"
          >
            Sim, exerce atividade remunerada
          </button>
          <button
            type="button"
            disabled={gerando}
            onClick={() => onConfirmar(false)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            Não exerce atividade remunerada
          </button>
        </div>
        <div className="flex justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button
            type="button"
            disabled={gerando}
            onClick={onCancelar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
