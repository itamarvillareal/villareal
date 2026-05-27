import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, Clock, Loader2 } from 'lucide-react';
import { StatsCard } from './components/StatsCard.jsx';
import { ScheduleCard } from './components/ScheduleCard.jsx';
import { WhatsAppStatusBanner } from './components/WhatsAppStatusBanner.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { ConfirmDialog } from '../financeiro/shared/ConfirmDialog.jsx';
import { mensagemErroAmigavel } from '../../utils/mensagemErroAmigavel.js';

export function WhatsAppDashboard() {
  const { getStats, getScheduled, cancelSchedule } = useWhatsApp();
  const toast = useWhatsAppToast();
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoadOk, setStatsLoadOk] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadData = useCallback(async (signal) => {
    try {
      const [statsRes, schedRes] = await Promise.all([
        getStats(signal),
        getScheduled('PENDING', 0, 5, signal),
      ]);
      setStats(statsRes);
      setStatsLoadOk(true);
      setPending(Array.isArray(schedRes?.content) ? schedRes.content : []);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setStatsLoadOk(false);
        toast.error(mensagemErroAmigavel(err, 'carregar o resumo do WhatsApp'));
      }
    } finally {
      setLoading(false);
    }
  }, [getStats, getScheduled, toast]);

  useEffect(() => {
    const ac = new AbortController();
    loadData(ac.signal);
    const interval = window.setInterval(() => loadData(undefined), 30_000);
    return () => {
      ac.abort();
      window.clearInterval(interval);
    };
  }, [loadData]);

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await cancelSchedule(cancelId);
      toast.success('Agendamento cancelado.');
      setPending((prev) => prev.filter((r) => r.id !== cancelId));
      setCancelId(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao cancelar agendamento.');
    } finally {
      setCancelling(false);
    }
  };

  const todosZerados =
    stats &&
    !stats.sentToday &&
    !stats.receivedToday &&
    !stats.scheduledPending &&
    !stats.failedToday;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Resumo das mensagens WhatsApp de hoje. Use a aba «Enviar mensagem» para contactar clientes.
      </p>

      <WhatsAppStatusBanner
        configured={stats?.integrationConfigured}
        loadOk={statsLoadOk}
        fetchedAt={stats?.fetchedAt}
        loading={loading && !stats}
      />

      {statsLoadOk && stats?.integrationConfigured && todosZerados ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
          Nenhuma mensagem registrada hoje — a integração está ativa e funcionando normalmente.
        </p>
      ) : null}

      {loading && !stats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard icon={ArrowUp} label="Enviadas hoje" value={stats?.sentToday} />
          <StatsCard icon={ArrowDown} label="Recebidas hoje" value={stats?.receivedToday} />
          <StatsCard icon={Clock} label="Agendamentos pendentes" value={stats?.scheduledPending} />
          <StatsCard icon={AlertTriangle} label="Falhas hoje" value={stats?.failedToday} variant="danger" />
        </div>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Próximos agendamentos pendentes</h2>
          <Link to="/whatsapp/agendamentos" className="text-sm text-emerald-600 hover:underline">
            Ver todos
          </Link>
        </div>
        {pending.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CalendarClock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" aria-hidden />
            <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum agendamento pendente no momento.</p>
            <Link
              to="/whatsapp/agendamentos"
              className="inline-flex mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 underline"
            >
              Agendar uma mensagem
            </Link>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.slice(0, 3).map((row) => (
              <ScheduleCard
                key={row.id}
                item={row}
                compact
                onCancel={setCancelId}
                cancelling={cancelling && cancelId === row.id}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(cancelId)}
        title="Cancelar agendamento"
        message="Tem certeza que deseja cancelar este agendamento?"
        confirmLabel={cancelling ? 'Cancelando…' : 'Sim, cancelar'}
        danger
        onConfirm={handleCancel}
        onCancel={() => !cancelling && setCancelId(null)}
      />
    </div>
  );
}
