import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { buildPontosGraficoConsolidado, contaChartColor, labelContaTab } from './consolidadoUtils.js';

const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const CHART_ALTURA = { sm: 180, md: 240, lg: 360 };

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 text-slate-800 dark:text-slate-100';

function ChartTooltip({ active, payload, label, serie, comparar }) {
  if (!active || !payload?.length) return null;
  const monetario = serie === 'saldo';
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs shadow-md max-w-[14rem]">
      <p className="font-medium text-slate-800 dark:text-slate-100 mb-1">{label}</p>
      {payload.map((entry) => {
        const v = Number(entry.value) || 0;
        const nome =
          comparar && entry.dataKey !== 'valor'
            ? labelContaTab(entry.dataKey)
            : serie === 'saldo'
              ? 'Saldo'
              : 'Lançamentos';
        return (
          <p key={String(entry.dataKey)} className="text-slate-600 dark:text-slate-300">
            {comparar ? (
              <span className="inline-flex items-center gap-1">
                <ContaBadge codigo={entry.dataKey} size="sm" />
                {monetario ? fmtBrl.format(v) : `${fmtInt.format(v)} lanç.`}
              </span>
            ) : (
              <>
                {nome}: {monetario ? fmtBrl.format(v) : `${fmtInt.format(v)} lanç.`}
              </>
            )}
          </p>
        );
      })}
    </div>
  );
}

function renderSeries(tipo, seriesKeys, codigoAtivo, comparar, gradientId) {
  const keys = comparar ? seriesKeys : ['valor'];
  const colorFor = (key) => (comparar ? contaChartColor(key) : contaChartColor(codigoAtivo));

  if (tipo === 'bar') {
    return keys.map((key) => (
      <Bar
        key={key}
        dataKey={key}
        fill={colorFor(key)}
        radius={[3, 3, 0, 0]}
        maxBarSize={comparar ? 14 : 40}
      />
    ));
  }

  if (tipo === 'line') {
    return keys.map((key) => (
      <Line
        key={key}
        type="monotone"
        dataKey={key}
        stroke={colorFor(key)}
        strokeWidth={comparar ? 1.5 : 2}
        dot={comparar ? false : { r: 2 }}
        activeDot={{ r: 4 }}
      />
    ));
  }

  return keys.map((key) => (
    <Area
      key={key}
      type="monotone"
      dataKey={key}
      stroke={colorFor(key)}
      fill={comparar ? colorFor(key) : `url(#${gradientId})`}
      fillOpacity={comparar ? 0.15 : 1}
      strokeWidth={comparar ? 1.5 : 2}
      stackId={comparar ? undefined : undefined}
    />
  ));
}

/**
 * Gráfico de evolução mensal do consolidado com opções de período, tipo, métrica e comparativo.
 */
export function ConsolidadoEvolucaoChart({
  resumo,
  codigoAtivo,
  loading = false,
  meses = 12,
  onMesesChange,
}) {
  const [tipo, setTipo] = useState('area');
  const [serie, setSerie] = useState('saldo');
  const [altura, setAltura] = useState('md');
  const [comparar, setComparar] = useState(false);

  const { pontos, seriesKeys } = useMemo(
    () =>
      buildPontosGraficoConsolidado({
        resumo,
        codigoAtivo,
        qtdMeses: meses,
        serie,
        comparar,
      }),
    [resumo, codigoAtivo, meses, serie, comparar],
  );

  const chartColor = contaChartColor(codigoAtivo);
  const gradientId = `grad-consolidado-${codigoAtivo}`;
  const monetario = serie === 'saldo';
  const temDados = pontos.some((p) =>
    comparar
      ? seriesKeys.some((k) => Number(p[k]) !== 0)
      : Number(p.valor) !== 0,
  );

  const ChartRoot = tipo === 'bar' ? BarChart : tipo === 'line' ? LineChart : AreaChart;

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Evolução mensal
          {!comparar ? (
            <span className="ml-2 inline-flex align-middle">
              <ContaBadge codigo={codigoAtivo} size="sm" />
            </span>
          ) : null}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <span>Período</span>
            <select
              value={meses}
              onChange={(e) => onMesesChange?.(Number(e.target.value))}
              className={selectClass}
            >
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
              <option value={18}>18 meses</option>
              <option value={24}>24 meses</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <span>Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
              <option value="area">Área</option>
              <option value="bar">Barras</option>
              <option value="line">Linha</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <span>Métrica</span>
            <select value={serie} onChange={(e) => setSerie(e.target.value)} className={selectClass}>
              <option value="saldo">Saldo mensal</option>
              <option value="quantidade">Qtd. lançamentos</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <span>Altura</span>
            <select value={altura} onChange={(e) => setAltura(e.target.value)} className={selectClass}>
              <option value="sm">Compacto</option>
              <option value="md">Médio</option>
              <option value="lg">Alto</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={comparar}
              onChange={(e) => setComparar(e.target.checked)}
              className="rounded border-slate-300"
            />
            Comparar contas
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-8 text-center">Carregando gráfico…</p>
      ) : !temDados ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem movimentação no período selecionado.</p>
      ) : (
        <div className="w-full" style={{ height: CHART_ALTURA[altura] ?? CHART_ALTURA.md }}>
          <ResponsiveContainer width="100%" height="100%">
            <ChartRoot data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {tipo === 'area' && !comparar ? (
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
              ) : null}
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--chart-tick, #64748b)' }}
                axisLine={false}
                tickLine={false}
                interval={meses > 12 ? 1 : 0}
                angle={meses > 18 ? -35 : 0}
                textAnchor={meses > 18 ? 'end' : 'middle'}
                height={meses > 18 ? 48 : 30}
              />
              <YAxis
                tickFormatter={(v) => (monetario ? fmtCompact.format(v) : fmtInt.format(v))}
                tick={{ fontSize: 11, fill: 'var(--chart-tick, #64748b)' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={
                  <ChartTooltip serie={serie} comparar={comparar} />
                }
              />
              {comparar ? (
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>
                  )}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
              ) : null}
              {renderSeries(tipo, seriesKeys, codigoAtivo, comparar, gradientId)}
            </ChartRoot>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-2">
        Dados agregados da API (saldo líquido e quantidade por conta e mês).
      </p>
    </section>
  );
}
