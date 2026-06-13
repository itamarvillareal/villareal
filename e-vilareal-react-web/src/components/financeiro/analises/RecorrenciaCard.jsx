import { ContaBadge } from '../shared/ContaBadge.jsx';
import { formatMoeda } from '../shared/financeiroFormat.js';
import { CLASSE_BOTAO_APROVAR_CONTA, varsCorConta } from '../shared/contaCores.js';
import { rotuloConfianca } from './analisesUtils.js';

export function RecorrenciaCard({ padrao, fading, onClassificar, onRevisar, busy }) {
  const isMedia = String(padrao?.confianca ?? '').toUpperCase() === 'MEDIA';
  const qtd = Number(padrao?.qtdPendentes ?? 0);
  const codigo = padrao?.contaCodigo ?? 'N';
  const consistenciaPct = Math.round(Number(padrao?.consistenciaConta ?? 0) * 100);

  return (
    <article
      className={`rounded-lg border bg-white dark:bg-slate-900 p-4 transition-all duration-300 ${
        fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'
      } ${
        isMedia
          ? 'border-amber-200 dark:border-amber-800/60 ring-1 ring-amber-100 dark:ring-amber-900/40'
          : 'border-slate-200 dark:border-slate-700'
      }`}
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p
            className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate"
            title={padrao?.descricaoExemplo}
          >
            {padrao?.descricaoExemplo ?? '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {padrao?.bancoNome ?? 'Banco'}
            {' · ~'}
            {formatMoeda(padrao?.valorTipico)}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <ContaBadge codigo={codigo} size="md" title={padrao?.contaNome} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{padrao?.contaNome}</span>
          </div>
          {padrao?.clienteId || padrao?.processoId ? (
            <p className="text-xs text-violet-700 dark:text-violet-300">
              Vincula: {padrao.clienteNome ?? 'cliente'}
              {padrao.processoNumero ? ` · proc ${padrao.processoNumero}` : ''}
            </p>
          ) : null}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {Number(padrao?.mesesCobertos ?? 0).toLocaleString('pt-BR')} de 12 meses ·{' '}
            {Number(padrao?.ocorrenciasHistorico ?? 0).toLocaleString('pt-BR')} históricos · consistência{' '}
            {consistenciaPct}% · confiança {rotuloConfianca(padrao?.confianca)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100 leading-none"
            aria-label={`${qtd} pendentes`}
          >
            {qtd.toLocaleString('pt-BR')}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">pendentes</span>
          {isMedia ? (
            <button
              type="button"
              disabled={busy || qtd <= 0}
              onClick={() => onRevisar(padrao)}
              className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-200 disabled:opacity-50"
              aria-label={`Revisar classificação de ${qtd} lançamentos como ${codigo}`}
            >
              Revisar
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || qtd <= 0}
              onClick={() => onClassificar(padrao)}
              className={`text-xs px-3 py-1.5 rounded-md text-white disabled:opacity-50 ${CLASSE_BOTAO_APROVAR_CONTA}`}
              style={varsCorConta(codigo)}
              aria-label={`Classificar ${qtd} lançamentos como ${codigo}`}
            >
              Classificar {qtd} como {codigo}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
