import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { featureFlags } from '../../../config/featureFlags.js';
import { obterSaudeFinanceiroApi } from '../../../repositories/financeiroRepository.js';
import { DashboardSkeleton } from '../shared/LoadingSkeleton.jsx';
import { ETAPAS, INBOX_TIPOS } from '../constants/financeiroConstants.js';
import { pathInboxFinanceiro } from '../financeiroNavLinks.js';

function etapaCount(saude, etapa) {
  return Number(saude?.porEtapa?.[etapa] ?? 0);
}

function KpiCard({ label, value, sublabel, tone = 'neutral', to }) {
  const tones = {
    neutral: 'text-slate-900 dark:text-slate-100',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };
  const inner = (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 h-full">
      <p className={`text-[28px] font-medium leading-none tabular-nums ${tones[tone]}`}>
        {value != null ? Number(value).toLocaleString('pt-BR') : '—'}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
      {sublabel ? <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p> : null}
    </div>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="block hover:ring-2 hover:ring-blue-200 dark:hover:ring-blue-800 rounded-lg transition-shadow"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function barColor(pct) {
  if (pct >= 85) return 'var(--fin-progress-alto)';
  if (pct >= 50) return 'var(--fin-progress-medio)';
  return 'var(--fin-progress-baixo)';
}

const ETAPA_CHART = {
  IMPORTADO: { label: 'Pendente', color: '#f59e0b' },
  CLASSIFICADO: { label: 'Classificado', color: '#3b82f6' },
  COMPENSADO: { label: 'Compensado', color: '#10b981' },
  VINCULADO: { label: 'Vinculado', color: '#8b5cf6' },
  FECHADO: { label: 'Fechado', color: '#64748b' },
};

function EtapaDonutChart({ saude }) {
  const total = Number(saude?.totalLancamentos ?? 0);
  const data = useMemo(() => {
    const porEtapa = saude?.porEtapa ?? {};
    return Object.entries(ETAPA_CHART)
      .map(([key, cfg]) => ({
        name: cfg.label,
        etapa: key,
        value: Number(porEtapa[key] ?? 0),
        color: cfg.color,
      }))
      .filter((d) => d.value > 0);
  }, [saude]);

  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">Sem dados de etapa.</p>;
  }

  return (
    <div className="h-[240px] w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            innerRadius={58}
            outerRadius={78}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.etapa} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => Number(v).toLocaleString('pt-BR')}
            contentStyle={{
              background: 'var(--tooltip-bg, #fff)',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ marginBottom: 28 }}
        aria-hidden
      >
        <span className="text-xl font-medium tabular-nums text-slate-800 dark:text-slate-100">
          {total.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [saude, setSaude] = useState(null);
  const [loading, setLoading] = useState(featureFlags.useApiFinanceiro);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setLoading(false);
      setErro('API financeiro desativada.');
      return undefined;
    }
    const ac = new AbortController();
    setLoading(true);
    setErro('');
    obterSaudeFinanceiroApi({ signal: ac.signal })
      .then((data) => {
        setSaude(data);
        setErro('');
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setSaude(null);
        setErro(e?.message || 'Não foi possível carregar o painel.');
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  const pendentes = useMemo(() => etapaCount(saude, ETAPAS.IMPORTADO), [saude]);
  const total = Number(saude?.totalLancamentos ?? 0);
  const pctPendentes =
    total > 0 ? `${((pendentes / total) * 100).toFixed(1).replace('.', ',')}%` : null;

  const meses = useMemo(() => {
    const raw = saude?.mesesAbertos ?? [];
    return raw.map((m) => ({
      ...m,
      mesKey: `${m.ano}-${String(m.mes).padStart(2, '0')}`,
      pct: Math.round(Number(m.percentualCompleto ?? 0)),
      fechado: Number(m.percentualCompleto ?? 0) >= 100 && Number(m.pendentes ?? 0) === 0,
    }));
  }, [saude]);

  if (!featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">{erro}</div>
    );
  }

  if (loading) return <DashboardSkeleton />;

  if (erro && !saude) {
    return (
      <div className="p-6 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg m-4 border border-red-200 dark:border-red-900">
        {erro}
      </div>
    );
  }

  return (
    <div className="min-h-0 h-full overflow-auto p-4 space-y-4 max-w-6xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total lançamentos" value={saude?.totalLancamentos} />
        <KpiCard
          label="Pendentes"
          value={pendentes}
          sublabel={pctPendentes}
          tone="amber"
          to={pathInboxFinanceiro('', INBOX_TIPOS.classificar)}
        />
        <KpiCard
          label="Compensações válidas"
          value={etapaCount(saude, ETAPAS.COMPENSADO)}
        />
        <KpiCard
          label="Revisar"
          value={saude?.gruposInconsistentes}
          tone="red"
          to={pathInboxFinanceiro('', INBOX_TIPOS.inconsistentes)}
        />
      </div>

      {meses.length > 0 ? (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">Progresso mensal</h2>
          <ul className="space-y-2">
            {meses.map((m) => (
              <li key={m.mesKey} className="flex items-center gap-3 text-sm">
                <Link
                  to={`/financeiro/extrato?mes=${m.mesKey}`}
                  className="w-[60px] shrink-0 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {formatMesLabel(m.mesKey)}
                </Link>
                <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, m.pct)}%`, background: barColor(m.pct) }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {m.pct}%
                </span>
                {m.fechado ? (
                  <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" aria-label="Mês fechado" />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Distribuição por etapa
          </h2>
          <EtapaDonutChart saude={saude} />
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">Inbox — pendências</h2>
          <ul className="space-y-2 text-sm">
            <PendenciaLink
              label="Classificar"
              count={pendentes}
              tipo={INBOX_TIPOS.classificar}
            />
            <PendenciaLink
              label="Compensar"
              count={saude?.paresOrfaosSugeridos}
              tipo={INBOX_TIPOS.compensar}
            />
            <PendenciaLink
              label="Inconsistentes"
              count={saude?.gruposInconsistentes}
              tipo={INBOX_TIPOS.inconsistentes}
            />
          </ul>
        </section>
      </div>

      {saude?.atualizadoEm ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-right">
          Atualizado: {new Date(saude.atualizadoEm).toLocaleString('pt-BR')}
        </p>
      ) : null}
    </div>
  );
}

function PendenciaLink({ label, count, tipo }) {
  return (
    <li>
      <Link
        to={pathInboxFinanceiro('', tipo)}
        className="flex justify-between items-center py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
      >
        <span>{label}</span>
        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
          {count != null ? Number(count).toLocaleString('pt-BR') : '—'} →
        </span>
      </Link>
    </li>
  );
}

function formatMesLabel(mesKey) {
  if (!mesKey) return '—';
  const m = /^(\d{4})-(\d{2})$/.exec(String(mesKey));
  if (!m) return mesKey;
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${labels[Number(m[2]) - 1]}/${m[1].slice(-2)}`;
}

