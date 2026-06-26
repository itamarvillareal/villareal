import { Clock, Loader2 } from 'lucide-react';
import { podeCancelarAgendamentoProtocolo } from '../../api/peticoesProjudiApi.js';

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

/**
 * @param {{
 *   peticoes: import('../../api/peticoesProjudiApi.js').ProjudiPeticao[],
 *   onReabrir?: (peticaoId: number) => void,
 *   onCancelarAgendamento?: (peticaoId: number) => void,
 *   operacao?: string | null,
 * }} props
 */
export function PeticaoHistoricoLista({ peticoes, onReabrir, onCancelarAgendamento, operacao = null }) {
  if (!peticoes.length) {
    return <p className="text-sm text-slate-500">Nenhum registro no histórico.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden">
      {peticoes.map((p) => (
        <li key={p.id} className="px-3 py-2.5 text-sm space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-slate-900">
              #{p.id}
              {p.complemento ? ` · ${p.complemento}` : ''}
            </span>
            <span className="text-xs text-slate-500">{formatDateTime(p.protocoladoEm || p.criadoEm)}</span>
          </div>
          <div className="font-mono text-xs text-slate-600 truncate">{p.numeroProcesso}</div>
          {(p.arquivos || []).map((a) => (
            <div key={a.id ?? a.ordem} className="text-xs text-slate-600 truncate pl-2 border-l-2 border-slate-200">
              {a.nomeOriginal || '—'}
            </div>
          ))}
          {p.protocoloMensagem ? (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1 line-clamp-3">
              {p.protocoloMensagem}
            </p>
          ) : null}
          {podeCancelarAgendamentoProtocolo(p) ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-violet-800">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span>Protocolo agendado: {formatDateTime(p.protocoloAgendadoPara)}</span>
              {onCancelarAgendamento ? (
                <button
                  type="button"
                  className="text-rose-700 hover:underline disabled:opacity-50"
                  disabled={operacao === `cancelar-ag-${p.id}`}
                  onClick={() => onCancelarAgendamento(p.id)}
                >
                  Cancelar agendamento
                </button>
              ) : null}
            </div>
          ) : null}
          {p.status === 'ERRO' && onReabrir ? (
            <button
              type="button"
              className="text-xs rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              disabled={operacao === `reabrir-${p.id}`}
              onClick={() => onReabrir(p.id)}
            >
              {operacao === `reabrir-${p.id}` ? (
                <Loader2 className="w-3 h-3 animate-spin inline" aria-hidden />
              ) : null}
              Reabrir p/ protocolar
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
