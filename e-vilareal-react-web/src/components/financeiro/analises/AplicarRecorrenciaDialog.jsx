import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';

export function AplicarRecorrenciaDialog({
  open,
  padrao,
  dryRunResult,
  loading,
  criarRegra,
  onCriarRegraChange,
  onConfirm,
  onCancel,
}) {
  useCloseOnEscape(open, onCancel);
  if (!open || !padrao) return null;

  const n = Number(dryRunResult?.aplicados ?? padrao.qtdPendentes ?? 0);
  const codigo = padrao.contaCodigo ?? '?';
  const temVinculo = padrao.clienteId != null || padrao.processoId != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aplicar-recorrencia-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
        <h3 id="aplicar-recorrencia-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Confirmar classificação
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Vai classificar{' '}
          <strong className="tabular-nums text-slate-800 dark:text-slate-200">
            {n.toLocaleString('pt-BR')}
          </strong>{' '}
          lançamento{n === 1 ? '' : 's'} como conta{' '}
          <strong>{codigo}</strong>.
        </p>
        {temVinculo ? (
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {padrao.clienteNome ? (
              <>
                Vincular ao cliente <strong>{padrao.clienteNome}</strong>
              </>
            ) : null}
            {padrao.processoNumero ? (
              <>
                {padrao.clienteNome ? ' · ' : ''}
                processo <strong>{padrao.processoNumero}</strong>
              </>
            ) : null}
            .
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500 truncate" title={padrao.descricaoExemplo}>
          Padrão: {padrao.descricaoExemplo}
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={criarRegra}
            onChange={(e) => onCriarRegraChange(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 dark:border-slate-600"
          />
          <span>Criar regra para automatizar os próximos (CONTAINS)</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || n <= 0}
            className="px-3 py-1.5 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 fin-btn-aprov-conta"
            style={
              codigo
                ? {
                    background: `var(--fin-conta-${String(codigo).toLowerCase()}, var(--fin-conta-n))`,
                  }
                : undefined
            }
            aria-label={`Confirmar classificação de ${n} lançamentos como ${codigo}`}
          >
            {loading ? 'Aplicando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
