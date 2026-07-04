import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Link2, Loader2, MessageCircle, Search, Send } from 'lucide-react';
import { ChatBubble } from './components/ChatBubble.jsx';
import {
  WhatsAppMediaAttachComposer,
  WhatsAppMediaSendingIndicator,
} from './components/WhatsAppMediaAttachComposer.jsx';
import { ModalVinculosTelefoneConversa } from './components/ModalVinculosTelefoneConversa.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { useWhatsAppNotificationContext } from './WhatsAppNotificationProvider.jsx';
import { getWhatsAppConversationContext } from '../../repositories/whatsappRepository.js';
import { formatPhoneDisplay, formatTimeBR, isValidBrazilPhone, normalizePhoneForApi } from '../../utils/whatsappFormat.js';
import { FREE_TEXT_DELIVERY_ERROR, FREE_TEXT_WINDOW_HINT } from '../../utils/whatsappTemplateUtils.js';
import { isWhatsAppMediaPending, mergeMediaReady, consumirLocalPreview, revogarPreviewsLocaisEmLista } from './utils/whatsappMediaUtils.js';
import { validarArquivoWhatsAppMedia } from './utils/whatsappMediaSendUtils.js';
import { useOptimisticMediaSend } from './hooks/useOptimisticMediaSend.js';
import { sendWhatsAppMedia } from '../../repositories/whatsappRepository.js';
import { resumoWhatsAppMessageContent } from './utils/whatsappMessagePreview.js';
import { WhatsAppContactAvatar } from './components/WhatsAppContactAvatar.jsx';
import { WhatsAppUnreadBadge, unreadCountOf } from './components/WhatsAppUnreadBadge.jsx';
import { marcarConversaLidaAsync, applyInboundToConversationList, zeroUnreadAndReportHadUnread } from './utils/whatsappReadUtils.js';

const PAGE_SIZE = 20;
const CONVERSATIONS_PAGE_SIZE = 50;
const CONVERSATIONS_REFRESH_MS = 30_000;

/** Input em linha flex (sem w-full — evita conflito com botão ao lado). */
const chatComposeInputClass =
  'flex-1 min-w-0 basis-0 px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 font-medium placeholder:text-gray-300 placeholder:italic focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-[box-shadow,border-color] duration-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

/** Botão compacto de ícone (sem w-full do processosBtnPrimary). */
const chatComposeBtnClass =
  'inline-flex shrink-0 flex-none items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-green-800 hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/25 ring-1 ring-white/15 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none';

function previewText(conv) {
  const type = String(conv?.lastMessageType ?? '').toUpperCase();
  if (['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'CONTACT', 'LOCATION', 'INTERACTIVE', 'BUTTON'].includes(type)) {
    return resumoWhatsAppMessageContent(type, conv?.lastMessagePreview);
  }
  const raw = String(conv?.lastMessagePreview ?? '').trim();
  if (raw) return raw;
  return conv?.lastMessageDirection === 'INBOUND' ? 'Mensagem recebida' : 'Mensagem enviada';
}

function tituloContato(nome, telefone) {
  const nomeLimpo = String(nome ?? '').trim();
  if (nomeLimpo) return nomeLimpo;
  return formatPhoneDisplay(telefone);
}

function resumoContexto(ctx) {
  if (!ctx) return '';
  const partes = [];
  if (ctx.codigoCliente) {
    const cod = String(ctx.codigoCliente).replace(/^0+(?=\d)/, '');
    partes.push(`Cód. ${cod || ctx.codigoCliente}`);
  }
  if (ctx.processoNumeroInterno != null) partes.push(`Proc. ${ctx.processoNumeroInterno}`);
  if (ctx.unidadeDescricao) partes.push(ctx.unidadeDescricao);
  if (ctx.condominioNome && !ctx.unidadeDescricao) partes.push(ctx.condominioNome);
  return partes.join(' · ');
}

function linkProcesso(ctx) {
  if (!ctx?.codigoCliente) return null;
  const params = new URLSearchParams();
  params.set('codigoCliente', ctx.codigoCliente);
  if (ctx.processoNumeroInterno != null) params.set('numeroInterno', String(ctx.processoNumeroInterno));
  if (ctx.processoId) params.set('processoApiId', String(ctx.processoId));
  return `/processos?${params.toString()}`;
}

function ContextoProcessoLinha({ ctx, className = '' }) {
  const resumo = resumoContexto(ctx);
  if (!resumo) return null;
  return (
    <p className={`text-[11px] text-emerald-700 dark:text-emerald-400 truncate ${className}`} title={resumo}>
      {resumo}
    </p>
  );
}

function PainelContextoChat({ contextos, indice, onIndiceChange }) {
  const lista = Array.isArray(contextos) ? contextos : [];
  if (lista.length === 0) return null;

  const ctx = lista[indice] ?? lista[0];
  const href = linkProcesso(ctx);
  const multiplos = lista.length > 1;

  return (
    <div className="mt-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-2.5 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/80">
            Resposta provável à cobrança
          </p>
          <p className="text-xs text-emerald-900 dark:text-emerald-100 truncate" title={resumoContexto(ctx)}>
            {resumoContexto(ctx)}
          </p>
          {ctx.clienteEscritorioNome ? (
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80 truncate">{ctx.clienteEscritorioNome}</p>
          ) : null}
        </div>
        {href ? (
          <Link
            to={href}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"
          >
            Abrir processo
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
      {multiplos ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {lista.map((item, i) => (
            <button
              key={`${item.cobrancaId ?? item.processoId ?? i}-${i}`}
              type="button"
              onClick={() => onIndiceChange?.(i)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                i === indice
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white/80 text-emerald-800 hover:bg-white dark:bg-slate-800 dark:text-emerald-200'
              }`}
              title={resumoContexto(item)}
            >
              {item.processoNumeroInterno != null ? `Proc. ${item.processoNumeroInterno}` : `Opção ${i + 1}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WhatsAppConversas() {
  const { getConversations, getMessages, sendText } = useWhatsApp();
  const toast = useWhatsAppToast();
  const { clearNotifications, latestInbound, latestMediaReady, latestConversationRead, adjustUnreadConversations } =
    useWhatsAppNotificationContext() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsPageLoaded, setConversationsPageLoaded] = useState(0);
  const [conversationsTotalPages, setConversationsTotalPages] = useState(0);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [activePhone, setActivePhone] = useState('');
  const [messages, setMessages] = useState([]);
  const { sendOptimisticMedia, retryOptimisticMedia } = useOptimisticMediaSend({
    setMessages,
    sendMediaApi: sendWhatsAppMedia,
  });
  const [contactName, setContactName] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [contextosAtivos, setContextosAtivos] = useState([]);
  const [indiceContexto, setIndiceContexto] = useState(0);
  const [modalVinculosAberto, setModalVinculosAberto] = useState(false);
  const bottomRef = useRef(null);
  const openedFromUrl = useRef(false);
  const lastListInboundIdRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoadingConversations(true);
      try {
        const res = await getConversations(0, CONVERSATIONS_PAGE_SIZE);
        const page0 = Array.isArray(res?.content) ? res.content : [];
        setConversationsTotalPages(Number(res?.totalPages ?? 0));
        if (silent) {
          setConversations((prev) => {
            if (prev.length <= CONVERSATIONS_PAGE_SIZE) return page0;
            const page0Phones = new Set(page0.map((c) => normalizePhoneForApi(c.phoneNumber)));
            const older = prev
              .slice(CONVERSATIONS_PAGE_SIZE)
              .filter((c) => !page0Phones.has(normalizePhoneForApi(c.phoneNumber)));
            return [...page0, ...older];
          });
        } else {
          setConversationsPageLoaded(0);
          setConversations(page0);
        }
      } catch (err) {
        toast.error(err?.message || 'Erro ao carregar conversas.');
      } finally {
        if (!silent) setLoadingConversations(false);
      }
    },
    [getConversations, toast],
  );

  const handleLoadMoreConversations = useCallback(async () => {
    if (conversationsPageLoaded + 1 >= conversationsTotalPages) return;
    setLoadingMoreConversations(true);
    try {
      const nextPage = conversationsPageLoaded + 1;
      const res = await getConversations(nextPage, CONVERSATIONS_PAGE_SIZE);
      const chunk = Array.isArray(res?.content) ? res.content : [];
      setConversationsTotalPages(Number(res?.totalPages ?? conversationsTotalPages));
      setConversationsPageLoaded(nextPage);
      setConversations((prev) => {
        const existing = new Set(prev.map((c) => normalizePhoneForApi(c.phoneNumber)));
        const novos = chunk.filter((c) => !existing.has(normalizePhoneForApi(c.phoneNumber)));
        return [...prev, ...novos];
      });
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar conversas.');
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [conversationsPageLoaded, conversationsTotalPages, getConversations, toast]);

  const fetchPage = useCallback(
    async (phone, pageNum, appendOlder = false) => {
      const normalized = normalizePhoneForApi(phone);
      const res = await getMessages(normalized, pageNum, PAGE_SIZE);
      const chunk = Array.isArray(res?.content) ? [...res.content].reverse() : [];
      setTotalPages(Number(res?.totalPages ?? 0));
      setPage(pageNum);
      if (appendOlder) {
        setMessages((prev) => [...chunk, ...prev]);
      } else {
        setMessages(chunk);
        const nameFromMessages =
          chunk.find((m) => String(m.contactName ?? '').trim())?.contactName ??
          res?.content?.find((m) => String(m.contactName ?? '').trim())?.contactName;
        setContactName((prev) => String(nameFromMessages ?? '').trim() || String(prev ?? '').trim());
      }
      return chunk;
    },
    [getMessages],
  );

  const markConversationReadLocal = useCallback(
    (phone) => {
      setConversations((prev) => {
        const { conversations: next, hadUnread } = zeroUnreadAndReportHadUnread(prev, phone);
        if (hadUnread) adjustUnreadConversations?.(-1);
        return next;
      });
    },
    [adjustUnreadConversations],
  );

  const openConversation = useCallback(
    async (phone, nameHint = '', contextosHint = null) => {
      const normalized = normalizePhoneForApi(phone);
      if (!normalized) return;
      markConversationReadLocal(normalized);
      setActivePhone(normalized);
      setContactName(nameHint || '');
      setIndiceContexto(0);
      const hintList = Array.isArray(contextosHint) ? contextosHint : [];
      setContextosAtivos(hintList);
      setLoading(true);
      setSearchParams({ telefone: normalized }, { replace: true });
      try {
        if (hintList.length === 0) {
          try {
            const ctx = await getWhatsAppConversationContext(normalized);
            setContextosAtivos(Array.isArray(ctx) ? ctx : []);
          } catch {
            setContextosAtivos([]);
          }
        }
        await fetchPage(normalized, 0, false);
        markConversationReadLocal(normalized);
        marcarConversaLidaAsync(normalized);
        window.setTimeout(scrollToBottom, 100);
      } catch (err) {
        toast.error(err?.message || 'Erro ao buscar mensagens.');
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchPage, setSearchParams, toast, markConversationReadLocal],
  );

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (!isValidBrazilPhone(query)) {
      toast.error('Informe um telefone brasileiro válido (DDD + número).');
      return;
    }
    await openConversation(query);
  };

  const handleLoadMore = async () => {
    if (!activePhone || page + 1 >= totalPages) return;
    setLoadingMore(true);
    try {
      await fetchPage(activePhone, page + 1, true);
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar mensagens.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLocalPreviewConsumed = useCallback((messageId) => {
    setMessages((prev) => consumirLocalPreview(prev, messageId));
  }, []);

  const handleRetryOutboundMedia = useCallback(
    async (message) => {
      const result = await retryOptimisticMedia(message);
      if (!result.ok) {
        toast.error(result.error || 'Falha ao reenviar mídia.');
      } else {
        toast.success('Mídia reenviada.');
        window.setTimeout(scrollToBottom, 50);
        loadConversations({ silent: true });
      }
    },
    [retryOptimisticMedia, toast, loadConversations],
  );

  useEffect(() => {
    return () => {
      setMessages((prev) => {
        revogarPreviewsLocaisEmLista(prev);
        return prev;
      });
    };
  }, [activePhone]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!activePhone || sending) return;

    if (selectedFile) {
      const validation = validarArquivoWhatsAppMedia(selectedFile);
      if (!validation.ok) {
        toast.error(validation.erro);
        return;
      }
      setSending(true);
      try {
        const result = await sendOptimisticMedia({
          phone: activePhone,
          file: selectedFile,
          caption: mediaCaption.trim() || undefined,
        });
        if (!result.ok) {
          toast.error(result.error || 'Falha ao enviar mídia.');
          return;
        }
        setSelectedFile(null);
        setMediaCaption('');
        toast.success('Mídia enviada.');
        window.setTimeout(scrollToBottom, 50);
        loadConversations({ silent: true });
      } catch (err) {
        toast.error(err?.message || 'Falha ao enviar mídia.');
      } finally {
        setSending(false);
      }
      return;
    }

    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await sendText(activePhone, text);
      if (res?.success === false) {
        toast.error(res.error || FREE_TEXT_DELIVERY_ERROR);
        return;
      }
      const optimistic = {
        id: `local-${Date.now()}`,
        direction: 'OUTBOUND',
        content: text,
        status: 'SENT',
        createdAt: new Date().toISOString(),
        phoneNumber: activePhone,
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft('');
      toast.success('Mensagem enviada.');
      window.setTimeout(scrollToBottom, 50);
      loadConversations({ silent: true });
    } catch (err) {
      toast.error(err?.message || FREE_TEXT_DELIVERY_ERROR);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!activePhone) return;
    const conv = conversations.find((c) => normalizePhoneForApi(c.phoneNumber) === activePhone);
    if (Array.isArray(conv?.contextos) && conv.contextos.length > 0) {
      setContextosAtivos(conv.contextos);
    }
    const nomeLista = String(conv?.contactName ?? '').trim();
    if (nomeLista) {
      setContactName((prev) => prev || nomeLista);
    }
  }, [conversations, activePhone]);

  useEffect(() => {
    void loadConversations();
    const interval = window.setInterval(() => void loadConversations({ silent: true }), CONVERSATIONS_REFRESH_MS);
    clearNotifications?.();
    return () => window.clearInterval(interval);
  }, [loadConversations, clearNotifications]);

  useEffect(() => {
    if (!latestInbound?.messageId) return;
    if (lastListInboundIdRef.current === latestInbound.messageId) return;
    if (String(latestInbound.direction ?? '').toUpperCase() !== 'INBOUND') return;
    lastListInboundIdRef.current = latestInbound.messageId;

    setConversations((prev) => {
      const result = applyInboundToConversationList(prev, latestInbound, activePhone);
      if (!result.found) {
        void loadConversations({ silent: true });
        return prev;
      }
      if (result.becameUnread) adjustUnreadConversations?.(1);
      return result.conversations;
    });
  }, [latestInbound, activePhone, loadConversations, adjustUnreadConversations]);

  useEffect(() => {
    if (!latestConversationRead?.phoneNumber) return;
    markConversationReadLocal(latestConversationRead.phoneNumber);
  }, [latestConversationRead, markConversationReadLocal]);

  useEffect(() => {
    if (!latestInbound || !activePhone) return;
    if (normalizePhoneForApi(latestInbound.phoneNumber) !== activePhone) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === latestInbound.messageId)) return prev;
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
    markConversationReadLocal(activePhone);
    if (String(latestInbound.contactName ?? '').trim()) {
      setContactName((prev) => prev || latestInbound.contactName);
    }
    marcarConversaLidaAsync(activePhone);
  }, [latestInbound, activePhone, markConversationReadLocal]);

  useEffect(() => {
    if (!latestMediaReady?.mediaDriveUrl || !activePhone) return;
    if (latestMediaReady.phoneNumber && normalizePhoneForApi(latestMediaReady.phoneNumber) !== activePhone) return;
    setMessages((prev) => mergeMediaReady(prev, latestMediaReady));
  }, [latestMediaReady, activePhone]);

  useEffect(() => {
    if (!activePhone || !messages.some(isWhatsAppMediaPending)) return undefined;
    const reload = async () => {
      try {
        await fetchPage(activePhone, 0, false);
      } catch {
        // silencioso
      }
    };
    const timer = window.setInterval(() => {
      void reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activePhone, messages, fetchPage]);

  useEffect(() => {
    if (openedFromUrl.current) return;
    const fromUrl = searchParams.get('telefone');
    if (fromUrl && isValidBrazilPhone(fromUrl)) {
      openedFromUrl.current = true;
      const normalized = normalizePhoneForApi(fromUrl);
      const conv = conversations.find((c) => normalizePhoneForApi(c.phoneNumber) === normalized);
      openConversation(fromUrl, conv?.contactName, conv?.contextos);
    }
  }, [conversations, openConversation, searchParams]);

  useEffect(() => {
    if (messages.length && !loadingMore) scrollToBottom();
  }, [messages.length, loadingMore]);

  const filteredConversations = conversations.filter((conv) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const phone = formatPhoneDisplay(conv.phoneNumber).toLowerCase();
    const name = String(conv.contactName ?? '').toLowerCase();
    const digits = q.replace(/\D/g, '');
    return name.includes(q) || phone.includes(q) || conv.phoneNumber.includes(digits);
  });

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-[calc(100dvh-12rem)] max-w-6xl mx-auto rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
      <aside className="w-full lg:w-80 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80">
        <form onSubmit={handleSearch} className="flex items-center gap-2 p-3 shrink-0 border-b border-slate-200 dark:border-slate-700">
          <input
            type="search"
            className={chatComposeInputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversa ou telefone"
          />
          <button type="submit" className={chatComposeBtnClass} disabled={loading} title="Buscar telefone">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando conversas…
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {conversations.length === 0
                ? 'Nenhuma conversa ainda. Envie uma mensagem em "Enviar mensagem" para iniciar.'
                : 'Nenhuma conversa corresponde à busca.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredConversations.map((conv) => {
                const selected = normalizePhoneForApi(conv.phoneNumber) === activePhone;
                const hasUnread = unreadCountOf(conv) > 0;
                return (
                  <li key={conv.phoneNumber}>
                    <button
                      type="button"
                      onClick={() => openConversation(conv.phoneNumber, conv.contactName, conv.contextos)}
                      className={`w-full text-left px-3 py-3 hover:bg-white dark:hover:bg-slate-800 transition-colors flex gap-2.5 ${
                        selected ? 'bg-white dark:bg-slate-800 border-l-4 border-emerald-600' : 'border-l-4 border-transparent'
                      }`}
                    >
                      <WhatsAppContactAvatar
                        nome={conv.contactName}
                        telefone={conv.phoneNumber}
                        size="sm"
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm text-slate-900 dark:text-slate-100 truncate ${
                              hasUnread ? 'font-semibold' : 'font-medium'
                            }`}
                          >
                            {tituloContato(conv.contactName, conv.phoneNumber)}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <WhatsAppUnreadBadge count={conv.unreadCount} />
                            <span className="text-[10px] text-slate-400">{formatTimeBR(conv.lastMessageAt)}</span>
                          </div>
                        </div>
                        {String(conv.contactName ?? '').trim() ? (
                          <p className="text-xs text-slate-500 truncate">{formatPhoneDisplay(conv.phoneNumber)}</p>
                        ) : null}
                        <ContextoProcessoLinha ctx={conv.contextoPrincipal} className="mt-0.5" />
                        <p className="text-xs text-slate-500 truncate mt-0.5">{previewText(conv)}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!loadingConversations && conversationsPageLoaded + 1 < conversationsTotalPages ? (
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => void handleLoadMoreConversations()}
                disabled={loadingMoreConversations}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-slate-700"
              >
                {loadingMoreConversations ? 'Carregando…' : 'Carregar conversas anteriores'}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col min-h-[280px]">
        {!activePhone ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-800/20">
            <p className="text-sm text-slate-500 max-w-sm">
              Selecione uma conversa ao lado ou busque um número para ver o histórico.
            </p>
          </div>
        ) : loading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <WhatsAppContactAvatar nome={contactName} telefone={activePhone} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <p className="font-medium text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                        {formatPhoneDisplay(activePhone)}
                      </p>
                      {String(contactName ?? '').trim() ? (
                        <span
                          className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate"
                          title={contactName}
                        >
                          {contactName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalVinculosAberto(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title="Buscar pessoas e vínculos (cód. + proc.) deste telefone"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Vínculos
                </button>
              </div>
              <PainelContextoChat
                contextos={contextosAtivos}
                indice={indiceContexto}
                onIndiceChange={setIndiceContexto}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3 bg-[#e5ddd5] dark:bg-slate-800/50">
              {page + 1 < totalPages ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="text-xs text-emerald-700 bg-white/80 px-3 py-1 rounded-full shadow-sm hover:bg-white disabled:opacity-50"
                  >
                    {loadingMore ? 'Carregando…' : 'Carregar mensagens anteriores'}
                  </button>
                </div>
              ) : null}
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id ?? msg.waMessageId}
                  message={msg}
                  onRetryOutboundMedia={handleRetryOutboundMedia}
                  onLocalPreviewConsumed={handleLocalPreviewConsumed}
                />
              ))}
              <div ref={bottomRef} />
            </div>
            <form
              onSubmit={handleSend}
              className="shrink-0 flex flex-col gap-1 p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <WhatsAppMediaAttachComposer
                selectedFile={selectedFile}
                onSelectFile={(file, erro) => {
                  if (erro) toast.error(erro);
                  setSelectedFile(file);
                  if (!file) setMediaCaption('');
                }}
                onClearFile={() => {
                  setSelectedFile(null);
                  setMediaCaption('');
                }}
                mediaCaption={mediaCaption}
                onMediaCaptionChange={setMediaCaption}
                disabled={sending}
                showClip={false}
              />
              <div className="flex items-center gap-2">
                <WhatsAppMediaAttachComposer
                  selectedFile={selectedFile}
                  onSelectFile={(file, erro) => {
                    if (erro) toast.error(erro);
                    setSelectedFile(file);
                  }}
                  onClearFile={() => {
                    setSelectedFile(null);
                    setMediaCaption('');
                  }}
                  mediaCaption={mediaCaption}
                  onMediaCaptionChange={setMediaCaption}
                  disabled={sending}
                  showPreview={false}
                  clipBtnClass="inline-flex shrink-0 flex-none items-center justify-center px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                />
                <input
                  type="text"
                  className={chatComposeInputClass}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={selectedFile ? 'Ou envie só o anexo…' : 'Digite uma mensagem…'}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || (!draft.trim() && !selectedFile)}
                  className={chatComposeBtnClass}
                  title={selectedFile ? 'Enviar mídia' : 'Enviar mensagem'}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <WhatsAppMediaSendingIndicator sending={sending && Boolean(selectedFile)} />
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 px-1">{FREE_TEXT_WINDOW_HINT}</p>
            </form>
          </>
        )}
      </section>

      <ModalVinculosTelefoneConversa
        open={modalVinculosAberto}
        telefone={activePhone}
        onClose={() => setModalVinculosAberto(false)}
      />
    </div>
  );
}
