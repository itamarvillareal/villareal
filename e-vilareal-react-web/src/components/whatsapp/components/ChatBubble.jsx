import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileText, Loader2, Trash2, UserRound } from 'lucide-react';
import { formatTimeBR, formatPhoneDisplay, formatDateTimeBR } from '../../../utils/whatsappFormat.js';
import { reprocessarWhatsAppMedia } from '../../../repositories/whatsappRepository.js';
import { useWhatsAppMediaUrl } from '../hooks/useWhatsAppMediaUrl.js';
import { normalizarMediaStatus, resolverMediaProxyUrl } from '../utils/whatsappMediaUtils.js';
import {
  baixarWhatsAppMediaViaProxy,
  navegadorReproduzAudioInline,
  resolverNomeArquivoMidia,
} from '../utils/whatsappMediaDownload.js';
import {
  parseContactCardContent,
  resumoContactCardContent,
  telefoneCartaoParaApi,
  tituloContatoCartao,
} from '../utils/whatsappContactCard.js';
import { mapsUrl, parseLocationContent } from '../utils/whatsappLocation.js';
import { labelReactionThread } from '../utils/whatsappReaction.js';
import { parseInteractiveReplyContent } from '../utils/whatsappInteractiveReply.js';
import { highlightText } from '../../../utils/highlightText.jsx';

function BubbleText({ text, highlightTerm, active }) {
  const rendered = highlightText(text, highlightTerm, { active });
  if (typeof rendered === 'string') return rendered;
  return rendered;
}

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

function isStickerMessage(message) {
  const fn = String(message?.mediaFilename ?? '').toLowerCase();
  return fn.startsWith('sticker.');
}

function DriveLinkTertiary({ driveUrl, linkClass, label = 'Abrir no Drive' }) {
  if (!driveUrl) return null;
  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`chat-media-drive-link text-[11px] opacity-80 hover:opacity-100 ${linkClass}`}
    >
      {label}
    </a>
  );
}

function MediaAccessBar({
  message,
  mediaProxyUrl,
  linkClass,
  downloadLabel = 'Baixar',
  downloading,
  downloadError,
  onDownload,
  driveUrl,
}) {
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading || !mediaProxyUrl}
          className={`text-[11px] font-semibold underline underline-offset-2 disabled:opacity-50 ${linkClass}`}
        >
          {downloading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Baixando…
            </span>
          ) : (
            downloadLabel
          )}
        </button>
        <DriveLinkTertiary driveUrl={driveUrl} linkClass={linkClass} />
      </div>
      {downloadError ? (
        <p className="text-[10px] opacity-70">{downloadError}</p>
      ) : null}
    </div>
  );
}

function MediaPendingContent({ message, highlightTerm, activeHighlight }) {
  return (
    <div className="chat-media chat-media-pending">
      <span>
        <BubbleText text={message.content || 'Mídia recebida'} highlightTerm={highlightTerm} active={activeHighlight} />
      </span>
      <span className="block text-xs opacity-75 mt-1 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
        Salvando no Drive…
      </span>
      <span className="block text-[10px] opacity-60 mt-0.5">A mídia aparecerá aqui em instantes</span>
    </div>
  );
}

function OutboundMediaSendFailedContent({ message, linkClass, onRetry, retrying, highlightTerm, activeHighlight }) {
  return (
    <div className="chat-media chat-media-send-failed space-y-1.5">
      <span>
        <BubbleText text={message.content || 'Mídia'} highlightTerm={highlightTerm} active={activeHighlight} />
      </span>
      <p className="text-xs flex items-start gap-1.5 opacity-90 mt-1">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" aria-hidden />
        {message.sendError || 'Não foi possível enviar esta mídia.'}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={`text-[11px] font-semibold underline underline-offset-2 disabled:opacity-50 ${linkClass}`}
        >
          {retrying ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Reenviando…
            </span>
          ) : (
            'Reenviar'
          )}
        </button>
      ) : null}
    </div>
  );
}

function MediaLocalDocumentPreview({ message, filename }) {
  return (
    <div className="chat-media chat-media-document space-y-1">
      <div className="flex items-start gap-2">
        <FileText className="h-5 w-5 shrink-0 opacity-80 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words">{filename}</p>
          <span className="block text-xs opacity-75 mt-1 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
            Enviando…
          </span>
        </div>
      </div>
    </div>
  );
}

function MediaFailedContent({
  message,
  driveUrl,
  linkClass,
  mediaError,
  onRetry,
  retrying,
  retryError,
  highlightTerm,
  activeHighlight,
}) {
  return (
    <div
      className="chat-media chat-media-failed space-y-1.5"
      title={mediaError ? String(mediaError) : undefined}
    >
      <span>
        <BubbleText text={message.content || 'Mídia recebida'} highlightTerm={highlightTerm} active={activeHighlight} />
      </span>
      <p className="text-xs flex items-start gap-1.5 opacity-90 mt-1">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
        Não foi possível baixar esta mídia.
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={`text-[11px] font-semibold underline underline-offset-2 disabled:opacity-50 ${linkClass}`}
        >
          {retrying ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Tentando…
            </span>
          ) : (
            'Tentar novamente'
          )}
        </button>
        <DriveLinkTertiary driveUrl={driveUrl} linkClass={linkClass} />
      </div>
      {retryError ? (
        <p className="text-[10px] opacity-70">{retryError}</p>
      ) : null}
    </div>
  );
}

function MediaLoadingContent({ message, highlightTerm, activeHighlight }) {
  return (
    <div className="chat-media chat-media-loading">
      <span>
        <BubbleText text={message.content || 'Mídia recebida'} highlightTerm={highlightTerm} active={activeHighlight} />
      </span>
      <span className="block text-xs opacity-75 mt-1 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
        Carregando mídia…
      </span>
    </div>
  );
}

function InlineErrorHint({ text }) {
  if (!text) return null;
  return <p className="text-[11px] opacity-70 mt-1">{text}</p>;
}

function renderMediaCaption(message, highlightTerm, activeHighlight) {
  const caption = String(message.content ?? '').trim();
  if (!caption) return null;
  return (
    <p className="text-sm whitespace-pre-wrap break-words mt-1.5">
      <BubbleText text={caption} highlightTerm={highlightTerm} active={activeHighlight} />
    </p>
  );
}

function MediaBubbleContent({
  message,
  isOutbound,
  onRetryOutboundMedia,
  onLocalPreviewConsumed,
  highlightTerm,
  activeHighlight,
}) {
  const type = String(message.messageType ?? '').toUpperCase();
  const driveUrl = message.mediaDriveUrl;
  const mediaProxyUrl = resolverMediaProxyUrl(message);
  const localPreviewUrl = message.localPreviewUrl;
  const linkClass = isOutbound
    ? 'text-white underline underline-offset-2 hover:text-white/90'
    : 'text-emerald-700 dark:text-emerald-300 underline underline-offset-2 hover:opacity-90';

  const [tagError, setTagError] = useState(false);
  const [audioPlayError, setAudioPlayError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [localMediaStatus, setLocalMediaStatus] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [retryingSend, setRetryingSend] = useState(false);

  const effectiveMediaStatus = localMediaStatus ?? normalizarMediaStatus(message);

  useEffect(() => {
    const st = normalizarMediaStatus(message);
    if (st === 'DONE' || (st === 'FAILED' && localMediaStatus !== 'PENDING')) {
      setLocalMediaStatus(null);
    }
  }, [message.mediaStatus, message.mediaDriveUrl, localMediaStatus]);

  const { url: proxyUrl, loading, error } = useWhatsAppMediaUrl(message);

  useEffect(() => {
    if (!proxyUrl || !localPreviewUrl || !onLocalPreviewConsumed) return;
    if (!mediaProxyUrl) return;
    onLocalPreviewConsumed(message.id);
  }, [proxyUrl, localPreviewUrl, mediaProxyUrl, message.id, onLocalPreviewConsumed]);

  const displayUrl = mediaProxyUrl && proxyUrl ? proxyUrl : localPreviewUrl || null;

  const filename = useMemo(() => resolverNomeArquivoMidia(message), [message]);
  const sticker = type === 'IMAGE' && isStickerMessage(message);
  const audioMime = message.mediaMimeType || 'audio/ogg; codecs=opus';
  const audioInlineBlocked = useMemo(() => {
    if (type !== 'AUDIO') return false;
    return !navegadorReproduzAudioInline(audioMime);
  }, [type, audioMime]);

  const handleDownload = useCallback(async () => {
    if (!mediaProxyUrl) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await baixarWhatsAppMediaViaProxy(message, mediaProxyUrl);
    } catch (err) {
      setDownloadError(err?.message || 'Falha ao baixar o arquivo.');
    } finally {
      setDownloading(false);
    }
  }, [message, mediaProxyUrl]);

  const handleRetry = useCallback(async () => {
    const id = message?.id;
    if (id == null || id === '' || retrying) return;
    setRetrying(true);
    setRetryError('');
    try {
      await reprocessarWhatsAppMedia(id);
      setLocalMediaStatus('PENDING');
    } catch (err) {
      setRetryError(err?.message || 'Não foi possível iniciar o reprocessamento.');
    } finally {
      setRetrying(false);
    }
  }, [message?.id, retrying]);

  const handleRetrySend = useCallback(async () => {
    if (!onRetryOutboundMedia || retryingSend) return;
    setRetryingSend(true);
    try {
      await onRetryOutboundMedia(message);
    } finally {
      setRetryingSend(false);
    }
  }, [message, onRetryOutboundMedia, retryingSend]);

  const accessBar = (
    <MediaAccessBar
      message={message}
      mediaProxyUrl={mediaProxyUrl}
      linkClass={linkClass}
      downloading={downloading}
      downloadError={downloadError}
      onDownload={() => void handleDownload()}
      driveUrl={driveUrl}
      downloadLabel={
        type === 'AUDIO' ? 'Baixar áudio' : type === 'DOCUMENT' ? 'Baixar' : 'Baixar'
      }
    />
  );

  if (message.sendFailed) {
    return (
      <OutboundMediaSendFailedContent
        message={message}
        linkClass={linkClass}
        onRetry={onRetryOutboundMedia ? () => void handleRetrySend() : null}
        retrying={retryingSend}
        highlightTerm={highlightTerm}
        activeHighlight={activeHighlight}
      />
    );
  }

  if (localPreviewUrl && !mediaProxyUrl) {
    if (type === 'DOCUMENT') {
      return <MediaLocalDocumentPreview message={message} filename={filename} />;
    }
    if (type === 'IMAGE') {
      return (
        <div className="chat-media chat-media-image space-y-1">
          <img
            src={localPreviewUrl}
            alt={filename}
            className={`rounded-lg object-contain max-w-full ${sticker ? 'max-h-40' : 'max-h-80'}`}
          />
        </div>
      );
    }
    if (type === 'VIDEO') {
      return (
        <div className="chat-media chat-media-video space-y-1">
          <video
            src={localPreviewUrl}
            controls
            preload="metadata"
            className="rounded-lg max-w-full max-h-80"
          >
            Seu navegador não suporta vídeo inline.
          </video>
        </div>
      );
    }
    if (type === 'AUDIO') {
      return (
        <div className="chat-media chat-media-audio space-y-1 min-w-[220px]">
          {!audioInlineBlocked ? (
            <audio src={localPreviewUrl} controls preload="metadata" className="w-full max-w-sm">
              Seu navegador não suporta áudio inline.
            </audio>
          ) : (
            <InlineErrorHint text="Seu navegador não reproduz este áudio." />
          )}
        </div>
      );
    }
  }

  if (!mediaProxyUrl) {
    if (MEDIA_TYPES.includes(type) || Boolean(message.mediaId)) {
      if (effectiveMediaStatus === 'FAILED') {
        return (
          <MediaFailedContent
            message={message}
            driveUrl={driveUrl}
            linkClass={linkClass}
            mediaError={message.mediaError}
            onRetry={() => void handleRetry()}
            retrying={retrying}
            retryError={retryError}
            highlightTerm={highlightTerm}
            activeHighlight={activeHighlight}
          />
        );
      }
      return <MediaPendingContent message={message} highlightTerm={highlightTerm} activeHighlight={activeHighlight} />;
    }
    return null;
  }

  const showLoadingShell = loading && !displayUrl && !tagError && type !== 'DOCUMENT';

  if (showLoadingShell) {
    return (
      <div className="chat-media space-y-1">
        <MediaLoadingContent message={message} highlightTerm={highlightTerm} activeHighlight={activeHighlight} />
        {accessBar}
      </div>
    );
  }

  const inlineError =
    error
    || (tagError ? 'Não foi possível exibir a mídia inline.' : null)
    || (audioPlayError ? 'Seu navegador não reproduz este áudio.' : null);

  if (type === 'DOCUMENT') {
    return (
      <div className="chat-media chat-media-document space-y-1">
        <div className="flex items-start gap-2">
          <FileText className="h-5 w-5 shrink-0 opacity-80 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium break-words">{filename}</p>
            <InlineErrorHint text={error} />
          </div>
        </div>
        {accessBar}
      </div>
    );
  }

  if (type === 'IMAGE') {
    return (
      <div className="chat-media chat-media-image space-y-1">
        {!tagError && displayUrl ? (
          <button
            type="button"
            className="block p-0 border-0 bg-transparent cursor-pointer rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            onClick={() => window.open(displayUrl, '_blank', 'noopener,noreferrer')}
            title="Abrir imagem em nova aba"
          >
            <img
              src={displayUrl}
              alt={filename}
              className={`rounded-lg object-contain max-w-full ${
                sticker ? 'max-h-40' : 'max-h-80'
              }`}
              onError={() => setTagError(true)}
            />
          </button>
        ) : (
          <InlineErrorHint text={inlineError || 'Imagem indisponível inline.'} />
        )}
        {renderMediaCaption(message, highlightTerm, activeHighlight)}
        {accessBar}
      </div>
    );
  }

  if (type === 'VIDEO') {
    return (
      <div className="chat-media chat-media-video space-y-1">
        {!tagError && displayUrl ? (
          <video
            src={displayUrl}
            controls
            preload="metadata"
            className="rounded-lg max-w-full max-h-80"
            onError={() => setTagError(true)}
          >
            Seu navegador não suporta vídeo inline.
          </video>
        ) : (
          <InlineErrorHint text={inlineError || 'Vídeo indisponível inline.'} />
        )}
        {renderMediaCaption(message, highlightTerm, activeHighlight)}
        {accessBar}
      </div>
    );
  }

  if (type === 'AUDIO') {
    const showPlayer = displayUrl && !audioInlineBlocked && !audioPlayError && !tagError;
    return (
      <div className="chat-media chat-media-audio space-y-1 min-w-[220px]">
        {showPlayer ? (
          <audio
            src={displayUrl}
            controls
            preload="metadata"
            className="w-full max-w-sm"
            onError={() => setAudioPlayError(true)}
          >
            Seu navegador não suporta áudio inline.
          </audio>
        ) : (
          <InlineErrorHint
            text={
              audioInlineBlocked || audioPlayError
                ? 'Seu navegador não reproduz este áudio.'
                : inlineError || 'Áudio indisponível inline.'
            }
          />
        )}
        {accessBar}
      </div>
    );
  }

  return (
    <div className="chat-media space-y-1">
      <span className="text-sm">
        <BubbleText text={message.content || 'Mídia recebida'} highlightTerm={highlightTerm} active={activeHighlight} />
      </span>
      <InlineErrorHint text={inlineError} />
      {accessBar}
    </div>
  );
}

function LocationBubbleContent({ location, isOutbound }) {
  const linkClass = isOutbound
    ? 'text-white underline underline-offset-2 hover:text-white/90 font-semibold'
    : 'text-emerald-700 dark:text-emerald-300 underline underline-offset-2 hover:opacity-90 font-semibold';

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        isOutbound
          ? 'border-white/25 bg-white/10'
          : 'border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40'
      }`}
    >
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <span aria-hidden>📍</span>
        {location.name || 'Localização'}
      </p>
      {location.address ? (
        <p className="text-xs opacity-90 mt-1 break-words">{location.address}</p>
      ) : null}
      <a
        href={mapsUrl(location.latitude, location.longitude)}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-block text-[11px] mt-2 ${linkClass}`}
      >
        Ver no mapa
      </a>
    </div>
  );
}

function InteractiveReplyBubbleContent({ reply }) {
  const titulo = reply.title || reply.id || reply.payload || 'Resposta';
  return (
    <div className="text-sm space-y-1">
      <p className="inline-flex items-start gap-1.5 font-medium">
        <span className="shrink-0" aria-hidden>
          ↩️
        </span>
        <span>
          Respondeu: <span className="font-semibold">{titulo}</span>
        </span>
      </p>
      {reply.description ? (
        <p className="text-xs opacity-80 pl-6 break-words">{reply.description}</p>
      ) : null}
    </div>
  );
}

function ContactBubbleContent({ message, isOutbound }) {
  const contatos = parseContactCardContent(message.content);
  const btnClass = isOutbound
    ? 'inline-flex items-center rounded-md bg-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/30'
    : 'inline-flex items-center rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600';

  if (!contatos?.length) {
    return (
      <div className="text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <UserRound className="h-4 w-4 shrink-0" />
          {resumoContactCardContent(message.content)}
        </span>
        <p className="text-xs opacity-75 mt-1">Cartão de contato recebido antes da atualização do sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contatos.map((contato, idx) => (
        <div
          key={`${contato.nome ?? 'contato'}-${idx}`}
          className={`rounded-lg border px-2.5 py-2 ${
            isOutbound ? 'border-white/25 bg-white/10' : 'border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40'
          }`}
        >
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <UserRound className="h-4 w-4 shrink-0" />
            {tituloContatoCartao(contato)}
          </p>
          {(contato.telefones ?? []).map((tel, telIdx) => {
            const apiPhone = telefoneCartaoParaApi(tel);
            const exibicao = tel.numero || (apiPhone ? formatPhoneDisplay(apiPhone) : '—');
            return (
              <div key={`${exibicao}-${telIdx}`} className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums">{exibicao}</span>
                {apiPhone ? (
                  <Link
                    to={`/whatsapp/conversas?telefone=${encodeURIComponent(apiPhone)}`}
                    className={btnClass}
                  >
                    Conversar
                  </Link>
                ) : null}
              </div>
            );
          })}
          {(contato.emails ?? []).map((email) => (
            <p key={email} className="mt-1 text-xs break-all opacity-90">
              {email}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReactionBadge({ emojis, isOutbound }) {
  if (!Array.isArray(emojis) || emojis.length === 0) return null;
  return (
    <div
      className={`absolute -bottom-2.5 ${isOutbound ? 'left-2' : 'right-2'} z-10 pointer-events-none`}
      aria-label={`Reações: ${emojis.join(' ')}`}
    >
      <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white px-1.5 py-0.5 text-[13px] leading-none shadow-sm dark:border-slate-600 dark:bg-slate-700">
        {emojis.map((emoji) => (
          <span key={emoji} aria-hidden>
            {emoji}
          </span>
        ))}
      </span>
    </div>
  );
}

function formatTemplateContent(message) {
  const template = String(message.templateName ?? '').toLowerCase();
  const raw = String(message.content ?? '').trim();
  if (template === 'cobranca_pagamento') {
    if (raw.startsWith('Olá ')) return raw;
    const [nome, unidade, condominio] = raw.split(',').map((s) => s.trim());
    if (nome && unidade) {
      return condominio
        ? `Olá ${nome}, identificamos pendência referente à ${unidade} no ${condominio}.`
        : `Olá ${nome}, identificamos pendência referente à ${unidade}.`;
    }
  }
  return raw || '—';
}

export function ChatBubble({
  message,
  onRetryOutboundMedia,
  onLocalPreviewConsumed,
  highlightTerm = '',
  isActiveSearchMatch = false,
  onDeleteMessage,
}) {
  const isOutbound = String(message.direction ?? '').toUpperCase() === 'OUTBOUND';
  const hasTemplate = Boolean(message.templateName);
  const type = String(message.messageType ?? '').toUpperCase();
  const isReaction = type === 'REACTION';

  if (isReaction) {
    if (message._reactionAttachedToTarget) {
      return null;
    }
    const label = labelReactionThread(message.content);
    return (
      <div className="flex justify-center py-0.5" role="status" aria-label={label}>
        <span
          className="rounded-full bg-white/90 dark:bg-slate-700/90 px-3 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm tabular-nums"
          title={formatDateTimeBR(message.createdAt)}
        >
          {label}
        </span>
      </div>
    );
  }

  const isContact = type === 'CONTACT';
  const isLocation = type === 'LOCATION';
  const isInteractive = type === 'INTERACTIVE' || type === 'BUTTON';
  const parsedLocation = isLocation ? parseLocationContent(message.content) : null;
  const parsedInteractive = isInteractive ? parseInteractiveReplyContent(message.content) : null;
  const isMedia =
    !isContact &&
    !isLocation &&
    !isInteractive &&
    (MEDIA_TYPES.includes(type) ||
      Boolean(message.mediaId) ||
      Boolean(message.localPreviewUrl) ||
      message.sendFailed);
  const mediaContent = isMedia ? (
    <MediaBubbleContent
      message={message}
      isOutbound={isOutbound}
      onRetryOutboundMedia={onRetryOutboundMedia}
      onLocalPreviewConsumed={onLocalPreviewConsumed}
      highlightTerm={highlightTerm}
      activeHighlight={isActiveSearchMatch}
    />
  ) : null;
  const contactContent = isContact ? <ContactBubbleContent message={message} isOutbound={isOutbound} /> : null;
  const locationContent =
    parsedLocation ? <LocationBubbleContent location={parsedLocation} isOutbound={isOutbound} /> : null;
  const interactiveContent = parsedInteractive ? (
    <InteractiveReplyBubbleContent reply={parsedInteractive} />
  ) : null;

  const canDelete =
    typeof onDeleteMessage === 'function' && typeof message?.id === 'number' && message.id > 0;
  const attachedReactions = Array.isArray(message.attachedReactions) ? message.attachedReactions : [];
  const hasReactionBadge = attachedReactions.length > 0;

  return (
    <div
      id={message.id != null ? `msg-${message.id}` : undefined}
      className={`group/msg relative flex ${isOutbound ? 'justify-end' : 'justify-start'} ${
        hasReactionBadge ? 'mb-2' : ''
      } ${
        isActiveSearchMatch ? 'rounded-2xl ring-2 ring-amber-500 ring-offset-2 ring-offset-[#e5ddd5] dark:ring-offset-slate-800/50' : ''
      }`}
    >
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
          isOutbound
            ? 'bg-[#25D366] text-white rounded-br-md'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md'
        } ${isMedia ? 'bg-opacity-95' : ''}`}
      >
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDeleteMessage(message)}
            className={`absolute -top-2 ${isOutbound ? '-left-2' : '-right-2'} z-10 inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-red-600 shadow-sm opacity-0 transition-opacity group-hover/msg:opacity-100 focus:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-red-400`}
            title="Apagar da sua inbox (não apaga no WhatsApp do contato)"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            Apagar
          </button>
        ) : null}
        {hasTemplate ? (
          <span
            className={`inline-block mb-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              isOutbound ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
            }`}
          >
            Template: {message.templateName}
          </span>
        ) : null}
        {contactContent ?? locationContent ?? interactiveContent ?? mediaContent ?? (
          <p className="text-sm whitespace-pre-wrap break-words">
            <BubbleText
              text={formatTemplateContent(message)}
              highlightTerm={highlightTerm}
              active={isActiveSearchMatch}
            />
          </p>
        )}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-white/80' : 'text-slate-500'}`}>
          <span className="text-[11px]" title={formatDateTimeBR(message.createdAt)}>
            {formatTimeBR(message.createdAt)}
          </span>
          {isOutbound ? <MessageStatusIcon status={message.status} /> : null}
        </div>
        {hasReactionBadge ? <ReactionBadge emojis={attachedReactions} isOutbound={isOutbound} /> : null}
      </div>
    </div>
  );
}
