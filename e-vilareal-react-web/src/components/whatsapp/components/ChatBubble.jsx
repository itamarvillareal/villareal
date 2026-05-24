import { formatTimeBR } from '../../../utils/whatsappFormat.js';

function MessageStatusIcon({ status }) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'FAILED') {
    return <span className="text-red-500 text-xs" title="Falhou">✗</span>;
  }
  if (s === 'READ') {
    return <span className="text-sky-500 text-xs" title="Lida">✓✓</span>;
  }
  if (s === 'DELIVERED') {
    return <span className="text-slate-400 text-xs" title="Entregue">✓✓</span>;
  }
  if (s === 'SENT' || s === 'PENDING') {
    return <span className="text-slate-400 text-xs" title="Enviada">✓</span>;
  }
  return null;
}

export function ChatBubble({ message }) {
  const isOutbound = String(message.direction ?? '').toUpperCase() === 'OUTBOUND';
  const hasTemplate = Boolean(message.templateName);

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
          isOutbound
            ? 'bg-[#25D366] text-white rounded-br-md'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md'
        }`}
      >
        {hasTemplate ? (
          <span
            className={`inline-block mb-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              isOutbound ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
            }`}
          >
            Template: {message.templateName}
          </span>
        ) : null}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content || '—'}</p>
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-white/80' : 'text-slate-500'}`}>
          <span className="text-[11px]">{formatTimeBR(message.createdAt)}</span>
          {isOutbound ? <MessageStatusIcon status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}
