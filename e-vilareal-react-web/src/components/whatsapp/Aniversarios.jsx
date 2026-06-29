import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cake, Loader2, Send, AlertTriangle } from 'lucide-react';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import {
  enviarAniversarioManual,
  getAniversarioStats,
  getProximosAniversarios,
  getWhatsAppAniversarios,
} from '../../repositories/whatsappRepository.js';
import { formatPhoneDisplay } from '../../utils/whatsappFormat.js';
import { processosBtnPrimary, processosBtnSecondary, processosInputClass } from '../processos/ProcessosAdminLayout.jsx';

const REFRESH_MS = 60_000;
const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function statusBadge(status) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'DELIVERED' || s === 'READ') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (s === 'SENT') {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  }
  if (s === 'FAILED') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function formatarDiaMes(dia, mes) {
  return `${String(dia).padStart(2, '0')}/${MESES[mes] ?? mes}`;
}

function StatCard({ label, value, alert }) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        alert
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    </div>
  );
}

function ProximoCard({ item, onEnviar, sendingId }) {
  const hoje = item.diasParaAniversario === 0;
  const estaSemana = item.diasParaAniversario <= 7;
  const podeEnviar = item.temTelefone && !item.jaEnviouEsteAno;

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm ${
        hoje
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : estaSemana
            ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
            : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60 opacity-90'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {hoje ? <Cake className="w-4 h-4 text-emerald-600" aria-hidden /> : null}
            <h3 className="font-medium text-slate-900 dark:text-slate-100">{item.pessoaNome}</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {formatarDiaMes(item.diaAniversario, item.mesAniversario)}
            {hoje ? ' · Hoje 🎂' : item.diasParaAniversario === 1 ? ' · Amanhã' : ` · em ${item.diasParaAniversario} dias`}
          </p>
          {item.temTelefone ? (
            <p className="text-xs text-slate-500 mt-1">{formatPhoneDisplay(item.telefone)}</p>
          ) : (
            <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
              Sem telefone
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          {item.jaEnviouEsteAno ? (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Enviado ✅</span>
          ) : item.temTelefone ? (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Pendente</span>
          ) : (
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Sem telefone ⚠️</span>
          )}
        </div>
      </div>
      {podeEnviar ? (
        <button
          type="button"
          onClick={() => onEnviar(item.pessoaId)}
          disabled={sendingId === item.pessoaId}
          className={`${processosBtnPrimary} mt-3 w-full sm:w-auto text-sm`}
        >
          {sendingId === item.pessoaId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar agora
        </button>
      ) : null}
    </article>
  );
}

export function WhatsAppAniversarios() {
  const toast = useWhatsAppToast();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [stats, setStats] = useState(null);
  const [proximos, setProximos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [statsRes, proximosRes, histRes] = await Promise.all([
        getAniversarioStats(),
        getProximosAniversarios(30),
        getWhatsAppAniversarios(ano, page, 20),
      ]);
      setStats(statsRes ?? null);
      setProximos(Array.isArray(proximosRes) ? proximosRes : []);
      setHistorico(Array.isArray(histRes?.content) ? histRes.content : []);
      setTotalPages(Number(histRes?.totalPages ?? 0));
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar aniversários.');
    } finally {
      setLoading(false);
    }
  }, [ano, page, toast]);

  useEffect(() => {
    setLoading(true);
    loadAll();
    const interval = window.setInterval(loadAll, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadAll]);

  const grupos = useMemo(() => {
    const hoje = [];
    const semana = [];
    const mes = [];
    for (const item of proximos) {
      if (item.diasParaAniversario === 0) hoje.push(item);
      else if (item.diasParaAniversario <= 7) semana.push(item);
      else mes.push(item);
    }
    return { hoje, semana, mes };
  }, [proximos]);

  const handleEnviar = async (pessoaId) => {
    setSendingId(pessoaId);
    try {
      await enviarAniversarioManual(pessoaId);
      toast.success('Felicitação enviada!');
      await loadAll();
    } catch (err) {
      toast.error(err?.message || 'Falha ao enviar felicitação.');
    } finally {
      setSendingId(null);
    }
  };

  const anosDisponiveis = [anoAtual + 1, anoAtual, anoAtual - 1];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Cake className="w-5 h-5 text-emerald-600" aria-hidden />
          Aniversários
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Felicitações automáticas via WhatsApp todo dia às 8h (horário de Brasília).
        </p>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Carregando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Enviados este ano" value={stats?.enviadosEsteAno ?? 0} />
            <StatCard label="Enviados este mês" value={stats?.enviadosEsteMes ?? 0} />
            <StatCard label="Próximos 7 dias" value={stats?.proximosSeteDias ?? 0} />
            <StatCard label="Sem telefone" value={stats?.aniversariantesSemTelefone ?? 0} alert />
          </div>

          {stats?.aniversariantesSemTelefone > 0 ? (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
              <p>Há aniversariantes nos próximos 7 dias sem telefone cadastrado. Cadastre em Pessoas para enviar a felicitação.</p>
            </div>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Próximos aniversários (30 dias)</h3>
            {proximos.length === 0 ? (
              <p className="text-sm text-slate-500 border border-dashed rounded-xl p-6 text-center">
                Nenhum aniversário nos próximos 30 dias com data de nascimento cadastrada.
              </p>
            ) : (
              <div className="space-y-6">
                {grupos.hoje.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Hoje</h4>
                    <div className="grid gap-3 md:grid-cols-2">{grupos.hoje.map((item) => (
                      <ProximoCard key={item.pessoaId} item={item} onEnviar={handleEnviar} sendingId={sendingId} />
                    ))}</div>
                  </div>
                ) : null}
                {grupos.semana.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Esta semana</h4>
                    <div className="grid gap-3 md:grid-cols-2">{grupos.semana.map((item) => (
                      <ProximoCard key={item.pessoaId} item={item} onEnviar={handleEnviar} sendingId={sendingId} />
                    ))}</div>
                  </div>
                ) : null}
                {grupos.mes.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Restante do mês</h4>
                    <div className="grid gap-3 md:grid-cols-2">{grupos.mes.map((item) => (
                      <ProximoCard key={item.pessoaId} item={item} onEnviar={handleEnviar} sendingId={sendingId} />
                    ))}</div>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Histórico de envios</h3>
              <select
                className={`${processosInputClass} w-auto min-w-[7rem]`}
                value={ano}
                onChange={(e) => {
                  setAno(Number(e.target.value));
                  setPage(0);
                }}
              >
                {anosDisponiveis.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-left">
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Nome</th>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Telefone</th>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Aniversário</th>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Enviado em</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                        Nenhum envio registrado em {ano}.
                      </td>
                    </tr>
                  ) : (
                    historico.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">{row.pessoaNome}</td>
                        <td className="px-3 py-2">{formatPhoneDisplay(row.phoneNumber)}</td>
                        <td className="px-3 py-2">
                          {row.dataAniversario
                            ? new Date(row.dataAniversario).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusBadge(row.status)}`}>
                            {row.status ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={processosBtnSecondary}
                >
                  Anterior
                </button>
                <span className="text-sm text-slate-500 self-center">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={processosBtnSecondary}
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
