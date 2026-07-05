import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react';
import { ConfirmDialog } from '../financeiro/shared/ConfirmDialog.jsx';
import { ScheduleModal } from './components/ScheduleModal.jsx';
import { ScheduleCard } from './components/ScheduleCard.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppTemplates } from './hooks/useWhatsAppTemplates.js';
import { cancelWhatsAppScheduledItem, scheduledItemKey } from '../../repositories/whatsappRepository.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { agruparPorData } from '../../utils/whatsappScheduleUtils.js';
import { processosBtnPrimary, processosBtnSecondary } from '../processos/ProcessosAdminLayout.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'SENT', label: 'Enviados' },
  { value: 'FAILED', label: 'Falhos' },
  { value: 'CANCELLED', label: 'Cancelados' },
];

const PAGE_SIZE = 50;
const REFRESH_MS = 60_000;

function ScheduleDateHeader({ label, count, collapsed, onToggle, collapsible }) {
  return (
    <div className="flex items-center gap-2 py-3 border-b border-slate-200 dark:border-slate-700 mb-4">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left group"
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          )}
          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
          <span className="text-xs text-slate-500 font-normal">
            {count} agendamento{count !== 1 ? 's' : ''}
          </span>
        </button>
      ) : (
        <>
          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex-1">{label}</span>
          <span className="text-xs text-slate-500">
            {count} agendamento{count !== 1 ? 's' : ''}
          </span>
        </>
      )}
    </div>
  );
}

export function WhatsAppAgendamentos() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getScheduled } = useWhatsApp();
  const { templates } = useWhatsAppTemplates();
  const toast = useWhatsAppToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialPhone, setModalInitialPhone] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [anterioresAbertos, setAnterioresAbertos] = useState(false);

  useEffect(() => {
    const st = location.state;
    if (!st?.openSchedule || !st?.phone) return;
    setModalInitialPhone(String(st.phone).trim());
    setModalOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const abrirModalNovo = () => {
    setModalInitialPhone('');
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setModalInitialPhone('');
  };

  const fetchPage = useCallback(
    async (pageNum, append = false, signal) => {
      const res = await getScheduled(status || null, pageNum, PAGE_SIZE, signal);
      const chunk = Array.isArray(res?.content) ? res.content : [];
      setTotalPages(Number(res?.totalPages ?? 0));
      setTotalElements(Number(res?.totalElements ?? 0));
      setRows((prev) => (append ? [...prev, ...chunk] : chunk));
      setPage(pageNum);
    },
    [getScheduled, status],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPage(0, false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar agendamentos.');
    } finally {
      setLoading(false);
    }
  }, [fetchPage, toast]);

  useEffect(() => {
    setAnterioresAbertos(false);
    loadInitial();
  }, [status, loadInitial]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchPage(0, false).catch(() => {});
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [fetchPage]);

  const grupos = useMemo(
    () => agruparPorData(rows, { useSentAt: status === 'SENT' }),
    [rows, status],
  );

  const hasMore = page + 1 < totalPages;

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, true);
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar mais.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelWhatsAppScheduledItem(cancelTarget);
      toast.success('Agendamento cancelado.');
      const key = scheduledItemKey(cancelTarget);
      setRows((prev) =>
        prev.map((r) => (scheduledItemKey(r) === key ? { ...r, status: 'CANCELLED' } : r)),
      );
      setCancelTarget(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao cancelar.');
    } finally {
      setCancelling(false);
    }
  };

  const handleModalSuccess = () => {
    loadInitial();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="wa-sched-status" className="text-sm text-slate-600 dark:text-slate-400">
            Status
          </label>
          <select
            id="wa-sched-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={processosBtnPrimary} onClick={abrirModalNovo}>
          <Plus className="w-4 h-4" />
          Novo agendamento
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-16 text-center text-sm text-slate-500">
          Nenhum agendamento encontrado.
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => {
            const isAnteriores = grupo.groupKey === 'Anteriores';
            const collapsed = isAnteriores && !anterioresAbertos;

            return (
              <section key={grupo.groupKey}>
                <ScheduleDateHeader
                  label={grupo.label}
                  count={grupo.items.length}
                  collapsed={collapsed}
                  collapsible={isAnteriores}
                  onToggle={() => setAnterioresAbertos((v) => !v)}
                />
                {!collapsed ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {grupo.items.map((item) => (
                      <ScheduleCard
                        key={scheduledItemKey(item)}
                        item={item}
                        templates={templates}
                        onCancel={setCancelTarget}
                        cancelling={cancelling && cancelTarget && scheduledItemKey(cancelTarget) === scheduledItemKey(item)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {hasMore && !loading ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className={processosBtnSecondary}
            disabled={loadingMore}
            onClick={handleLoadMore}
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Carregar mais
            {totalElements > 0 ? ` (${rows.length} de ${totalElements})` : ''}
          </button>
        </div>
      ) : null}

      <ScheduleModal
        open={modalOpen}
        initialPhone={modalInitialPhone}
        onClose={fecharModal}
        onSuccess={handleModalSuccess}
      />
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
