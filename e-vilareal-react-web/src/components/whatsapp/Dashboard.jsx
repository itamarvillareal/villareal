import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, Clock, Loader2, Send } from 'lucide-react';
import { StatsCard } from './components/StatsCard.jsx';
import { SendMessageModal } from './components/SendMessageModal.jsx';
import { ScheduleCard } from './components/ScheduleCard.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { ConfirmDialog } from '../financeiro/shared/ConfirmDialog.jsx';
import { processosBtnPrimary } from '../processos/ProcessosAdminLayout.jsx';

export function WhatsAppDashboard() {
  const { getStats, getScheduled, cancelSchedule } = useWhatsApp();
  const toast = useWhatsAppToast();
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadData = useCallback(async (signal) => {
    try {
      const [statsRes, schedRes] = await Promise.all([
        getStats(signal),
        getScheduled('PENDING', 0, 5, signal),
      ]);
      setStats(statsRes);
      setPending(Array.isArray(schedRes?.content) ? schedRes.content : []);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.error(err?.message || 'Erro ao carregar dashboard.');
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Visão geral das mensagens WhatsApp de hoje.
        </p>
        <button type="button" className={processosBtnPrimary} onClick={() => setSendOpen(true)}>
          <Send className="w-4 h-4" />
          Enviar mensagem
        </button>
      </div>

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
          <p className="px-4 py-6 text-sm text-slate-500">Nenhum agendamento pendente.</p>
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

      <SendMessageModal open={sendOpen} onClose={() => setSendOpen(false)} />
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
