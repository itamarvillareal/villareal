import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, SkipForward, X } from 'lucide-react';
import { navegarExtratoLancamento } from '../../extrato/extratoDeepLink.js';
import { ConfiancaDots } from '../../shared/ConfiancaDots.jsx';
import { ValorText } from '../../shared/ValorText.jsx';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LinhaLancamento = memo(function LinhaLancamento({ row, tone, onAbrirExtrato }) {
  const box =
    tone === 'debito'
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';

  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm cursor-pointer ${box}`}
      onDoubleClick={() => onAbrirExtrato?.(row)}
      title="Duplo clique: abrir extrato do banco neste lançamento"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums text-slate-600 dark:text-slate-300">{row.dataExibicao}</span>
        <span className="text-xs text-slate-500">{row.bancoNome || '—'}</span>
        <span className="flex-1 min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
          {row.descricao}
        </span>
        <ValorText valor={row.valor} natureza={row.natureza} />
      </div>
    </div>
  );
});

function CompensacaoCardInner({
  ui,
  onParear,
  onRejeitar,
  onPular,
  isSelected,
  onSelect,
  fading,
  busy,
  focused = false,
}) {
  const navigate = useNavigate();
  const { par, debRow, credRow, soma, zero, dentroTolerancia, tipoLabel, diaLabel } = ui;

  const abrirExtrato = useCallback(
    (row) => {
      navegarExtratoLancamento(navigate, row);
    },
    [navigate],
  );

  return (
    <article
      className={`rounded-lg border border-[var(--color-border-tertiary,#e2e8f0)] dark:border-slate-700 px-4 py-3 mb-2 bg-white dark:bg-slate-900 hover:shadow-sm ${
        focused ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950' : ''
      } ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{ transition: fading ? 'opacity 280ms ease-out' : undefined }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Par sugerido
          </span>
        </label>
        <ConfiancaDots nivel={par.confianca} />
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-medium uppercase text-red-600 dark:text-red-400 mb-0.5">Débito</p>
          <LinhaLancamento row={debRow} tone="debito" onAbrirExtrato={abrirExtrato} />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-green-600 dark:text-green-400 mb-0.5">Crédito</p>
          <LinhaLancamento row={credRow} tone="credito" onAbrirExtrato={abrirExtrato} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span
          className={
            zero
              ? 'text-green-600 dark:text-green-400 font-medium'
              : dentroTolerancia
                ? 'text-amber-600 dark:text-amber-400 font-medium'
                : 'text-red-600 dark:text-red-400 font-medium'
          }
        >
          Soma: R$ {fmt.format(soma)}
          {zero ? ' ✓' : dentroTolerancia ? ` ⚠ (dif. ${fmt.format(soma)})` : ''}
        </span>
        <span className="flex flex-wrap gap-1 justify-end">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {tipoLabel}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {diaLabel}
          </span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={onParear}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Parear
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRejeitar}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
          Não são par
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onPular}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:underline"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Pular
        </button>
      </div>
    </article>
  );
}

export const CompensacaoCard = memo(CompensacaoCardInner);
