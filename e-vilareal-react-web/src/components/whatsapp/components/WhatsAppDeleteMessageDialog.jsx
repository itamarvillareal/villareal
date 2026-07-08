import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { WHATSAPP_DELETE_MESSAGE_CHOICE } from '../utils/whatsappDeleteCopy.js';
import { podeApagarMensagemParaTodos } from '../utils/whatsappRevokeEligibility.js';

export function WhatsAppDeleteMessageDialog({
  open,
  message,
  onDeleteInbox,
  onDeleteForEveryone,
  onCancel,
}) {
  useCloseOnEscape(open, onCancel);
  if (!open || !message) return null;

  const podeParaTodos = podeApagarMensagemParaTodos(message);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-delete-message-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
        <h3
          id="whatsapp-delete-message-title"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          {WHATSAPP_DELETE_MESSAGE_CHOICE.title}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {WHATSAPP_DELETE_MESSAGE_CHOICE.message}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {WHATSAPP_DELETE_MESSAGE_CHOICE.cancelLabel}
          </button>
          <button
            type="button"
            onClick={onDeleteInbox}
            className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            {WHATSAPP_DELETE_MESSAGE_CHOICE.inboxLabel}
          </button>
          <button
            type="button"
            onClick={onDeleteForEveryone}
            disabled={!podeParaTodos}
            title={
              podeParaTodos
                ? WHATSAPP_DELETE_MESSAGE_CHOICE.everyoneHint
                : WHATSAPP_DELETE_MESSAGE_CHOICE.everyoneDisabledHint
            }
            className="px-3 py-1.5 text-sm rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
          >
            {WHATSAPP_DELETE_MESSAGE_CHOICE.everyoneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
