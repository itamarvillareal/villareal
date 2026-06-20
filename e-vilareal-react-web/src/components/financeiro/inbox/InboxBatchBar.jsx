import { Check, Tag, X } from 'lucide-react';
import {
  CLASSE_BOTAO_APROVAR_CONTA,
  varsCorConta,
} from '../shared/contaCores.js';

export function InboxBatchBar({
  count,
  totalVisiveis = 0,
  onSelecionarTodos,
  todosSelecionados = false,
  onAprovarTodos,
  onPular,
  onRejeitar,
  rejeitarLabel = 'Não são par',
  aprovarLabel = 'Aprovar todos',
  busy,
  contas = [],
  contaLoteId = '',
  onContaLoteChange,
  onClassificarComConta,
}) {
  if (!count || count <= 0) return null;

  const modoClassificar = contas.length > 0 && onClassificarComConta;
  const contaEscolhida = modoClassificar
    ? contas.find((c) => String(c.id) === String(contaLoteId))
    : null;
  const codigoEscolhido = contaEscolhida?.codigo ?? '';
  const parcialmenteSelecionado =
    totalVisiveis > 0 && count > 0 && count < totalVisiveis && !todosSelecionados;

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-100 dark:border-blue-900 shrink-0"
      role="toolbar"
      aria-label="Ações em lote"
    >
      {onSelecionarTodos ? (
        <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={todosSelecionados}
            ref={(el) => {
              if (el) el.indeterminate = parcialmenteSelecionado;
            }}
            onChange={onSelecionarTodos}
            disabled={busy}
            className="rounded border-slate-300"
            aria-label={
              todosSelecionados
                ? 'Limpar seleção da tela'
                : `Selecionar todos (${totalVisiveis})`
            }
          />
        </label>
      ) : null}

      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
        {count} selecionado{count !== 1 ? 's' : ''}
        {totalVisiveis > 0 ? ` de ${totalVisiveis}` : ''}
      </span>

      {parcialmenteSelecionado ? (
        <button
          type="button"
          disabled={busy}
          onClick={onSelecionarTodos}
          className="text-sm text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-50"
        >
          Selecionar todos ({totalVisiveis})
        </button>
      ) : null}

      {modoClassificar ? (
        <>
          <select
            value={contaLoteId}
            onChange={(e) => onContaLoteChange?.(e.target.value)}
            disabled={busy}
            style={codigoEscolhido ? varsCorConta(codigoEscolhido) : undefined}
            className={`text-sm rounded-md border-2 bg-white dark:bg-slate-800 px-2 py-1.5 min-w-[10rem] ${
              codigoEscolhido ? 'fin-select-conta' : 'border-slate-300 dark:border-slate-600'
            }`}
            aria-label="Conta para classificar seleção"
          >
            <option value="">Classificar como…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !contaLoteId}
            onClick={onClassificarComConta}
            style={codigoEscolhido ? varsCorConta(codigoEscolhido) : undefined}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 ${
              codigoEscolhido ? CLASSE_BOTAO_APROVAR_CONTA : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            {codigoEscolhido ? `Classificar como ${codigoEscolhido}` : 'Classificar'}
          </button>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-600" aria-hidden>
            |
          </span>
        </>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={onAprovarTodos}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
        {aprovarLabel}
      </button>
      {onRejeitar ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRejeitar}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          {rejeitarLabel}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={onPular}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <X className="w-3.5 h-3.5" />
        Pular
      </button>
    </div>
  );
}
