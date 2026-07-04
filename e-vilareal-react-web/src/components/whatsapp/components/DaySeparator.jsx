import { formatDateSeparator } from '../../../utils/whatsappFormat.js';

/** Chip centralizado entre grupos de mensagens de dias diferentes (estilo WhatsApp). */
export function DaySeparator({ iso }) {
  const label = formatDateSeparator(iso);
  if (!label) return null;
  return (
    <div className="flex justify-center py-1" role="separator" aria-label={label}>
      <span className="rounded-full bg-white/90 dark:bg-slate-700/90 px-3 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm">
        {label}
      </span>
    </div>
  );
}
