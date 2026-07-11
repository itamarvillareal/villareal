import { Link2, Tag, Trash2, X } from 'lucide-react';
import {
  CLASSE_BOTAO_APROVAR_CONTA,
  varsCorConta,
} from '../shared/contaCores.js';
import { formatMoeda } from '../shared/financeiroFormat.js';

export function ExtratoBatchBar({
  count,
  onExcluir,
  onLimparSelecao,
  busy,
  contas = [],
  contaLoteId = '',
  onContaLoteChange,
  onAplicarLetra,
  parearGrupo = null,
}) {
  if (!count || count <= 0) return null;

  const modoLetra = contas.length > 0 && onAplicarLetra;
  const contaEscolhida = modoLetra
    ? contas.find((c) => String(c.id) === String(contaLoteId))
    : null;
  const codigoEscolhido = contaEscolhida?.codigo ?? '';

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900 shrink-0"
      role="toolbar"
      aria-label="Ações em lote no extrato"
    >
      <span className="text-sm font-medium text-red-900 dark:text-red-200">
        {count.toLocaleString('pt-BR')} selecionado{count !== 1 ? 's' : ''}
      </span>

      {parearGrupo ? (
        <>
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded tabular-nums ${
              parearGrupo.somaZero
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
            }`}
            title="Soma assinada (crédito − débito) da seleção"
          >
            Soma {formatMoeda(parearGrupo.soma)}
          </span>
          <button
            type="button"
            disabled={busy || parearGrupo.busy || !parearGrupo.valido}
            onClick={parearGrupo.onParear}
            title={parearGrupo.motivoInvalido || 'Compensa a seleção como um grupo soma zero'}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Link2 className="w-3.5 h-3.5" aria-hidden />
            {parearGrupo.busy ? 'Pareando…' : 'Parear grupo (soma zero)'}
          </button>
          {!parearGrupo.valido && parearGrupo.motivoInvalido ? (
            <span className="text-[11px] text-amber-800 dark:text-amber-200">
              {parearGrupo.motivoInvalido}
            </span>
          ) : null}
          <span className="hidden sm:inline text-red-200 dark:text-red-800" aria-hidden>
            |
          </span>
        </>
      ) : null}

      {modoLetra ? (
        <>
          <select
            value={contaLoteId}
            onChange={(e) => onContaLoteChange?.(e.target.value)}
            disabled={busy}
            style={codigoEscolhido ? varsCorConta(codigoEscolhido) : undefined}
            className={`text-sm rounded-md border-2 bg-white dark:bg-slate-800 px-2 py-1.5 min-w-[10rem] max-w-[20rem] ${
              codigoEscolhido ? 'fin-select-conta' : 'border-slate-300 dark:border-slate-600'
            }`}
            aria-label="Conta (letra) para aplicar na seleção"
          >
            <option value="">Escolher conta (letra)…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {String(c.codigo ?? '').toUpperCase()} — {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !contaLoteId}
            onClick={onAplicarLetra}
            style={codigoEscolhido ? varsCorConta(codigoEscolhido) : undefined}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 ${
              codigoEscolhido
                ? CLASSE_BOTAO_APROVAR_CONTA
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5" aria-hidden />
            {codigoEscolhido ? `Aplicar letra ${codigoEscolhido}` : 'Aplicar letra'}
          </button>
          <span className="hidden sm:inline text-red-200 dark:text-red-800" aria-hidden>
            |
          </span>
        </>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={onExcluir}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden />
        {busy ? 'Processando…' : 'Excluir'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onLimparSelecao}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
        Limpar seleção
      </button>
    </div>
  );
}
