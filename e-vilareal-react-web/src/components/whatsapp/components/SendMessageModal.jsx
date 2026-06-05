import { useState } from 'react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { Loader2, X } from 'lucide-react';
import { processosBtnPrimary, processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';
import { useWhatsApp } from '../hooks/useWhatsApp.js';
import { useWhatsAppToast } from '../WhatsAppToast.jsx';
import { isValidBrazilPhone, normalizePhoneForApi } from '../../../utils/whatsappFormat.js';

export function SendMessageModal({ open, onClose, defaultPhone = '' }) {
  const { sendText } = useWhatsApp();
  const toast = useWhatsAppToast();
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useCloseOnEscape(open, onClose, { enabled: !sending });

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalized = normalizePhoneForApi(phone);
    if (!isValidBrazilPhone(phone)) {
      toast.error('Informe um telefone brasileiro válido (DDD + número).');
      return;
    }
    const text = message.trim();
    if (!text) {
      toast.error('Digite a mensagem.');
      return;
    }
    setSending(true);
    try {
      const res = await sendText(normalized, text);
      if (res?.success === false) {
        toast.error(res.error || 'Falha ao enviar mensagem.');
        return;
      }
      toast.success('Mensagem enviada com sucesso.');
      setMessage('');
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Enviar mensagem</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Telefone</label>
            <input
              type="tel"
              className={processosInputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(62) 99999-1234"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mensagem</label>
            <textarea
              className={`${processosInputClass} min-h-[100px] resize-y`}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 4096))}
              maxLength={4096}
              placeholder="Digite sua mensagem…"
            />
            <p className="text-right text-xs text-slate-400 mt-1">{message.length}/4096</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button type="submit" disabled={sending} className={processosBtnPrimary}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
