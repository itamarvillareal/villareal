import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { obterConsolidacaoApi, persistirSnapshotApi } from '../../repositories/patrimonioRepository.js';
import { fmtBRL, fmtPct } from './patrimonioFormat.js';

function Kpi({ label, value, hint, tone }) {
  const tones = {
    default: 'text-slate-900 dark:text-slate-100',
    good: 'text-teal-700 dark:text-teal-300',
    warn: 'text-amber-700 dark:text-amber-300',
    bad: 'text-red-700 dark:text-red-300',
  };
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-semibold mt-0.5 ${tones[tone] || tones.default}`}>{value}</p>
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

export function PatrimonioDashboard() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      setData(await obterConsolidacaoApi());
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar consolidação');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvarSnapshot() {
    try {
      setData(await persistirSnapshotApi());
    } catch (e) {
      setErro(e?.message || 'Falha ao persistir snapshot');
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Carregando consolidação…</p>;
  }

  const alav = Number(data?.alavancagem || 0);
  const reservaOk = Number(data?.reservaEmergencia || 0) >= Number(data?.pisoReserva || 0);

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Consolidação patrimonial</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quadro único: quanto há, onde está, quanto rende, quanto custa a dívida.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <button
            type="button"
            onClick={salvarSnapshot}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-teal-700 text-white hover:bg-teal-800"
          >
            Salvar snapshot do dia
          </button>
        </div>
      </header>

      {erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {erro}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Ativo total" value={fmtBRL(data?.ativoTotal)} />
        <Kpi label="Passivo total" value={fmtBRL(data?.passivoTotal)} />
        <Kpi label="Patrimônio líquido" value={fmtBRL(data?.patrimonioLiquido)} tone="good" />
        <Kpi
          label="Alavancagem"
          value={fmtPct(alav * 100)}
          hint="passivo / ativo"
          tone={alav >= 0.55 ? 'bad' : alav >= 0.4 ? 'warn' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Kpi
          label="Caixa livre"
          value={fmtBRL(data?.caixaLivre)}
          hint={`Total ${fmtBRL(data?.caixaTotal)} · vinculado ${fmtBRL(data?.caixaVinculado)}`}
          tone={Number(data?.caixaLivre) <= 0 ? 'bad' : 'default'}
        />
        <Kpi
          label="Reserva de emergência"
          value={fmtBRL(data?.reservaEmergencia)}
          hint={`Piso ${fmtBRL(data?.pisoReserva)}`}
          tone={reservaOk ? 'good' : 'bad'}
        />
        <Kpi
          label="Taxa referência (líquida)"
          value={fmtPct(data?.taxaReferenciaLiquidaAa)}
          hint="CDI líquido / melhor RF — base do comparador"
        />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">Ativos por classe</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(data?.breakdownAtivos || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-4">
                <span className="text-slate-500">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium tabular-nums">{fmtBRL(v)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">Passivos por tipo</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(data?.breakdownPassivos || {})
              .filter(([, v]) => Number(v) > 0)
              .map(([k, v]) => (
                <li key={k} className="flex justify-between gap-4">
                  <span className="text-slate-500">{k.replace(/_/g, ' ')}</span>
                  <span className="font-medium tabular-nums">{fmtBRL(v)}</span>
                </li>
              ))}
            {!Object.values(data?.breakdownPassivos || {}).some((v) => Number(v) > 0) ? (
              <li className="text-slate-500">Nenhum passivo cadastrado.</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">Evolução do patrimônio líquido</h2>
        {(data?.historicoPl || []).length === 0 ? (
          <p className="text-sm text-slate-500">
            Sem histórico ainda. Use &quot;Salvar snapshot do dia&quot; para iniciar a série.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.historicoPl}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtBRL(v)} />
                <Line type="monotone" dataKey="patrimonioLiquido" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Próximo passo decisório:{' '}
        <Link className="text-teal-700 dark:text-teal-400 underline" to="/patrimonio/amortizacao">
          Amortizar vs investir
        </Link>{' '}
        ·{' '}
        <Link className="text-teal-700 dark:text-teal-400 underline" to="/patrimonio/comparador">
          Comparador universal
        </Link>
      </p>
    </div>
  );
}
