import { Check, ChevronRight, CircleAlert, CircleDashed } from 'lucide-react';
import {
  infoEstadoCompetencia,
  rotuloCompetenciaCurta,
} from '../../data/imoveisAluguelChecklist.js';
import { statusRepasseInfo } from '../../data/imoveisReconciliacao.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function IconeEstado({ icon }) {
  if (icon === 'ok') return <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />;
  if (icon === 'warn' || icon === 'multi') {
    return <CircleAlert className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />;
  }
  return <CircleDashed className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />;
}

/**
 * @param {{
 *   meses: Array<object>,
 *   competenciaAtiva: string,
 *   onSelecionarCompetencia: (comp: string) => void,
 *   valorAluguelContrato?: number | null,
 *   carregando?: boolean,
 *   modoFiltro?: boolean,
 * }} props
 */
export function ImoveisAluguelChecklist({
  meses,
  competenciaAtiva,
  onSelecionarCompetencia,
  valorAluguelContrato,
  carregando = false,
  modoFiltro = false,
}) {
  const lista = Array.isArray(meses) ? meses : [];

  if (carregando) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Carregando checklist de competências…
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Nenhuma competência no período do contrato.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <h2 className="text-sm font-semibold text-slate-800">
          {modoFiltro ? 'Filtro por competência' : 'Aluguéis por competência'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {modoFiltro
            ? 'Selecione o mês para filtrar a conta corrente e classificar na linha do lançamento.'
            : 'Clique no mês para classificar.'}{' '}
          Esperado: <strong>{formatBRL(valorAluguelContrato)}</strong> por mês (contrato vigente).
        </p>
      </div>
      <ul className="divide-y divide-slate-100 max-h-[min(420px,50vh)] overflow-y-auto">
        {lista.map((item) => {
          const comp = item.competencia;
          const info = infoEstadoCompetencia(item.estado);
          const ativo = comp === competenciaAtiva;
          const vinc = item.aluguelVinculado;
          const repasse = statusRepasseInfo(item.statusRepasse);

          return (
            <li key={comp}>
              <button
                type="button"
                onClick={() => onSelecionarCompetencia(comp)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-indigo-50/60 ${
                  ativo ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''
                }`}
              >
                <IconeEstado icon={info.icon} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">
                      {rotuloCompetenciaCurta(comp)}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${info.cls}`}
                    >
                      {info.label}
                    </span>
                    {String(item.estado).toUpperCase() === 'VINCULADO' ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-medium ${repasse.cls}`}
                      >
                        {repasse.label}
                      </span>
                    ) : null}
                  </div>
                  {vinc ? (
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {formatBRL(vinc.valor)} · {vinc.data ? String(vinc.data).slice(0, 10) : '—'} ·{' '}
                      {vinc.descricao || '—'}
                    </p>
                  ) : item.candidatos?.length === 1 ? (
                    <p className="text-xs text-amber-800 mt-0.5 truncate">
                      {formatBRL(item.candidatos[0].valor)} · {item.candidatos[0].descricao || '—'}
                    </p>
                  ) : item.candidatos?.length > 1 ? (
                    <p className="text-xs text-amber-800 mt-0.5">
                      {item.candidatos.length} créditos candidatos — classifique na conta corrente
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Nenhum crédito compatível encontrado</p>
                  )}
                </div>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 ${ativo ? 'text-indigo-600' : 'text-slate-300'}`}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
