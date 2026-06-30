import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, MessageCircle, Search, Send } from 'lucide-react';
import { ChatBubble } from './components/ChatBubble.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { useWhatsAppNotificationContext } from './WhatsAppNotificationProvider.jsx';
import { formatPhoneDisplay, formatTimeBR, isValidBrazilPhone, normalizePhoneForApi } from '../../utils/whatsappFormat.js';
import { FREE_TEXT_DELIVERY_ERROR, FREE_TEXT_WINDOW_HINT } from '../../utils/whatsappTemplateUtils.js';
import { isWhatsAppMediaPending, mergeMediaReady } from './utils/whatsappMediaUtils.js';

const PAGE_SIZE = 20;
const CONVERSATIONS_REFRESH_MS = 30_000;

/** Input em linha flex (sem w-full — evita conflito com botão ao lado). */
const chatComposeInputClass =
  'flex-1 min-w-0 basis-0 px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 font-medium placeholder:text-gray-300 placeholder:italic focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-[box-shadow,border-color] duration-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

/** Botão compacto de ícone (sem w-full do processosBtnPrimary). */
const chatComposeBtnClass =
  'inline-flex shrink-0 flex-none items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-green-800 hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/25 ring-1 ring-white/15 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none';

function previewText(conv) {
  const type = String(conv?.lastMessageType ?? '').toUpperCase();
  if (type === 'IMAGE') return '📷 Imagem';
  if (type === 'DOCUMENT') return '📎 Documento';
  if (type === 'AUDIO') return '🎤 Áudio';
  if (type === 'VIDEO') return '🎬 Vídeo';
  const raw = String(conv?.lastMessagePreview ?? '').trim();
  if (raw) return raw;
  return conv?.lastMessageDirection === 'INBOUND' ? 'Mensagem recebida' : 'Mensagem enviada';
}

function tituloContato(nome, telefone) {
  const nomeLimpo = String(nome ?? '').trim();
  if (nomeLimpo) return nomeLimpo;
  return formatPhoneDisplay(telefone);
}

export function WhatsAppConversas() {
  const { getConversations, getMessages, sendText } = useWhatsApp();
  const toast = useWhatsAppToast();
  const { clearNotifications, latestInbound, latestMediaReady } = useWhatsAppNotificationContext() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activePhone, setActivePhone] = useState('');
  const [messages, setMessages] = useState([]);
  const [contactName, setContactName] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const openedFromUrl = useRef(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = useCallback(async () => {
    try {
      const res = await getConversations(0, 50);
      setConversations(Array.isArray(res?.content) ? res.content : []);
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar conversas.');
    } finally {
      setLoadingConversations(false);
    }
  }, [getConversations, toast]);

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
        const name = chunk.find((m) => m.contactName)?.contactName ?? res?.content?.[0]?.contactName;
        setContactName(name || '');
      }
      return chunk;
    },
    [getMessages],
  );

  const openConversation = useCallback(
    async (phone, nameHint = '') => {
      const normalized = normalizePhoneForApi(phone);
      if (!normalized) return;
      setActivePhone(normalized);
      setContactName(nameHint || '');
      setLoading(true);
      setSearchParams({ telefone: normalized }, { replace: true });
      try {
        await fetchPage(normalized, 0, false);
        window.setTimeout(scrollToBottom, 100);
      } catch (err) {
        toast.error(err?.message || 'Erro ao buscar mensagens.');
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchPage, setSearchParams, toast],
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!activePhone) return;
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
      loadConversations();
    } catch (err) {
      toast.error(err?.message || FREE_TEXT_DELIVERY_ERROR);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = window.setInterval(loadConversations, CONVERSATIONS_REFRESH_MS);
    clearNotifications?.();
    return () => window.clearInterval(interval);
  }, [loadConversations, clearNotifications]);

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
    loadConversations();
  }, [latestInbound, activePhone, loadConversations]);

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
      openConversation(fromUrl, conv?.contactName);
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
                return (
                  <li key={conv.phoneNumber}>
                    <button
                      type="button"
                      onClick={() => openConversation(conv.phoneNumber, conv.contactName)}
                      className={`w-full text-left px-3 py-3 hover:bg-white dark:hover:bg-slate-800 transition-colors ${
                        selected ? 'bg-white dark:bg-slate-800 border-l-4 border-emerald-600' : 'border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                          {tituloContato(conv.contactName, conv.phoneNumber)}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">{formatTimeBR(conv.lastMessageAt)}</span>
                      </div>
                      {String(conv.contactName ?? '').trim() ? (
                        <p className="text-xs text-slate-500 truncate">{formatPhoneDisplay(conv.phoneNumber)}</p>
                      ) : null}
                      <p className="text-xs text-slate-500 truncate mt-0.5">{previewText(conv)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
              <p className="font-medium text-slate-900 dark:text-slate-100">{tituloContato(contactName, activePhone)}</p>
              {String(contactName ?? '').trim() ? (
                <p className="text-xs text-slate-500">{formatPhoneDisplay(activePhone)}</p>
              ) : null}
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
                <ChatBubble key={msg.id ?? msg.waMessageId} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
            <form
              onSubmit={handleSend}
              className="shrink-0 flex flex-col gap-1 p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={chatComposeInputClass}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Digite uma mensagem…"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className={chatComposeBtnClass}
                  title="Enviar mensagem"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 px-1">{FREE_TEXT_WINDOW_HINT}</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
