import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, MessageCircle, Paperclip, Search, Send, X } from 'lucide-react';
import { WhatsAppMediaAttachPreview } from './components/WhatsAppMediaAttachPreview.jsx';
import { useWhatsAppNotificationContext } from './WhatsAppNotificationProvider.jsx';
import { ChatBubble } from './components/ChatBubble.jsx';
import { DaySeparator } from './components/DaySeparator.jsx';
import {
  getWhatsAppMessages,
  getWhatsAppRecentConversations,
  sendWhatsAppMedia,
  sendWhatsAppText,
  fixarConversa,
  desfixarConversa,
  arquivarConversa,
} from '../../repositories/whatsappRepository.js';
import {
  formatDateTimeBR,
  formatPhoneDisplay,
  formatRelativeConversationTime,
  normalizePhoneForApi,
} from '../../utils/whatsappFormat.js';
import { dateKeyBR } from '../../utils/whatsappScheduleUtils.js';
import { FREE_TEXT_DELIVERY_ERROR } from '../../utils/whatsappTemplateUtils.js';
import { isWhatsAppMediaPending, mergeMediaReady, consumirLocalPreview, revogarPreviewsLocaisEmLista } from './utils/whatsappMediaUtils.js';
import {
  criarOnPasteCompositor,
  handleAttachSelect,
  validarArquivoWhatsAppMedia,
  WHATSAPP_MEDIA_ACCEPT,
} from './utils/whatsappMediaSendUtils.js';
import { useOptimisticMediaSend } from './hooks/useOptimisticMediaSend.js';
import { resumoWhatsAppMessageContent } from './utils/whatsappMessagePreview.js';
import { WhatsAppContactAvatar } from './components/WhatsAppContactAvatar.jsx';
import { WhatsAppUnreadBadge, unreadCountOf } from './components/WhatsAppUnreadBadge.jsx';
import { WhatsAppConversationPinButton } from './components/WhatsAppConversationPinButton.jsx';
import { WhatsAppConversationArchiveButton } from './components/WhatsAppConversationArchiveButton.jsx';
import { marcarConversaLidaAsync, applyInboundToConversationList, zeroUnreadAndReportHadUnread, zeroUnreadInConversations } from './utils/whatsappReadUtils.js';
import { sortConversationsByPinAndRecency, togglePinInConversationList } from './utils/whatsappPinUtils.js';
import { enrichMessagesWithReactions } from './utils/whatsappReactionAttach.js';
import { useWhatsAppFloatingPosition } from './useWhatsAppFloatingPosition.js';

function previewConversa(conv) {
  const type = String(conv?.lastMessageType ?? '').toUpperCase();
  if (['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'CONTACT', 'LOCATION', 'INTERACTIVE', 'BUTTON', 'REACTION'].includes(type)) {
    return resumoWhatsAppMessageContent(type, conv?.lastMessageContent ?? conv?.lastMessagePreview);
  }
  return conv?.lastMessageContent || conv?.lastMessagePreview || '—';
}

function FloatingConversationList({ conversations, loading, query, onQueryChange, onSelect, onTogglePin, onArchive, onClose, headerDragProps = {} }) {
  const { className: dragClassName = '', ...headerDragRest } = headerDragProps;
  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const nome = String(c.contactName ?? '').toLowerCase();
    const tel = String(c.phoneNumberFormatted ?? c.phoneNumber ?? '').toLowerCase();
    return nome.includes(q) || tel.includes(q);
  });

  return (
    <>
      <div
        className={`flex items-center justify-between px-3 py-2.5 bg-[#075E54] text-white shrink-0 ${dragClassName}`}
        {...headerDragRest}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 bg-slate-50 dark:bg-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar conversa..."
            className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8 px-4">Nenhuma conversa recente.</p>
        ) : (
          filtered.map((conv) => {
            const hasUnread = unreadCountOf(conv) > 0;
            const isPinned = Boolean(conv.pinned);
            return (
            <button
              key={conv.phoneNumber}
              type="button"
              onClick={() => onSelect(conv)}
              className={`group w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex gap-2.5 ${
                isPinned ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
              }`}
            >
              <WhatsAppContactAvatar
                nome={conv.contactName}
                telefone={conv.phoneNumber}
                contactPhotoUrl={conv.contactPhotoUrl}
                size="sm"
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm truncate text-slate-900 dark:text-slate-100 ${
                      hasUnread ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {tituloFromNomeTelefone(conv.contactName, conv.phoneNumber)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <WhatsAppConversationPinButton
                      pinned={isPinned}
                      onToggle={() => onTogglePin?.(conv.phoneNumber, isPinned)}
                    />
                    <WhatsAppConversationArchiveButton
                      archivedView={false}
                      onToggle={() => onArchive?.(conv.phoneNumber)}
                    />
                    <WhatsAppUnreadBadge count={conv.unreadCount} />
                    <span
                      className="text-[10px] text-slate-400"
                      title={formatDateTimeBR(conv.lastMessageAt)}
                    >
                      {formatRelativeConversationTime(conv.lastMessageAt)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{previewConversa(conv)}</p>
              </div>
            </button>
            );
          })
        )}
      </div>
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
        <Link
          to="/whatsapp/conversas"
          onClick={onClose}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
        >
          Ver todas →
        </Link>
      </div>
    </>
  );
}

function FloatingChatView({ conversation, onBack, onClose, latestInbound, latestMediaReady, onMarkRead, headerDragProps = {} }) {
  const { className: dragClassName = '', ...headerDragRest } = headerDragProps;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const phone = conversation.phoneNumber;
  const phoneApi = normalizePhoneForApi(phone);

  const { sendOptimisticMedia, retryOptimisticMedia } = useOptimisticMediaSend({
    setMessages,
    sendMediaApi: sendWhatsAppMedia,
  });

  const handleLocalPreviewConsumed = useCallback((messageId) => {
    setMessages((prev) => consumirLocalPreview(prev, messageId));
  }, []);

  const handleRetryOutboundMedia = useCallback(
    async (message) => {
      const result = await retryOptimisticMedia(message);
      if (!result.ok) {
        setError(result.error || 'Falha ao reenviar mídia.');
      }
    },
    [retryOptimisticMedia],
  );

  useEffect(() => {
    return () => {
      setMessages((prev) => {
        revogarPreviewsLocaisEmLista(prev);
        return prev;
      });
    };
  }, [phone]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getWhatsAppMessages(phoneApi, 0, 30);
      const chunk = Array.isArray(res?.content) ? [...res.content].reverse() : [];
      setMessages(chunk);
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [phoneApi]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadMessages();
      if (cancelled) return;
      onMarkRead?.(phoneApi);
      marcarConversaLidaAsync(phoneApi);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMessages, phoneApi, onMarkRead]);

  useEffect(() => {
    if (!latestInbound || normalizePhoneForApi(latestInbound.phoneNumber) !== phoneApi) return;
    setMessages((prev) => {
      if (prev.some((m) => m.messageId === latestInbound.messageId || m.id === latestInbound.messageId)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: latestInbound.messageId,
          phoneNumber: latestInbound.phoneNumber,
          contactName: latestInbound.contactName,
          direction: 'INBOUND',
          messageType: latestInbound.messageType,
          content: latestInbound.content,
          createdAt: latestInbound.createdAt,
        },
      ];
    });
    onMarkRead?.(phoneApi);
    marcarConversaLidaAsync(phoneApi);
  }, [latestInbound, phoneApi, onMarkRead]);

  useEffect(() => {
    if (!latestMediaReady?.mediaDriveUrl) return;
    if (
      latestMediaReady.phoneNumber &&
      normalizePhoneForApi(latestMediaReady.phoneNumber) !== phoneApi
    ) {
      return;
    }
    setMessages((prev) => mergeMediaReady(prev, latestMediaReady));
  }, [latestMediaReady, phoneApi]);

  useEffect(() => {
    if (!messages.some(isWhatsAppMediaPending)) return undefined;
    const timer = window.setInterval(() => {
      void loadMessages(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [messages, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (sending) return;

    if (selectedFile) {
      const validation = validarArquivoWhatsAppMedia(selectedFile);
      if (!validation.ok) {
        setError(validation.erro);
        return;
      }
      setSending(true);
      setError('');
      try {
        const result = await sendOptimisticMedia({
          phone: phoneApi,
          file: selectedFile,
          caption: mediaCaption.trim() || undefined,
        });
        if (!result.ok) {
          setError(result.error || 'Falha ao enviar mídia.');
          return;
        }
        setSelectedFile(null);
        setMediaCaption('');
      } catch (err) {
        setError(String(err?.message ?? 'Falha ao enviar mídia.'));
      } finally {
        setSending(false);
      }
      return;
    }

    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSending(true);
    setError('');
    try {
      await sendWhatsAppText(phoneApi, text);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          phoneNumber: phoneApi,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          content: text,
          status: 'SENT',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const msg = String(err?.message ?? '');
      setError(msg.includes('24') || msg.includes('janela') ? FREE_TEXT_DELIVERY_ERROR : msg || 'Falha ao enviar.');
      setDraft((prev) => (prev.trim() ? prev : text));
    } finally {
      setSending(false);
    }
  };

  const applyMediaAttach = useCallback((file) => {
    const result = handleAttachSelect(file);
    if (!result.ok) {
      setError(result.erro);
      setSelectedFile(null);
      setMediaCaption('');
      return;
    }
    setError('');
    setSelectedFile(result.file);
  }, []);

  const onPasteCompositor = useMemo(
    () =>
      criarOnPasteCompositor({
        conversaAtiva: Boolean(phoneApi),
        onAttachFile: applyMediaAttach,
      }),
    [phoneApi, applyMediaAttach],
  );

  const displayMessages = useMemo(() => enrichMessagesWithReactions(messages), [messages]);

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2.5 bg-[#075E54] text-white shrink-0 ${dragClassName}`}
        {...headerDragRest}
      >
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-white/10 text-sm" aria-label="Voltar">
          ←
        </button>
        <WhatsAppContactAvatar
          nome={conversation.contactName}
          telefone={conversation.phoneNumber}
          contactPhotoUrl={conversation.contactPhotoUrl}
          size="sm"
        />
        <span className="flex-1 min-w-0 truncate text-sm font-semibold">
          {tituloFromNomeTelefone(conversation.contactName, conversation.phoneNumber)}
        </span>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2 bg-[#ECE5DD] dark:bg-slate-900">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : (
          displayMessages.map((m, idx) => {
            const prevKey = idx > 0 ? dateKeyBR(displayMessages[idx - 1].createdAt) : null;
            const curKey = dateKeyBR(m.createdAt);
            const showDaySep = idx === 0 || curKey !== prevKey;
            return (
              <Fragment key={m.id ?? m.waMessageId}>
                {showDaySep ? <DaySeparator iso={m.createdAt} /> : null}
                <ChatBubble
                  message={m}
                  onRetryOutboundMedia={handleRetryOutboundMedia}
                  onLocalPreviewConsumed={handleLocalPreviewConsumed}
                />
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {error ? <p className="px-3 text-xs text-red-600 shrink-0">{error}</p> : null}
      {selectedFile ? (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <WhatsAppMediaAttachPreview
            selectedFile={selectedFile}
            onClearFile={() => {
              setSelectedFile(null);
              setMediaCaption('');
            }}
            mediaCaption={mediaCaption}
            onMediaCaptionChange={setMediaCaption}
            disabled={sending}
            containerClass="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 space-y-1.5"
            inputClass="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      ) : null}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept={WHATSAPP_MEDIA_ACCEPT}
          className="hidden"
          disabled={sending}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (!file) return;
            applyMediaAttach(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-600 p-2 text-slate-600 dark:text-slate-300 disabled:opacity-50"
          aria-label="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={onPasteCompositor}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={selectedFile ? 'Ou envie só o anexo…' : 'Digite uma mensagem...'}
          className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || (!draft.trim() && !selectedFile)}
          className="shrink-0 rounded-lg bg-[#25D366] p-2 text-white disabled:opacity-50"
          aria-label="Enviar"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </>
  );
}

export function WhatsAppFloatingChat() {
  const location = useLocation();
  const ctx = useWhatsAppNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [query, setQuery] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const openPanel = useCallback(() => {
    ctx?.clearNotifications();
    setIsOpen(true);
  }, [ctx]);

  const pathNorm = (location.pathname || '/').replace(/\/+$/, '') || '/';
  const isCalculosRoute =
    pathNorm === '/calculos' ||
    pathNorm.startsWith('/calculos/') ||
    pathNorm === '/relatorio-calculos' ||
    pathNorm.startsWith('/relatorio-calculos/');

  const { containerStyle, containerClassName, dragHandleProps, resetPosition } = useWhatsAppFloatingPosition({
    isOpen,
    isMobile,
    onTap: openPanel,
    defaultCorner: isMobile && isCalculosRoute ? 'bottom-left' : 'bottom-right',
  });
  const { className: fabDragClassName = '', ...fabDragRest } = dragHandleProps;

  const unreadCount = ctx?.unreadCount ?? 0;
  const latestInbound = ctx?.latestInbound ?? null;
  const latestMediaReady = ctx?.latestMediaReady ?? null;
  const latestConversationRead = ctx?.latestConversationRead ?? null;
  const adjustUnreadConversations = ctx?.adjustUnreadConversations;
  const lastListInboundIdRef = useRef(null);

  const activePhone = selectedConversation?.phoneNumber ?? '';

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const rows = await getWhatsAppRecentConversations(10);
      setConversations(sortConversationsByPinAndRecency(Array.isArray(rows) ? rows : []));
    } catch {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !selectedConversation) {
      void loadConversations();
    }
  }, [isOpen, selectedConversation, loadConversations]);

  useEffect(() => {
    if (!isOpen || !latestInbound?.messageId) return;
    if (lastListInboundIdRef.current === latestInbound.messageId) return;
    if (String(latestInbound.direction ?? '').toUpperCase() !== 'INBOUND') return;
    lastListInboundIdRef.current = latestInbound.messageId;

    setConversations((prev) => {
      const result = applyInboundToConversationList(prev, latestInbound, activePhone);
      if (!result.found) {
        if (!selectedConversation) void loadConversations();
        return prev;
      }
      if (result.becameUnread) adjustUnreadConversations?.(1);
      return result.conversations;
    });
  }, [isOpen, latestInbound, activePhone, selectedConversation, loadConversations, adjustUnreadConversations]);

  useEffect(() => {
    if (!isOpen || !latestConversationRead?.phoneNumber) return;
    setConversations((prev) => {
      const { conversations: next, hadUnread } = zeroUnreadAndReportHadUnread(prev, latestConversationRead.phoneNumber);
      if (hadUnread) adjustUnreadConversations?.(-1);
      return next;
    });
    if (
      selectedConversation &&
      normalizePhoneForApi(selectedConversation.phoneNumber) ===
        normalizePhoneForApi(latestConversationRead.phoneNumber)
    ) {
      setSelectedConversation((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
    }
  }, [isOpen, latestConversationRead, selectedConversation, adjustUnreadConversations]);

  const handleSelectConversation = useCallback(
    (conv) => {
      setConversations((prev) => {
        const { conversations: next, hadUnread } = zeroUnreadAndReportHadUnread(prev, conv.phoneNumber);
        if (hadUnread) adjustUnreadConversations?.(-1);
        return next;
      });
      setSelectedConversation({ ...conv, unreadCount: 0 });
    },
    [adjustUnreadConversations],
  );

  const handleMarkConversationRead = useCallback((phone) => {
    setConversations((prev) => zeroUnreadInConversations(prev, phone));
  }, []);

  const toggleConversationPin = useCallback((phone, currentlyPinned) => {
    const normalized = normalizePhoneForApi(phone);
    if (!normalized) return;
    const nextPinned = !currentlyPinned;
    setConversations((prev) => togglePinInConversationList(prev, normalized, nextPinned));
    const api = nextPinned ? fixarConversa : desfixarConversa;
    void api(normalized).catch((err) => {
      console.warn('[WhatsApp] fixar/desfixar falhou:', err?.message ?? err);
      setConversations((prev) => togglePinInConversationList(prev, normalized, currentlyPinned));
    });
  }, []);

  const archiveConversation = useCallback(
    (phone) => {
      const normalized = normalizePhoneForApi(phone);
      if (!normalized) return;
      setConversations((prev) =>
        prev.filter((c) => normalizePhoneForApi(c.phoneNumber) !== normalized),
      );
      if (
        selectedConversation &&
        normalizePhoneForApi(selectedConversation.phoneNumber) === normalized
      ) {
        setSelectedConversation(null);
      }
      void arquivarConversa(normalized).catch((err) => {
        console.warn('[WhatsApp] arquivar falhou:', err?.message ?? err);
        void loadConversations();
      });
    },
    [selectedConversation, loadConversations],
  );

  const closePanel = () => {
    setIsOpen(false);
    setSelectedConversation(null);
    setQuery('');
  };

  if (!ctx) return null;

  if (location.pathname.startsWith('/whatsapp')) {
    return null;
  }

  return (
    <div
      className={`whatsapp-floating-container fixed z-[9999] ${containerClassName}`}
      style={containerStyle}
    >
      {!isOpen ? (
        <button
          type="button"
          {...fabDragRest}
          onDoubleClick={(e) => {
            e.stopPropagation();
            resetPosition();
          }}
          className={`whatsapp-floating-button relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 ${fabDragClassName}`}
          aria-label="Abrir WhatsApp. Arraste para mover."
        >
          <MessageCircle className="h-7 w-7" />
          {unreadCount > 0 ? (
            <span className="floating-badge pointer-events-none absolute -top-1 -right-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="whatsapp-floating-panel flex h-[500px] w-[380px] max-sm:h-dvh max-sm:w-screen flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900 max-sm:rounded-none">
          {selectedConversation ? (
            <FloatingChatView
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
              onClose={closePanel}
              latestInbound={latestInbound}
              latestMediaReady={latestMediaReady}
              onMarkRead={handleMarkConversationRead}
              headerDragProps={dragHandleProps}
            />
          ) : (
            <FloatingConversationList
              conversations={conversations}
              loading={loadingConversations}
              query={query}
              onQueryChange={setQuery}
              onSelect={handleSelectConversation}
              onTogglePin={toggleConversationPin}
              onArchive={archiveConversation}
              onClose={closePanel}
              headerDragProps={dragHandleProps}
            />
          )}
        </div>
      )}
    </div>
  );
}

function tituloFromNomeTelefone(nome, telefone) {
  const nomeLimpo = String(nome ?? '').trim();
  if (nomeLimpo) return nomeLimpo;
  return formatPhoneDisplay(telefone);
}
