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

const MEDIA_TYPES = ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'];

function MediaBubbleContent({ message, isOutbound }) {
  const type = String(message.messageType ?? '').toUpperCase();
  const driveUrl = message.mediaDriveUrl;
  const linkClass = isOutbound
    ? 'text-white underline underline-offset-2 hover:text-white/90'
    : 'text-emerald-700 dark:text-emerald-300 underline underline-offset-2 hover:opacity-90';

  if (type === 'IMAGE' && driveUrl) {
    return (
      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={`chat-media-link ${linkClass}`}>
        📷 Ver imagem no Drive
      </a>
    );
  }
  if (type === 'DOCUMENT') {
    if (driveUrl) {
      return (
        <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={`chat-media-link ${linkClass}`}>
          📎 {message.mediaFilename || 'Documento'}
        </a>
      );
    }
  }
  if (type === 'AUDIO' && driveUrl) {
    return (
      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={`chat-media-link ${linkClass}`}>
        🎤 Ouvir áudio no Drive
      </a>
    );
  }
  if (type === 'VIDEO' && driveUrl) {
    return (
      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={`chat-media-link ${linkClass}`}>
        🎬 Ver vídeo no Drive
      </a>
    );
  }
  if (MEDIA_TYPES.includes(type) && !driveUrl) {
    return (
      <div className="chat-media chat-media-pending">
        <span>{message.content || 'Mídia recebida'}</span>
        <span className="block text-xs opacity-75 mt-1">⏳ Salvando no Drive…</span>
        <span className="block text-[10px] opacity-60 mt-0.5">O link aparecerá aqui em instantes</span>
      </div>
    );
  }
  if (Boolean(message.mediaId) && !driveUrl) {
    return (
      <div className="chat-media chat-media-pending">
        <span>{message.content || 'Mídia recebida'}</span>
        <span className="block text-xs opacity-75 mt-1">⏳ Salvando no Drive…</span>
      </div>
    );
  }
  return null;
}

export function ChatBubble({ message }) {
  const isOutbound = String(message.direction ?? '').toUpperCase() === 'OUTBOUND';
  const hasTemplate = Boolean(message.templateName);
  const type = String(message.messageType ?? '').toUpperCase();
  const isMedia = MEDIA_TYPES.includes(type) || Boolean(message.mediaId);
  const mediaContent = isMedia ? <MediaBubbleContent message={message} isOutbound={isOutbound} /> : null;

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
          isOutbound
            ? 'bg-[#25D366] text-white rounded-br-md'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md'
        } ${isMedia ? 'bg-opacity-95' : ''}`}
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
        {mediaContent ?? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content || '—'}</p>
        )}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-white/80' : 'text-slate-500'}`}>
          <span className="text-[11px]">{formatTimeBR(message.createdAt)}</span>
          {isOutbound ? <MessageStatusIcon status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}
