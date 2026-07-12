import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';

const TIPOS = {
  LIGACAO: {
    titulo: 'Registrar ligação',
    descricao: 'O que ficou combinado com o inquilino? (opcional)',
    observacaoObrigatoria: false,
    mostrarAdiar: false,
  },
  ANOTACAO: {
    titulo: 'Anotação no caso',
    descricao: 'Registre uma observação interna sobre este atraso.',
    observacaoObrigatoria: true,
    mostrarAdiar: false,
  },
  ADIAR: {
    titulo: 'Adiar caso',
    descricao: 'Por quantos dias silenciar este caso? Ele volta automaticamente depois.',
    observacaoObrigatoria: false,
    mostrarAdiar: true,
  },
  RESOLVIDO_MANUAL: {
    titulo: 'Marcar como resolvido',
    descricao: 'Por que este caso sai da lista? Ex.: acordo fechado, pagamento em espécie…',
    observacaoObrigatoria: true,
    mostrarAdiar: false,
  },
};

/**
 * Modal estruturado para eventos de follow-up de aluguel.
 * @param {{
 *   open: boolean,
 *   tipo: 'LIGACAO'|'ANOTACAO'|'ADIAR'|'RESOLVIDO_MANUAL',
 *   item: object | null,
 *   salvando?: boolean,
 *   onClose: () => void,
 *   onConfirm: (payload: { observacao?: string, diasAdiar?: number }) => void | Promise<void>,
 * }} props
 */
export function ModalFollowupAluguelEvento({ open, tipo, item, salvando = false, onClose, onConfirm }) {
  const info = TIPOS[tipo] || TIPOS.ANOTACAO;
  const [observacao, setObservacao] = useState('');
  const [diasAdiar, setDiasAdiar] = useState('3');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    setObservacao('');
    setDiasAdiar('3');
    setErro('');
  }, [open, tipo, item?.contratoId, item?.competencia]);

  useCloseOnEscape(open, onClose, { enabled: !salvando });

  if (!open) return null;

  async function confirmar() {
    setErro('');
    const obs = observacao.trim();
    if (info.observacaoObrigatoria && !obs) {
      setErro('Informe uma observação.');
      return;
    }
    if (tipo === 'ADIAR') {
      const dias = Number(diasAdiar);
      if (!Number.isFinite(dias) || dias < 1 || dias > 90) {
        setErro('Informe entre 1 e 90 dias.');
        return;
      }
      await onConfirm({ observacao: obs || undefined, diasAdiar: dias });
      return;
    }
    await onConfirm({ observacao: obs || undefined });
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{info.titulo}</h3>
            {item ? (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {item.inquilinoNome || 'Inquilino'} · {item.competencia}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">{info.descricao}</p>
          {info.mostrarAdiar ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Adiar por (dias)
              <input
                type="number"
                min={1}
                max={90}
                value={diasAdiar}
                onChange={(e) => setDiasAdiar(e.target.value)}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Observação{info.observacaoObrigatoria ? ' *' : ' (opcional)'}
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-y"
              placeholder={tipo === 'LIGACAO' ? 'Ex.: combinou pagar até sexta…' : undefined}
            />
          </label>
          {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
