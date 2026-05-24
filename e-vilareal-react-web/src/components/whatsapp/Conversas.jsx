import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, Send } from 'lucide-react';
import { ChatBubble } from './components/ChatBubble.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { formatPhoneDisplay, isValidBrazilPhone, normalizePhoneForApi } from '../../utils/whatsappFormat.js';
import { processosBtnPrimary, processosInputClass } from '../processos/ProcessosAdminLayout.jsx';

const PAGE_SIZE = 20;

export function WhatsAppConversas() {
  const { getMessages, sendText } = useWhatsApp();
  const toast = useWhatsAppToast();
  const [query, setQuery] = useState('');
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

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (!isValidBrazilPhone(query)) {
      toast.error('Informe um telefone brasileiro válido (DDD + número).');
      return;
    }
    setLoading(true);
    setActivePhone(normalizePhoneForApi(query));
    try {
      await fetchPage(query, 0, false);
      window.setTimeout(scrollToBottom, 100);
    } catch (err) {
      toast.error(err?.message || 'Erro ao buscar mensagens.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
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
        toast.error(res.error || 'Falha ao enviar.');
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
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (messages.length && !loadingMore) scrollToBottom();
  }, [messages.length, loadingMore]);

  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] max-w-3xl mx-auto">
      <form onSubmit={handleSearch} className="flex gap-2 mb-4 shrink-0">
        <input
          type="tel"
          className={processosInputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite o telefone (DDD + número)"
        />
        <button type="submit" className={processosBtnPrimary} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
      </form>

      {!activePhone ? (
        <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/30 p-8 text-center">
          <p className="text-sm text-slate-500 max-w-sm">
            Digite um número de telefone para ver o histórico de conversas.
          </p>
        </div>
      ) : (
        <>
          <div className="shrink-0 px-3 py-2 rounded-t-xl border border-b-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <p className="font-medium text-slate-900 dark:text-slate-100">{contactName || 'Contato'}</p>
            <p className="text-xs text-slate-500">{formatPhoneDisplay(activePhone)}</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3 bg-[#e5ddd5] dark:bg-slate-800/50 border-x border-slate-200 dark:border-slate-700">
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
            className="shrink-0 flex gap-2 p-3 rounded-b-xl border border-t-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <input
              type="text"
              className={processosInputClass}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Digite uma mensagem…"
              disabled={sending}
            />
            <button type="submit" disabled={sending || !draft.trim()} className={processosBtnPrimary}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
