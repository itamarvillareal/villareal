import { Trash2 } from 'lucide-react';

/** Apaga conversa da inbox do sistema (não do WhatsApp do contato). */
export function WhatsAppConversationDeleteButton({ onDelete, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onDelete?.();
      }}
      className={`shrink-0 rounded p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${className}`}
      title="Apagar conversa da inbox (não apaga no WhatsApp do contato)"
      aria-label="Apagar conversa da inbox"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
