import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { formatDataBrCompleta, formatMoeda } from '../shared/financeiroFormat.js';
import {
  filtrarLancamentosDivergentes,
  rotuloAlvoPadrao,
  rotuloDescricaoComData,
  textoEscopoLancamentos,
} from './analisesUtils.js';

export function AplicarRecorrenciaDialog({
  open,
  padrao,
  dryRunResult,
  loading,
  criarRegra,
  onCriarRegraChange,
  precisaoValor = 'EXATO',
  onConfirm,
  onCancel,
}) {
  useCloseOnEscape(open, onCancel);
  if (!open || !padrao) return null;

  const modoSoNome = precisaoValor === 'IGNORAR_VALOR';
  const modoAprox = precisaoValor === 'TODOS';
  const isMedia = String(padrao?.confianca ?? '').toUpperCase() === 'MEDIA';

  const totalAcao =
    dryRunResult != null
      ? Number(dryRunResult.aplicadosNovos ?? 0) + Number(dryRunResult.aplicadosCompletados ?? 0)
      : 0;

  const lancamentosPreview = Array.isArray(dryRunResult?.lancamentos) ? dryRunResult.lancamentos : [];
  const divergentesPreview = modoSoNome
    ? filtrarLancamentosDivergentes(lancamentosPreview, padrao.valorModal)
    : [];
  const tituloPadrao = rotuloDescricaoComData(padrao, formatDataBrCompleta);
  const codigo = padrao.contaCodigo ?? '?';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aplicar-recorrencia-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
        <h3 id="aplicar-recorrencia-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {modoSoNome ? 'Confirmar só por nome' : isMedia ? 'Revisar aplicação' : 'Confirmar aplicação'}
          {modoAprox ? (
            <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">(+ aproximados)</span>
          ) : null}
        </h3>

        {modoSoNome ? (
          <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-3 py-2 text-xs text-orange-800 dark:text-orange-200">
            <p className="font-medium">Valor não confirma o histórico — revisão manual</p>
          </div>
        ) : null}

        <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300">{rotuloAlvoPadrao(padrao)}</p>
          <p>{textoEscopoLancamentos(padrao, precisaoValor)}</p>
          {totalAcao <= 0 && dryRunResult != null ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Não há lançamentos pendentes para aplicar neste padrão com o filtro atual.
            </p>
          ) : null}
        </div>

        {modoSoNome && divergentesPreview.length > 0 ? (
          <ul className="mt-4 max-h-48 overflow-y-auto rounded-md border border-orange-200 dark:border-orange-800 divide-y divide-orange-100 dark:divide-orange-900/50">
            {divergentesPreview.map((item, idx) => (
              <li
                key={`${item.dataLancamento ?? ''}-${item.descricao ?? ''}-${idx}`}
                className="px-3 py-2 text-xs text-orange-900 dark:text-orange-200"
              >
                <p className="font-medium tabular-nums">
                  {item.dataLancamento ? formatDataBrCompleta(item.dataLancamento) : '—'}
                </p>
                <p className="truncate text-orange-800/90 dark:text-orange-300/90" title={item.descricao}>
                  {item.descricao ?? '—'}
                </p>
                <p>
                  valor {formatMoeda(item.valor)}
                  {padrao.valorModal != null ? (
                    <span className="text-orange-700/80 dark:text-orange-300/80">
                      {' '}
                      · histórico ~{formatMoeda(padrao.valorModal)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {!modoSoNome && lancamentosPreview.length > 0 ? (
          <div className="mt-4 max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {lancamentosPreview.map((item, idx) => (
              <div
                key={`${item.dataLancamento ?? ''}-${item.descricao ?? ''}-${idx}`}
                className="flex items-start justify-between gap-3 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                    {item.dataLancamento ? formatDataBrCompleta(item.dataLancamento) : '—'}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 truncate" title={item.descricao}>
                    {item.descricao ?? '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums text-slate-700 dark:text-slate-300">{formatMoeda(item.valor)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    {item.acao === 'COMPLETAR' ? 'completar' : 'novo'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-500 truncate" title={tituloPadrao}>
          Padrão: {tituloPadrao}
        </p>
        {!modoSoNome ? (
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={criarRegra}
              onChange={(e) => onCriarRegraChange(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-600"
            />
            <span>Criar regra para automatizar os próximos (CONTAINS)</span>
          </label>
        ) : null}
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
            onClick={() => onConfirm()}
            disabled={loading || (dryRunResult != null && totalAcao <= 0)}
            className={
              modoSoNome
                ? 'px-3 py-1.5 text-sm rounded-md border border-orange-400 bg-orange-100 text-orange-950 hover:bg-orange-200 dark:bg-orange-950/50 dark:border-orange-600 dark:text-orange-100 disabled:opacity-50'
                : 'px-3 py-1.5 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 fin-btn-aprov-conta'
            }
            style={
              !modoSoNome && codigo
                ? {
                    background: `var(--fin-conta-${String(codigo).toLowerCase()}, var(--fin-conta-n))`,
                  }
                : undefined
            }
          >
            {loading ? 'Aplicando…' : modoSoNome ? 'Confirmar' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
