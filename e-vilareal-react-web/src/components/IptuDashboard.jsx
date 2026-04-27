import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { buscarDashboard } from '../repositories/iptuRepository.js';
import { featureFlags } from '../config/featureFlags.js';

const inputClass =
  'w-full rounded-lg border border-slate-300/90 dark:border-white/[0.12] bg-white/95 px-3 py-2 text-sm shadow-sm dark:bg-[#0f141c]/90';

function formatBrDecimal(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function diasAte(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  return Math.ceil((d - t) / 86400000);
}

export function IptuDashboard() {
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [status, setStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!featureFlags.useApiImoveis) {
      setErr('Ative a API de imóveis para o dashboard de IPTU.');
      return;
    }
    let ok = true;
    void (async () => {
      try {
        const data = await buscarDashboard({ ano, status: status || undefined });
        if (!ok) return;
        setRows(Array.isArray(data) ? data : []);
        setErr('');
      } catch (e) {
        if (!ok) return;
        setErr(e?.message || 'Erro ao carregar dashboard.');
      }
    })();
    return () => {
      ok = false;
    };
  }, [ano, status]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const t = `${r.titulo ?? ''} ${r.condominio ?? ''} ${r.unidade ?? ''} ${r.numeroPlanilha ?? ''}`.toLowerCase();
      return t.includes(q);
    });
  }, [rows, busca]);

  const cards = useMemo(() => {
    const comAnual = filtrados.filter((r) => r.valorAnual != null);
    const pago = filtrados.reduce((s, r) => s + (Number(r.totalPago) || 0), 0);
    const pend = filtrados.reduce((s, r) => s + (Number(r.totalPendente) || 0), 0);
    const atr = filtrados.reduce((s, r) => s + (Number(r.totalAtrasado) || 0), 0);
    return { n: comAnual.length, pago, pend, atr };
  }, [filtrados]);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-[#0b0e14] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">IPTU — visão consolidada</h1>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#121826]">
            <p className="text-slate-500">Imóveis com IPTU no ano</p>
            <p className="text-2xl font-semibold">{cards.n}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#121826]">
            <p className="text-slate-500">Total pago</p>
            <p className="text-2xl font-semibold">{formatBrDecimal(cards.pago)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#121826]">
            <p className="text-slate-500">Total pendente</p>
            <p className="text-2xl font-semibold">{formatBrDecimal(cards.pend)}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50/80 p-3 text-sm dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-red-800 dark:text-red-200">Total atrasado</p>
            <p className="text-2xl font-semibold text-red-900 dark:text-red-100">{formatBrDecimal(cards.atr)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#121826]">
          <div className="min-w-[8rem] flex-1">
            <label className="block text-xs text-slate-500">Ano</label>
            <input className={inputClass} type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="block text-xs text-slate-500">Status</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="ATRASADO">Atrasado</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>
          <div className="min-w-[12rem] flex-[2]">
            <label className="block text-xs text-slate-500">Busca (condomínio / unidade)</label>
            <input className={inputClass} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar na lista" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#121826]">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase text-slate-600 dark:bg-[#0f141c] dark:text-slate-400">
              <tr>
                <th className="p-2">Imóvel</th>
                <th className="p-2">Inquilino</th>
                <th className="p-2">Contrato</th>
                <th className="p-2">Valor anual</th>
                <th className="p-2">Pago</th>
                <th className="p-2">Pendente</th>
                <th className="p-2">Atrasado</th>
                <th className="p-2">Próxima</th>
                <th className="p-2">Última consulta</th>
                <th className="p-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const atrasado = (Number(r.totalAtrasado) || 0) > 0;
                const dProx = diasAte(r.proximaVencimento);
                const proximoVencer = dProx != null && dProx >= 0 && dProx <= 5 && !atrasado;
                const rowCls = atrasado ? 'bg-red-50 dark:bg-red-950/25' : proximoVencer ? 'bg-amber-50 dark:bg-amber-950/20' : '';
                return (
                  <tr key={`${r.imovelId}-${r.iptuAnualId}`} className={`border-t border-slate-100 dark:border-white/5 ${rowCls}`}>
                    <td className="p-2">
                      <div className="font-semibold">#{r.numeroPlanilha ?? r.imovelId}</div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {r.titulo || r.condominio || '—'} {r.unidade ? `· ${r.unidade}` : ''}
                      </div>
                    </td>
                    <td className="p-2">{r.inquilinoNome || '—'}</td>
                    <td className="p-2">
                      {r.contratoDataInicio || '—'} — {r.contratoDataFim || '—'}
                    </td>
                    <td className="p-2">{formatBrDecimal(r.valorAnual)}</td>
                    <td className="p-2">{formatBrDecimal(r.totalPago)}</td>
                    <td className="p-2">{formatBrDecimal(r.totalPendente)}</td>
                    <td className="p-2">{formatBrDecimal(r.totalAtrasado)}</td>
                    <td className="p-2">
                      {r.proximaCompetencia ? (
                        <span>
                          {r.proximaCompetencia} · {formatBrDecimal(r.proximaValor)}
                          <br />
                          <span className="text-slate-500">venc. {r.proximaVencimento || '—'}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {r.ultimaConsultaExisteDebito ? (
                          <XCircle className="h-4 w-4 text-red-600" aria-label="Débito" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Sem débito" />
                        )}
                        <span>{r.ultimaConsultaData || '—'}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Link className="text-cyan-700 underline dark:text-cyan-400" to={`/iptu/${r.imovelId}`}>
                        Abrir IPTU
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
