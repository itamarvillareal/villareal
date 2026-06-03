import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { fetchJobRuns, fetchJobsHealth } from '../repositories/jobRunsRepository.js';
import { mensagemErroAmigavel } from '../utils/mensagemErroAmigavel.js';

const REFRESH_MS = 30_000;

const HEALTH_STYLE = {
  ok: {
    ring: 'ring-emerald-400/60',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    badge: 'bg-emerald-600 text-white',
    Icon: CheckCircle2,
    label: 'OK',
  },
  stale: {
    ring: 'ring-amber-400/70',
    bg: 'bg-amber-50 dark:bg-amber-950/25',
    badge: 'bg-amber-500 text-amber-950',
    Icon: Clock,
    label: 'Atrasado',
  },
  stuck: {
    ring: 'ring-red-500/70',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'bg-red-600 text-white',
    Icon: AlertTriangle,
    label: 'Travado',
  },
  failing: {
    ring: 'ring-red-500/70',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'bg-red-700 text-white',
    Icon: XCircle,
    label: 'Falhando',
  },
  never_run: {
    ring: 'ring-slate-300 dark:ring-white/15',
    bg: 'bg-slate-50 dark:bg-white/5',
    badge: 'bg-slate-500 text-white',
    Icon: Server,
    label: 'Sem histórico',
  },
};

const STATUS_STYLE = {
  SUCCESS: 'text-emerald-700 dark:text-emerald-300',
  ERROR: 'text-red-700 dark:text-red-300',
  TIMEOUT: 'text-orange-700 dark:text-orange-300',
  RUNNING: 'text-blue-700 dark:text-blue-300',
};

function fmtDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDuracao(ms) {
  if (ms == null || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m} min ${rest}s`;
}

function haQuantoMin(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return `há ${dias} dia(s)`;
}

function JobCard({ job }) {
  const h = HEALTH_STYLE[job.health] ?? HEALTH_STYLE.never_run;
  const Icon = h.Icon;
  const ref = job.runningNow ? job.lastStartedAt : job.lastFinishedAt ?? job.lastStartedAt;

  return (
    <article
      className={`rounded-xl border border-slate-200/80 dark:border-white/10 p-4 ring-2 ${h.ring} ${h.bg} shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
          {job.displayName || job.jobName}
        </h3>
        <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${h.badge}`}>
          {h.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-2">
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>{job.healthDetail || '—'}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        <dt>Última exec.</dt>
        <dd className="font-medium text-slate-800 dark:text-slate-200">
          {haQuantoMin(ref) ?? '—'}
        </dd>
        <dt>Duração</dt>
        <dd>{fmtDuracao(job.lastDurationMs)}</dd>
        <dt>Itens</dt>
        <dd>
          {job.lastItemsProcessed ?? 0}
          {job.lastItemsFailed != null && job.lastItemsFailed > 0 ? (
            <span className="text-red-600 dark:text-red-400"> (+{job.lastItemsFailed} falhas)</span>
          ) : null}
        </dd>
        <dt>Status</dt>
        <dd className={STATUS_STYLE[job.lastStatus] ?? ''}>{job.lastStatus ?? '—'}</dd>
      </dl>
      {job.runningNow ? (
        <p className="mt-2 text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
          Em execução…
        </p>
      ) : null}
    </article>
  );
}

function ModalErro({ run, onFechar }) {
  if (!run) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-erro-job-title"
    >
      <div className="bg-white dark:bg-[#141c2c] rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <h2 id="modal-erro-job-title" className="text-sm font-bold">
            Erro — {run.jobName} (#{run.id})
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm px-2 py-1"
          >
            Fechar
          </button>
        </div>
        <div className="p-4 overflow-auto text-sm space-y-3">
          <p className="text-red-800 dark:text-red-200 font-medium whitespace-pre-wrap">
            {run.errorMessage || 'Sem mensagem.'}
          </p>
          {run.errorStack ? (
            <pre className="text-xs bg-slate-100 dark:bg-black/40 p-3 rounded-lg overflow-auto max-h-[50vh] whitespace-pre-wrap">
              {run.errorStack}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RelatorioTarefas() {
  const [health, setHealth] = useState(null);
  const [runs, setRuns] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroJob, setFiltroJob] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [runErro, setRunErro] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [h, r] = await Promise.all([
        fetchJobsHealth(),
        fetchJobRuns({
          jobName: filtroJob || undefined,
          status: filtroStatus || undefined,
          page: 0,
          limit: 80,
        }),
      ]);
      setHealth(h);
      setRuns(r);
    } catch (e) {
      console.error(e);
      setErro(mensagemErroAmigavel(e, 'carregar relatório de tarefas'));
    } finally {
      setLoading(false);
    }
  }, [filtroJob, filtroStatus]);

  useEffect(() => {
    setLoading(true);
    carregar();
  }, [carregar]);

  useEffect(() => {
    const id = setInterval(() => {
      carregar();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const jobsOrdenados = useMemo(() => {
    const lista = health?.jobs ?? [];
    const ordem = { stuck: 0, failing: 1, stale: 2, never_run: 3, ok: 4 };
    return [...lista].sort(
      (a, b) => (ordem[a.health] ?? 9) - (ordem[b.health] ?? 9) || (a.displayName ?? '').localeCompare(b.displayName ?? '')
    );
  }, [health]);

  const opcoesJob = useMemo(() => {
    const names = new Set((health?.jobs ?? []).map((j) => j.jobName));
    (runs.content ?? []).forEach((r) => names.add(r.jobName));
    return [...names].sort();
  }, [health, runs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50/30 to-slate-50 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-lg">
              <Activity className="w-5 h-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-bold">Relatório de Tarefas</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saúde dos jobs na VPS · atualização automática a cada 30s
                {health?.checkedAt ? ` · verificado ${haQuantoMin(health.checkedAt)}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              carregar();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Atualizar
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 px-4 py-3 text-sm">
            {erro}
          </div>
        ) : null}

        {loading && !health ? (
          <div className="flex flex-col items-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" aria-hidden />
            <p className="text-sm">Carregando saúde dos jobs…</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Saúde por tarefa ({jobsOrdenados.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {jobsOrdenados.map((job) => (
                  <JobCard key={job.jobName} job={job} />
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#141c2c]/90 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Histórico de execuções</h2>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filtroJob}
                    onChange={(e) => setFiltroJob(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] text-sm px-2 py-1.5 min-w-[12rem]"
                  >
                    <option value="">Todos os jobs</option>
                    {opcoesJob.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] text-sm px-2 py-1.5"
                  >
                    <option value="">Todos os status</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="ERROR">ERROR</option>
                    <option value="TIMEOUT">TIMEOUT</option>
                    <option value="RUNNING">RUNNING</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Início</th>
                      <th className="px-4 py-2 font-semibold">Job</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Duração</th>
                      <th className="px-4 py-2 font-semibold">Itens</th>
                      <th className="px-4 py-2 font-semibold">Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {(runs.content ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Nenhuma execução registrada ainda.
                        </td>
                      </tr>
                    ) : (
                      (runs.content ?? []).map((run) => (
                        <tr key={run.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                          <td className="px-4 py-2 whitespace-nowrap">{fmtDataHora(run.startedAt)}</td>
                          <td className="px-4 py-2 font-mono text-xs">{run.jobName}</td>
                          <td className={`px-4 py-2 font-semibold ${STATUS_STYLE[run.status] ?? ''}`}>
                            {run.status}
                          </td>
                          <td className="px-4 py-2">{fmtDuracao(run.durationMs)}</td>
                          <td className="px-4 py-2 tabular-nums">
                            {run.itemsProcessed}
                            {run.itemsFailed > 0 ? (
                              <span className="text-red-600"> / {run.itemsFailed} falhas</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 max-w-[14rem] truncate">
                            {run.status === 'ERROR' || run.status === 'TIMEOUT' ? (
                              <button
                                type="button"
                                className="text-sky-700 dark:text-sky-300 hover:underline text-left truncate max-w-full"
                                onClick={() => setRunErro(run)}
                              >
                                {run.errorMessage || 'Ver stack'}
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100 dark:border-white/5">
                {runs.totalElements ?? 0} registro(s) · exibindo até 80 mais recentes
              </p>
            </section>
          </>
        )}
      </main>

      <ModalErro run={runErro} onFechar={() => setRunErro(null)} />
    </div>
  );
}
