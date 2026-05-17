import { AlertTriangle, SkipForward } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ValorText } from '../../shared/ValorText.jsx';
import { acaoInconsistencia, mapLancamentoInbox } from '../inboxMappers.js';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InconsistenciaCard({ grupo, onIgnorar, fading }) {
  const soma = Number(grupo.soma ?? 0);
  const acao = acaoInconsistencia(grupo.sugestao, soma);
  const idGrupo = grupo.grupoCompensacao ?? '—';

  return (
    <article
      className={`rounded-lg border border-amber-200 dark:border-amber-800 px-4 py-3 mb-2 bg-amber-50/50 dark:bg-amber-950/20 hover:shadow-sm transition-all duration-300 ${
        fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden />
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Grupo {idGrupo} — Soma ≠ 0
          </h3>
        </div>
        {grupo.sugestao ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sugestão: {String(grupo.sugestao).replace(/_/g, ' ')}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <th className="px-2 py-1.5 font-medium">Data</th>
              <th className="px-2 py-1.5 font-medium">Banco</th>
              <th className="px-2 py-1.5 font-medium">Descrição</th>
              <th className="px-2 py-1.5 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(grupo.lancamentos ?? []).map((l) => {
              const row = mapLancamentoInbox(l);
              return (
                <tr key={row.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                  <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{row.dataExibicao}</td>
                  <td className="px-2 py-1.5 text-slate-500">{row.bancoNome || '—'}</td>
                  <td className="px-2 py-1.5 max-w-[200px] truncate">{row.descricao}</td>
                  <td className="px-2 py-1.5 text-right">
                    <ValorText valor={row.valor} natureza={row.natureza} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        <span>
          Soma: <strong className="tabular-nums">R$ {fmt.format(soma)}</strong>
        </span>
        {grupo.descricaoSugestao ? (
          <span className="text-slate-500 dark:text-slate-400">{grupo.descricaoSugestao}</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        {acao.link ? (
          <Link
            to={acao.link}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            {acao.label}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            title="Ação informativa — em breve"
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-default opacity-90"
          >
            {acao.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => onIgnorar(idGrupo)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:underline"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Ignorar
        </button>
      </div>
    </article>
  );
}
