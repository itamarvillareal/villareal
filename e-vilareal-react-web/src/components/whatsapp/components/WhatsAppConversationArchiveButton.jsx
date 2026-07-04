import { Archive, ArchiveRestore } from 'lucide-react';

/** Arquivar ou desarquivar conversa (dentro do item da lista — stopPropagation no clique). */
export function WhatsAppConversationArchiveButton({ archivedView, onToggle, className = '' }) {
  const Icon = archivedView ? ArchiveRestore : Archive;
  const label = archivedView ? 'Desarquivar conversa' : 'Arquivar conversa';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle?.();
      }}
      className={`shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${className}`}
      title={label}
      aria-label={label}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
