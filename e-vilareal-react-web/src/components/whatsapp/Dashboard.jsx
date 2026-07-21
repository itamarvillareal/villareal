import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, Clock, Loader2 } from 'lucide-react';
import { StatsCard } from './components/StatsCard.jsx';
import { ScheduleCard } from './components/ScheduleCard.jsx';
import { WhatsAppStatusBanner } from './components/WhatsAppStatusBanner.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppIntegrationStatus } from './hooks/useWhatsAppIntegrationStatus.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { ConfirmDialog } from '../financeiro/shared/ConfirmDialog.jsx';
import { cancelWhatsAppScheduledItem, scheduledItemKey } from '../../repositories/whatsappRepository.js';
import { mensagemErroAmigavel } from '../../utils/mensagemErroAmigavel.js';

export function WhatsAppDashboard() {
  const { getScheduled } = useWhatsApp();
  const integrationStatus = useWhatsAppIntegrationStatus();
  const toast = useWhatsAppToast();
  const stats = integrationStatus.stats;
  const [pending, setPending] = useState([]);
  const [loadingSched, setLoadingSched] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadScheduled = useCallback(async (signal) => {
    try {
      const schedRes = await getScheduled('PENDING', 0, 5, signal);
      setPending(Array.isArray(schedRes?.content) ? schedRes.content : []);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.error(mensagemErroAmigavel(err, 'carregar os agendamentos do WhatsApp'));
      }
    } finally {
      setLoadingSched(false);
    }
  }, [getScheduled, toast]);

  useEffect(() => {
    const ac = new AbortController();
    loadScheduled(ac.signal);
    const interval = window.setInterval(() => loadScheduled(undefined), 30_000);
    return () => {
      ac.abort();
      window.clearInterval(interval);
    };
  }, [loadScheduled]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelWhatsAppScheduledItem(cancelTarget);
      toast.success('Agendamento cancelado.');
      const key = scheduledItemKey(cancelTarget);
      setPending((prev) => prev.filter((r) => scheduledItemKey(r) !== key));
      setCancelTarget(null);
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
        configured={integrationStatus.configured}
        loadOk={integrationStatus.loadOk}
        fetchedAt={integrationStatus.fetchedAt}
        loading={integrationStatus.loading}
      />

      {integrationStatus.loadOk && integrationStatus.configured && todosZerados ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
          Nenhuma mensagem registrada hoje — a integração está ativa e funcionando normalmente.
        </p>
      ) : null}

      {integrationStatus.loading && !stats ? (
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
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {loadingSched ? 'Carregando agendamentos…' : 'Nenhum agendamento pendente no momento.'}
            </p>
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
                key={scheduledItemKey(row)}
                item={row}
                compact
                onCancel={setCancelTarget}
                cancelling={cancelling && cancelTarget && scheduledItemKey(cancelTarget) === scheduledItemKey(row)}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancelar agendamento"
        message="Tem certeza que deseja cancelar este agendamento?"
        confirmLabel={cancelling ? 'Cancelando…' : 'Sim, cancelar'}
        danger
        onConfirm={handleCancel}
        onCancel={() => !cancelling && setCancelTarget(null)}
      />
    </div>
  );
}
