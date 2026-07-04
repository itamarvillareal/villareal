import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle, Paperclip, Search, Send, X } from 'lucide-react';
import { useWhatsAppNotificationContext } from './WhatsAppNotificationProvider.jsx';
import { ChatBubble } from './components/ChatBubble.jsx';
import {
  getWhatsAppMessages,
  getWhatsAppRecentConversations,
  sendWhatsAppMedia,
  sendWhatsAppText,
} from '../../repositories/whatsappRepository.js';
import { formatPhoneDisplay, formatTimeBR } from '../../utils/whatsappFormat.js';
import { FREE_TEXT_DELIVERY_ERROR } from '../../utils/whatsappTemplateUtils.js';
import { isWhatsAppMediaPending, mergeMediaReady, consumirLocalPreview, revogarPreviewsLocaisEmLista } from './utils/whatsappMediaUtils.js';
import { validarArquivoWhatsAppMedia, WHATSAPP_MEDIA_ACCEPT, categoriaAceitaCaption } from './utils/whatsappMediaSendUtils.js';
import { useOptimisticMediaSend } from './hooks/useOptimisticMediaSend.js';

function previewConversa(conv) {
  const type = String(conv?.lastMessageType ?? '').toUpperCase();
  if (type === 'IMAGE') return '📷 Imagem';
  if (type === 'DOCUMENT') return '📎 Documento';
  if (type === 'AUDIO') return '🎤 Áudio';
  if (type === 'VIDEO') return '🎬 Vídeo';
  return conv?.lastMessageContent || '—';
}

function FloatingConversationList({ conversations, loading, query, onQueryChange, onSelect, onClose }) {
  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const nome = String(c.contactName ?? '').toLowerCase();
    const tel = String(c.phoneNumberFormatted ?? c.phoneNumber ?? '').toLowerCase();
    return nome.includes(q) || tel.includes(q);
  });

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#075E54] text-white shrink-0">
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
          filtered.map((conv) => (
            <button
              key={conv.phoneNumber}
              type="button"
              onClick={() => onSelect(conv)}
              className="w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {tituloFromNomeTelefone(conv.contactName, conv.phoneNumber)}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">{formatTimeBR(conv.lastMessageAt)}</span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{previewConversa(conv)}</p>
            </button>
          ))
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

function FloatingChatView({ conversation, onBack, onClose, latestInbound, latestMediaReady }) {
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
      const res = await getWhatsAppMessages(phone, 0, 30);
      const chunk = Array.isArray(res?.content) ? [...res.content].reverse() : [];
      setMessages(chunk);
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!latestInbound || latestInbound.phoneNumber !== phone) return;
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
  }, [latestInbound, phone]);

  useEffect(() => {
    if (!latestMediaReady?.mediaDriveUrl) return;
    if (latestMediaReady.phoneNumber && latestMediaReady.phoneNumber !== phone) return;
    setMessages((prev) => mergeMediaReady(prev, latestMediaReady));
  }, [latestMediaReady, phone]);

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
          phone,
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
    setSending(true);
    setError('');
    try {
      await sendWhatsAppText(phone, text);
      setDraft('');
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          phoneNumber: phone,
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
    } finally {
      setSending(false);
    }
  };

  const mediaValidation = selectedFile ? validarArquivoWhatsAppMedia(selectedFile) : null;
  const showMediaCaption =
    mediaValidation?.ok && categoriaAceitaCaption(mediaValidation.categoria);

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#075E54] text-white shrink-0">
        <button type="button" onClick={onBack} className="rounded p-1 hover:bg-white/10 text-sm" aria-label="Voltar">
          ←
        </button>
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
          messages.map((m) => (
            <ChatBubble
              key={m.id ?? m.waMessageId}
              message={m}
              onRetryOutboundMedia={handleRetryOutboundMedia}
              onLocalPreviewConsumed={handleLocalPreviewConsumed}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {error ? <p className="px-3 text-xs text-red-600 shrink-0">{error}</p> : null}
      {selectedFile ? (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-1.5">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5">
            <span className="flex-1 min-w-0 text-xs truncate text-emerald-900 dark:text-emerald-100" title={selectedFile.name}>
              {selectedFile.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setMediaCaption('');
              }}
              disabled={sending}
              className="shrink-0 text-emerald-800 dark:text-emerald-200"
              aria-label="Remover anexo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {showMediaCaption ? (
            <input
              type="text"
              value={mediaCaption}
              onChange={(e) => setMediaCaption(e.target.value)}
              placeholder="Legenda (opcional)"
              disabled={sending}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
            />
          ) : null}
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
            const v = validarArquivoWhatsAppMedia(file);
            if (!v.ok) {
              setError(v.erro);
              return;
            }
            setError('');
            setSelectedFile(file);
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={selectedFile ? 'Ou envie só o anexo…' : 'Digite uma mensagem...'}
          className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
          disabled={sending}
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
  const ctx = useWhatsAppNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [query, setQuery] = useState('');

  const unreadCount = ctx?.unreadCount ?? 0;
  const latestInbound = ctx?.latestInbound ?? null;
  const latestMediaReady = ctx?.latestMediaReady ?? null;

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const rows = await getWhatsAppRecentConversations(10);
      setConversations(Array.isArray(rows) ? rows : []);
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
    if (isOpen && latestInbound) {
      setConversations((prev) => {
        const exists = prev.some((c) => c.phoneNumber === latestInbound.phoneNumber);
        if (exists) {
          return prev.map((c) =>
            c.phoneNumber === latestInbound.phoneNumber
              ? {
                  ...c,
                  lastMessageContent: latestInbound.content,
                  lastMessageType: latestInbound.messageType,
                  lastMessageAt: latestInbound.createdAt,
                }
              : c,
          );
        }
        return [
          {
            phoneNumber: latestInbound.phoneNumber,
            phoneNumberFormatted: latestInbound.phoneNumberFormatted,
            contactName: latestInbound.contactName,
            lastMessageContent: latestInbound.content,
            lastMessageType: latestInbound.messageType,
            lastMessageAt: latestInbound.createdAt,
          },
          ...prev,
        ].slice(0, 10);
      });
    }
  }, [isOpen, latestInbound]);

  const openPanel = () => {
    ctx?.clearNotifications();
    setIsOpen(true);
  };

  const closePanel = () => {
    setIsOpen(false);
    setSelectedConversation(null);
    setQuery('');
  };

  if (!ctx) return null;

  return (
    <div className="whatsapp-floating-container fixed bottom-6 right-6 z-[9999] max-sm:bottom-0 max-sm:right-0">
      {!isOpen ? (
        <button
          type="button"
          onClick={openPanel}
          className="whatsapp-floating-button relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
          aria-label="Abrir WhatsApp"
        >
          <MessageCircle className="h-7 w-7" />
          {unreadCount > 0 ? (
            <span className="floating-badge absolute -top-1 -right-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
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
            />
          ) : (
            <FloatingConversationList
              conversations={conversations}
              loading={loadingConversations}
              query={query}
              onQueryChange={setQuery}
              onSelect={setSelectedConversation}
              onClose={closePanel}
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
