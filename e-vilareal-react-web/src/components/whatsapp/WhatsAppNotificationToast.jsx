import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useWhatsAppNotificationContext } from './WhatsAppNotificationProvider.jsx';
import { formatPhoneDisplay } from '../../utils/whatsappFormat.js';
import { resumoWhatsAppMessageContent } from './utils/whatsappMessagePreview.js';

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5000;

function NotificationToast({ item, onDismiss, onOpen }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.messageId), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [item.messageId, onDismiss]);

  const title = item.contactName || item.phoneNumberFormatted || formatPhoneDisplay(item.phoneNumber);
  const preview = resumoWhatsAppMessageContent(item.messageType, item.content);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full max-w-sm rounded-xl border border-emerald-200 bg-white p-3 text-left shadow-lg ring-1 ring-black/5 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      <div className="flex items-start gap-2">
        <span className="text-lg shrink-0" aria-hidden>💬</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">{preview}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(item.messageId);
          }}
          className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </button>
  );
}

export function WhatsAppNotificationToast() {
  const ctx = useWhatsAppNotificationContext();
  const navigate = useNavigate();
  const [visibleIds, setVisibleIds] = useState([]);

  useEffect(() => {
    if (!ctx?.notifications?.length) return;
    const latest = ctx.notifications[0];
    if (!latest?.messageId) return;
    setVisibleIds((prev) => {
      if (prev.includes(latest.messageId)) return prev;
      return [latest.messageId, ...prev].slice(0, MAX_VISIBLE);
    });
  }, [ctx?.notifications]);

  if (!ctx) return null;

  const visible = visibleIds
    .map((id) => ctx.notifications.find((n) => n.messageId === id))
    .filter(Boolean);

  const handleDismiss = (messageId) => {
    ctx.dismissNotification(messageId);
    setVisibleIds((prev) => prev.filter((id) => id !== messageId));
  };

  const handleOpen = (item) => {
    handleDismiss(item.messageId);
    const phone = item.phoneNumber ?? '';
    navigate(`/whatsapp/conversas?telefone=${encodeURIComponent(phone)}`);
  };

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {visible.map((item) => (
        <div key={item.messageId} className="pointer-events-auto">
          <NotificationToast item={item} onDismiss={handleDismiss} onOpen={handleOpen} />
        </div>
      ))}
    </div>
  );
}
