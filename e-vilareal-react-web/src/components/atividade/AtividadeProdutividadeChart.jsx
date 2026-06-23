import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { resumoProdutividade } from './atividadeProdutividadeUtils.js';

const fmtHoras = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function TooltipProdutividade({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-slate-800 dark:text-slate-100 mb-1">{label}</p>
      <p className="text-slate-600 dark:text-slate-300">
        Horas ativas: <span className="font-semibold">{fmtHoras.format(p?.horas ?? 0)} h</span>
      </p>
      <p className="text-slate-500 dark:text-slate-400">{p?.atividades ?? 0} ação(ões) registrada(s)</p>
    </div>
  );
}

/**
 * Gráfico de produtividade (horas ativas por dia) a partir do log de auditoria.
 */
export function AtividadeProdutividadeChart({ pontos, loading, nomeUsuario }) {
  const resumo = useMemo(() => resumoProdutividade(pontos ?? []), [pontos]);

  const tickInterval = useMemo(() => {
    const n = pontos?.length ?? 0;
    if (n <= 14) return 0;
    if (n <= 31) return 1;
    return Math.floor(n / 15);
  }, [pontos?.length]);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/90 shadow-xl ring-1 ring-indigo-500/10 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Produtividade — horas por dia
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {nomeUsuario ? (
              <>
                Colaborador: <span className="font-medium text-slate-700 dark:text-slate-200">{nomeUsuario}</span>
                {' · '}
              </>
            ) : null}
            Sessões da 1ª à última ação do bloco. Pausas de 30 min ou mais separam jornadas; blocos com menos de 1 min são ignorados; intervalos menores que 5 min contam como tempo ininterrupto.
          </p>
        </div>
        {!loading && pontos?.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <dt className="inline text-slate-500">Total no período: </dt>
              <dd className="inline font-semibold text-indigo-700 dark:text-indigo-300">
                {fmtHoras.format(resumo.totalHoras)} h
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Média/dia com atividade: </dt>
              <dd className="inline font-semibold">{fmtHoras.format(resumo.mediaHoras)} h</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Dias com registro: </dt>
              <dd className="inline font-semibold">
                {resumo.diasComAtividade}/{resumo.diasNoPeriodo}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Calculando produtividade…
        </div>
      ) : !pontos?.length ? (
        <p className="text-sm text-slate-500 py-8 text-center">Nenhum dado para exibir no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 10, fill: '#64748b' }}
              interval={tickInterval}
              angle={pontos.length > 14 ? -35 : 0}
              textAnchor={pontos.length > 14 ? 'end' : 'middle'}
              height={pontos.length > 14 ? 52 : 28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${v}h`}
              width={36}
              allowDecimals
            />
            <Tooltip content={<TooltipProdutividade />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
            <Bar dataKey="horas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} name="Horas ativas" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
