import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { getCobrancaHistoricoProcesso } from '../../repositories/whatsappRepository.js';
import { formatDateTimeBR } from '../../utils/whatsappFormat.js';

function statusBadgeClass(status) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ENTREGUE' || s === 'LIDO') return 'bg-emerald-100 text-emerald-800';
  if (s === 'ENVIADO') return 'bg-blue-100 text-blue-800';
  if (s === 'AGENDADO') return 'bg-violet-100 text-violet-800';
  if (s === 'FALHOU') return 'bg-red-100 text-red-800';
  if (s === 'CANCELADO') return 'bg-slate-200 text-slate-600';
  return 'bg-slate-100 text-slate-700';
}

function labelStatus(status) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'AGENDADO') return 'Agendado';
  if (s === 'ENVIADO') return 'Enviado';
  if (s === 'ENTREGUE') return 'Entregue';
  if (s === 'LIDO') return 'Lido';
  if (s === 'FALHOU') return 'Falhou';
  if (s === 'CANCELADO') return 'Cancelado';
  if (s === 'PENDENTE') return 'Pendente';
  return s || '—';
}

/**
 * Histórico de cobranças WhatsApp (template cobranca_pagamento) vinculadas ao processo.
 * @param {{ processoApiId?: number|string|null, compact?: boolean }} props
 */
export function ProcessoWhatsAppContatosSecao({ processoApiId, compact = false }) {
  const procId = Number(processoApiId);
  const habilitado = Number.isFinite(procId) && procId > 0;

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!habilitado) return;
    setCarregando(true);
    setErro('');
    try {
      const rows = await getCobrancaHistoricoProcesso(procId);
      setItens(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setItens([]);
      setErro(e?.message || 'Não foi possível carregar o histórico de WhatsApp.');
    } finally {
      setCarregando(false);
    }
  }, [habilitado, procId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!habilitado) {
    return (
      <p className="text-sm text-slate-500 py-4 text-center">
        Salve o processo na API para consultar mensagens de cobrança.
      </p>
    );
  }

  if (carregando) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando histórico WhatsApp…
      </p>
    );
  }

  if (erro) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {erro}
        <button type="button" className="ml-3 underline" onClick={() => void carregar()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className={`text-center text-slate-500 ${compact ? 'py-4 text-xs' : 'py-10 text-sm'}`}>
        <MessageCircle className={`mx-auto mb-2 text-slate-300 ${compact ? 'h-5 w-5' : 'h-8 w-8'}`} />
        Nenhuma cobrança WhatsApp registrada para este processo.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left ${compact ? 'text-xs' : 'text-sm'}`}>
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="p-2">Quando</th>
            <th className="p-2">Status</th>
            <th className="p-2">Telefone</th>
            <th className="p-2">Lote / descrição</th>
            <th className="p-2">Por</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((h) => (
            <tr key={h.id} className="border-t border-slate-100">
              <td className="p-2 whitespace-nowrap tabular-nums">{formatDateTimeBR(h.quando ?? h.enviadoAt ?? h.scheduledAt ?? h.createdAt)}</td>
              <td className="p-2">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${statusBadgeClass(h.status)}`}>
                  {labelStatus(h.status)}
                </span>
                {h.errorMessage ? (
                  <p className="text-[10px] text-red-600 mt-0.5 max-w-xs truncate" title={h.errorMessage}>
                    {h.errorMessage}
                  </p>
                ) : null}
              </td>
              <td className="p-2 tabular-nums">{h.telefoneFormatado ?? '—'}</td>
              <td className="p-2 max-w-[220px] truncate" title={h.loteDescricao}>
                {h.loteDescricao || '—'}
              </td>
              <td className="p-2 text-slate-500">{h.createdBy || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function resumoUltimoContato(historicoContatos) {
  const list = Array.isArray(historicoContatos) ? historicoContatos : [];
  if (list.length === 0) return null;
  const ultimo = list[0];
  return {
    quando: ultimo.quando ?? ultimo.enviadoAt ?? ultimo.scheduledAt ?? ultimo.createdAt,
    status: ultimo.status,
    total: list.length,
  };
}

export { labelStatus as labelStatusContatoWhatsApp, statusBadgeClass as statusBadgeContatoWhatsApp };
