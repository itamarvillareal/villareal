import { Pin } from 'lucide-react';

/**
 * Alterna fixação da conversa. Para dentro do item da lista — use stopPropagation no clique.
 */
export function WhatsAppConversationPinButton({ pinned, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle?.();
      }}
      className={`shrink-0 rounded p-0.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors ${
        pinned ? 'text-amber-600 opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
      } ${className}`}
      title={pinned ? 'Desfixar conversa' : 'Fixar conversa no topo'}
      aria-label={pinned ? 'Desfixar conversa' : 'Fixar conversa no topo'}
      aria-pressed={Boolean(pinned)}
    >
      <Pin className={`w-3.5 h-3.5 ${pinned ? 'fill-current' : ''}`} />
    </button>
  );
}
