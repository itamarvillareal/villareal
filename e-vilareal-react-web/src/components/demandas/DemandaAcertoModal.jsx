import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { formatBRL } from '../../data/relatorioCalculosData.js';
import { fetchAcertoImovel } from '../../repositories/demandasRepository.js';
import { badgeStatus, labelStatus } from './demandasConstants.js';

export function DemandaAcertoModal({ imovelId, open, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !imovelId) return;
    setLoading(true);
    fetchAcertoImovel(imovelId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, imovelId]);

  if (!open) return null;

  const saldo = Number(data?.saldoPendente ?? 0);
  const saldoOk = saldo <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-[#141c2c] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Acerto do imóvel</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
        ) : data ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600">{data.imovelTitulo} — {data.clienteNome}</p>
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-800 text-white p-4 text-center text-sm">
              <div>
                <p className="text-slate-400 text-xs">Despesas escritório</p>
                <p className="font-bold text-lg">{formatBRL(Number(data.totalDespesasEscritorio ?? 0))}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Reembolsos recebidos</p>
                <p className="font-bold text-lg">{formatBRL(Number(data.totalReembolsado ?? 0))}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Saldo pendente</p>
                <p className={`font-bold text-lg ${saldoOk ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatBRL(saldo)}
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {(data.demandas ?? []).map((d) => {
                const reemb = d.pagamentoStatus === 'ACERTADO';
                return (
                  <li
                    key={d.id}
                    className={`rounded-lg border p-3 text-sm ${reemb ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10' : 'bg-white dark:bg-white/5'}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{d.descricao}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badgeStatus(d.status)}`}>
                        {labelStatus(d.status)}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      {formatBRL(Number(d.valorEstimado ?? 0))}
                      {d.pagoPeloEscritorio ? ' · Pago escritório' : ''}
                      {d.reembolsavelCliente ? (
                        reemb ? ' · Reembolsado' : ` · Pendente: ${formatBRL(Number(d.valorEstimado ?? 0))}`
                      ) : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
