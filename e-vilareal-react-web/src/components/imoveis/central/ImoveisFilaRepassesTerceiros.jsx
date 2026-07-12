import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, ChevronRight } from 'lucide-react';
import { competenciaLabel, formatBRL } from './imoveisCentralFormat.js';

const th =
  'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap bg-slate-50/90 dark:bg-slate-900/90';
const td =
  'px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60 align-middle';

function diaHoje() {
  return new Date().getDate();
}

/**
 * Fila de repasses a locadores de imóveis de terceiros (exclui repasseInterno / imóveis próprios).
 * @param {{
 *   repasses: Array<object>,
 *   porNumeroPlanilha: Map<number, object>,
 *   variante?: 'compact' | 'full',
 * }} props
 */
export function ImoveisFilaRepassesTerceiros({ repasses, porNumeroPlanilha, variante = 'full' }) {
  const navigate = useNavigate();
  const hoje = diaHoje();

  const grupos = useMemo(() => {
    const itens = (Array.isArray(repasses) ? repasses : []).filter((r) => {
      const np = r.imovelNumeroPlanilha;
      const visao = np != null ? porNumeroPlanilha.get(Number(np)) : null;
      return !Boolean(visao?.repasseInterno);
    });

    const porDia = new Map();
    for (const r of itens) {
      const np = Number(r.imovelNumeroPlanilha);
      const visao = Number.isFinite(np) ? porNumeroPlanilha.get(np) : null;
      const dia = Number(visao?.diaRepasse ?? 0) || 0;
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push({
        ...r,
        diaRepasse: dia,
        liquido:
          Number(r.repasseEsperado ?? 0) -
          Number(r.despesas ?? 0),
      });
    }

    return [...porDia.entries()]
      .sort((a, b) => {
        if (a[0] === 0) return 1;
        if (b[0] === 0) return -1;
        return a[0] - b[0];
      })
      .map(([dia, lista]) => {
        const totalLiquido = lista.reduce((s, it) => s + (Number(it.liquido) || 0), 0);
        const totalAberto = lista.reduce((s, it) => s + (Number(it.valorEmAberto) || 0), 0);
        return { dia, lista, totalLiquido, totalAberto, ehHoje: dia === hoje };
      });
  }, [repasses, porNumeroPlanilha, hoje]);

  if (grupos.length === 0) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-300">
        Nenhum repasse pendente para imóveis de terceiros.
      </p>
    );
  }

  const repassesHoje = grupos.find((g) => g.ehHoje);

  return (
    <div className="space-y-3">
      {variante === 'compact' && repassesHoje ? (
        <p className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <strong>{repassesHoje.lista.length}</strong> repasse{repassesHoje.lista.length === 1 ? '' : 's'} com dia{' '}
          <strong>{repassesHoje.dia}</strong> (hoje) · líquido {formatBRL(repassesHoje.totalLiquido)}
        </p>
      ) : null}
      {grupos.map((g) => (
        <div
          key={g.dia}
          className={`rounded-lg border overflow-hidden ${
            g.ehHoje
              ? 'border-orange-300 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <Banknote className="w-4 h-4 text-teal-600 shrink-0" aria-hidden />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Dia {g.dia > 0 ? g.dia : '—'} do mês
                {g.ehHoje ? (
                  <span className="ml-2 text-[10px] uppercase font-bold text-orange-700 dark:text-orange-300">
                    hoje
                  </span>
                ) : null}
              </span>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {g.lista.length} imóve{g.lista.length === 1 ? 'l' : 'is'} · líquido {formatBRL(g.totalLiquido)} · em
              aberto {formatBRL(g.totalAberto)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr>
                  <th className={th}>Nº</th>
                  <th className={th}>Locador</th>
                  <th className={th}>Competência</th>
                  <th className={`${th} text-right`}>Aluguel</th>
                  <th className={`${th} text-right`}>Líquido</th>
                  <th className={`${th} text-right`}>Em aberto</th>
                  <th className={th} aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {g.lista.map((r, i) => (
                  <tr key={`${r.contratoId}-${r.competencia}-${i}`} className="hover:bg-teal-50/40 dark:hover:bg-teal-950/20">
                    <td className={`${td} font-semibold tabular-nums`}>{r.imovelNumeroPlanilha ?? '—'}</td>
                    <td className={`${td} max-w-[180px] truncate`} title={r.locadorNome ?? undefined}>
                      {r.locadorNome || '—'}
                    </td>
                    <td className={`${td} tabular-nums`}>{competenciaLabel(r.competencia)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatBRL(r.aluguel)}</td>
                    <td className={`${td} text-right tabular-nums font-medium`}>{formatBRL(r.liquido)}</td>
                    <td className={`${td} text-right tabular-nums font-semibold text-orange-700 dark:text-orange-300`}>
                      {formatBRL(r.valorEmAberto)}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {r.imovelNumeroPlanilha != null ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/imoveis/${r.imovelNumeroPlanilha}?aba=conta-corrente`)
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                          title="Abrir conta corrente para registrar o débito de repasse no banco"
                        >
                          Pago no banco
                          <ChevronRight className="w-3 h-3" aria-hidden />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
