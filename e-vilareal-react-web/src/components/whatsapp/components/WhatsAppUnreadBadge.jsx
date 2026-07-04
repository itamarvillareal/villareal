/** Badge circular verde de mensagens não lidas (leitura interna global). */
export function WhatsAppUnreadBadge({ count, className = '' }) {
  const n = Number(count ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  const label = n > 99 ? '99+' : String(n);
  return (
    <span
      className={`inline-flex min-w-[1.125rem] h-[1.125rem] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-white shrink-0 ${className}`}
      aria-label={`${n} não lida${n === 1 ? '' : 's'}`}
    >
      {label}
    </span>
  );
}

export function unreadCountOf(conv) {
  const n = Number(conv?.unreadCount ?? 0);
  return Number.isFinite(n) ? n : 0;
}
