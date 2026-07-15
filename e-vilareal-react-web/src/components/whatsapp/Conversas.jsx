import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, LayoutTemplate, Link2, Loader2, MessageCircle, MessageSquarePlus, Pencil, Plus, Search, Send, ChevronUp, ChevronDown, ChevronLeft, X, Trash2, Camera, ImageMinus, MoreVertical } from 'lucide-react';
import { ConfirmDialog } from '../financeiro/shared/ConfirmDialog.jsx';
import { WhatsAppDeleteMessageDialog } from './components/WhatsAppDeleteMessageDialog.jsx';
import { EncaminharMensagemModal } from './components/EncaminharMensagemModal.jsx';
import { ForwardSelectionBar } from './components/ForwardSelectionBar.jsx';
import { ChatBubble } from './components/ChatBubble.jsx';
import { DaySeparator } from './components/DaySeparator.jsx';
import {
  WhatsAppMediaAttachComposer,
  WhatsAppMediaSendingIndicator,
} from './components/WhatsAppMediaAttachComposer.jsx';
import { IniciarConversaModal } from './components/IniciarConversaModal.jsx';
import { EnviarTemplateConversaModal } from './components/EnviarTemplateConversaModal.jsx';
import { ModalVinculosTelefoneConversa } from './components/ModalVinculosTelefoneConversa.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppForwardSelection } from './hooks/useWhatsAppForwardSelection.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { useWhatsAppNotificationContext } from './WhatsAppNotificationProvider.jsx';
import { getWhatsAppConversationContext, fixarConversa, desfixarConversa, arquivarConversa, desarquivarConversa, arquivarConversasLote, fixarConversasLote, marcarLidasLote, apagarMensagem, apagarConversa, getWhatsAppGrupos, definirFotoContato, removerFotoContato } from '../../repositories/whatsappRepository.js';
import {
  formatDateTimeBR,
  formatPhoneDisplay,
  formatRelativeConversationTime,
  isValidBrazilPhone,
  normalizePhoneForApi,
} from '../../utils/whatsappFormat.js';
import { dateKeyBR } from '../../utils/whatsappScheduleUtils.js';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { FREE_TEXT_DELIVERY_ERROR, FREE_TEXT_WINDOW_HINT } from '../../utils/whatsappTemplateUtils.js';
import { isWhatsAppMediaPending, mergeMediaReady, consumirLocalPreview, revogarPreviewsLocaisEmLista } from './utils/whatsappMediaUtils.js';
import { mergeMessageStatusUpdate } from './utils/whatsappMessageStatusUtils.js';
import {
  criarOnPasteCompositor,
  handleAttachSelect,
  validarArquivoWhatsAppMedia,
} from './utils/whatsappMediaSendUtils.js';
import { useOptimisticMediaSend } from './hooks/useOptimisticMediaSend.js';
import { sendWhatsAppMedia } from '../../repositories/whatsappRepository.js';
import { resumoWhatsAppMessageContent } from './utils/whatsappMessagePreview.js';
import { WhatsAppContactAvatar } from './components/WhatsAppContactAvatar.jsx';
import { WhatsAppMediaAttachPreview } from './components/WhatsAppMediaAttachPreview.jsx';
import { invalidateWhatsAppContactPhotoObjectUrl } from './utils/whatsappContactPhotoUrlCache.js';
import { WhatsAppUnreadBadge, unreadCountOf } from './components/WhatsAppUnreadBadge.jsx';
import { WhatsAppConversationPinButton } from './components/WhatsAppConversationPinButton.jsx';
import { WhatsAppConversationArchiveButton } from './components/WhatsAppConversationArchiveButton.jsx';
import { WhatsAppConversationGruposPanel } from './components/WhatsAppConversationGruposPanel.jsx';
import { ModalGrupoWhatsApp } from './components/ModalGrupoWhatsApp.jsx';
import { WhatsAppConversationSelectionBar } from './components/WhatsAppConversationSelectionBar.jsx';
import { WhatsAppConversationDeleteButton } from './components/WhatsAppConversationDeleteButton.jsx';
import { WHATSAPP_DELETE_CONVERSATION_CONFIRM } from './utils/whatsappDeleteCopy.js';
import { marcarConversaLidaAsync, applyInboundToConversationList, zeroUnreadAndReportHadUnread, zeroUnreadMultipleAndReport } from './utils/whatsappReadUtils.js';
import { enrichMessagesWithReactions } from './utils/whatsappReactionAttach.js';
import { sortConversationsByPinAndRecency, togglePinInConversationList, pinMultipleInConversationList } from './utils/whatsappPinUtils.js';
import {
  buscarConversasPorNome,
  conversationMatchesQuery,
} from './utils/whatsappConversationSearch.js';
import { findLastOutboundTemplateMessage } from './utils/whatsappTemplateParamsUtils.js';

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
  if (['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'CONTACT', 'LOCATION', 'INTERACTIVE', 'BUTTON', 'REACTION'].includes(type)) {
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

function contactPhotoProxyUrl(phone) {
  const normalized = normalizePhoneForApi(phone);
  if (!normalized) return null;
  return `/api/whatsapp/conversations/${normalized}/photo`;
}

function updateContactPhotoInList(list, phone, url) {
  const normalized = normalizePhoneForApi(phone);
  return list.map((c) =>
    normalizePhoneForApi(c.phoneNumber) === normalized ? { ...c, contactPhotoUrl: url ?? null } : c,
  );
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

function ConversationMessageSearchBar({
  query,
  onQueryChange,
  onClose,
  total,
  currentIndex,
  onPrev,
  onNext,
  loading,
  inputRef,
}) {
  const showCounter = query.trim().length >= 2;
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
      <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            onPrev();
          } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            onNext();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onPrev();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Buscar na conversa…"
        className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        autoComplete="off"
        spellCheck={false}
      />
      <span className="text-xs tabular-nums text-slate-500 shrink-0 min-w-[2.5rem] text-center">
        {loading ? '…' : showCounter ? (total > 0 ? `${currentIndex + 1}/${total}` : '0/0') : '—'}
      </span>
      <button
        type="button"
        onClick={onPrev}
        disabled={total === 0}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        title="Ocorrência anterior (Shift+Enter)"
        aria-label="Ocorrência anterior"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={total === 0}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        title="Próxima ocorrência (Enter)"
        aria-label="Próxima ocorrência"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        title="Fechar busca"
        aria-label="Fechar busca"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function WhatsAppConversas() {
  const { getConversations, getMessages, sendText, searchMessages } = useWhatsApp();
  const toast = useWhatsAppToast();
  const { clearNotifications, latestInbound, latestMediaReady, latestStatusUpdate, latestConversationRead, adjustUnreadConversations } =
    useWhatsAppNotificationContext() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [searchingConversations, setSearchingConversations] = useState(false);
  const [showArchivedView, setShowArchivedView] = useState(false);
  const [selectedClienteCodigo, setSelectedClienteCodigo] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [modalGrupoOpen, setModalGrupoOpen] = useState(false);
  const [modalGrupoModo, setModalGrupoModo] = useState('criar');
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
  const [contactPhotoUrl, setContactPhotoUrl] = useState(null);
  const [contactPhotoMenuOpen, setContactPhotoMenuOpen] = useState(false);
  const [pendingContactPhotoFile, setPendingContactPhotoFile] = useState(null);
  const [contactPhotoBusy, setContactPhotoBusy] = useState(false);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
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
  const [iniciarModalOpen, setIniciarModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  const [conversationSearchMatches, setConversationSearchMatches] = useState([]);
  const [conversationSearchIndex, setConversationSearchIndex] = useState(0);
  const [conversationSearchLoading, setConversationSearchLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState(() => new Set());
  const [bulkSelectionBusy, setBulkSelectionBusy] = useState(false);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null);
  const [pendingDeleteConversationPhone, setPendingDeleteConversationPhone] = useState('');
  const bottomRef = useRef(null);
  const conversationSearchInputRef = useRef(null);
  const contactPhotoFileInputRef = useRef(null);
  const openedFromUrl = useRef(false);
  const lastListInboundIdRef = useRef(null);
  const archiveViewInitialized = useRef(false);
  const clienteTabInitialized = useRef(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setTemplateModalOpen(false);
  }, [activePhone]);

  const resetConversationSearch = useCallback(() => {
    setConversationSearchOpen(false);
    setConversationSearchQuery('');
    setConversationSearchMatches([]);
    setConversationSearchIndex(0);
    setConversationSearchLoading(false);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedPhones(new Set());
    setBulkSelectionBusy(false);
  }, []);

  const scrollToMessageId = useCallback((id) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const ensureMessageInThread = useCallback((msg) => {
    if (!msg?.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  }, []);

  const goToConversationMatch = useCallback(
    (delta) => {
      setConversationSearchIndex((prevIdx) => {
        const total = conversationSearchMatches.length;
        if (!total) return 0;
        const next = delta === 'next' ? (prevIdx + 1) % total : (prevIdx - 1 + total) % total;
        const match = conversationSearchMatches[next];
        if (match?.id) {
          ensureMessageInThread(match);
          scrollToMessageId(match.id);
        }
        return next;
      });
    },
    [conversationSearchMatches, ensureMessageInThread, scrollToMessageId],
  );

  const searchMatchIds = useMemo(
    () => new Set(conversationSearchMatches.map((m) => m.id).filter((id) => id != null)),
    [conversationSearchMatches],
  );

  const activeSearchMessageId =
    conversationSearchOpen && conversationSearchMatches.length
      ? conversationSearchMatches[conversationSearchIndex]?.id
      : null;

  const searchHighlightTerm =
    conversationSearchOpen && conversationSearchQuery.trim().length >= 2 ? conversationSearchQuery.trim() : '';

  const loadConversations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoadingConversations(true);
      try {
        const res = await getConversations(0, CONVERSATIONS_PAGE_SIZE, {
          arquivadas: showArchivedView,
          clienteCodigo: selectedClienteCodigo || undefined,
        });
        const page0 = Array.isArray(res?.content) ? res.content : [];
        setConversationsTotalPages(Number(res?.totalPages ?? 0));
        if (silent) {
          setConversations((prev) => {
            if (prev.length <= CONVERSATIONS_PAGE_SIZE) {
              return showArchivedView ? page0 : sortConversationsByPinAndRecency(page0);
            }
            const page0Phones = new Set(page0.map((c) => normalizePhoneForApi(c.phoneNumber)));
            const older = prev
              .slice(CONVERSATIONS_PAGE_SIZE)
              .filter((c) => !page0Phones.has(normalizePhoneForApi(c.phoneNumber)));
            const merged = [...page0, ...older];
            return showArchivedView ? merged : sortConversationsByPinAndRecency(merged);
          });
        } else {
          setConversationsPageLoaded(0);
          setConversations(showArchivedView ? page0 : sortConversationsByPinAndRecency(page0));
        }
      } catch (err) {
        toast.error(err?.message || 'Erro ao carregar conversas.');
      } finally {
        if (!silent) setLoadingConversations(false);
      }
    },
    [getConversations, toast, showArchivedView, selectedClienteCodigo],
  );

  const handleLoadMoreConversations = useCallback(async () => {
    if (conversationsPageLoaded + 1 >= conversationsTotalPages) return;
    setLoadingMoreConversations(true);
    try {
      const nextPage = conversationsPageLoaded + 1;
      const res = await getConversations(nextPage, CONVERSATIONS_PAGE_SIZE, {
        arquivadas: showArchivedView,
        clienteCodigo: selectedClienteCodigo || undefined,
      });
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
  }, [conversationsPageLoaded, conversationsTotalPages, getConversations, toast, showArchivedView, selectedClienteCodigo]);

  useEffect(() => {
    if (!archiveViewInitialized.current) {
      archiveViewInitialized.current = true;
      return;
    }
    exitSelectionMode();
    setActivePhone('');
    setMessages([]);
    setConversationsPageLoaded(0);
    void loadConversations();
  }, [showArchivedView]); // eslint-disable-line react-hooks/exhaustive-deps -- recarrega ao trocar aba

  useEffect(() => {
    if (!clienteTabInitialized.current) {
      clienteTabInitialized.current = true;
      return;
    }
    setConversationsPageLoaded(0);
    void loadConversations();
  }, [selectedClienteCodigo]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch ao trocar cliente

  const recarregarGruposAbas = useCallback(async () => {
    try {
      const list = await getWhatsAppGrupos();
      const next = Array.isArray(list) ? list : [];
      setGrupos(next);
      setSelectedClienteCodigo((atual) =>
        atual && !next.some((g) => g.codigo === atual) ? null : atual,
      );
    } catch {
      /* mantém abas atuais */
    }
    void loadConversations({ silent: true });
  }, [loadConversations]);

  const abrirModalNovoGrupo = useCallback(() => {
    setModalGrupoModo('criar');
    setModalGrupoOpen(true);
  }, []);

  const abrirModalEditarGrupo = useCallback(() => {
    if (!selectedClienteCodigo) return;
    setModalGrupoModo('editar');
    setModalGrupoOpen(true);
  }, [selectedClienteCodigo]);

  const grupoSelecionado = useMemo(
    () => grupos.find((g) => g.codigo === selectedClienteCodigo) ?? null,
    [grupos, selectedClienteCodigo],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getWhatsAppGrupos();
        if (!cancelled) setGrupos(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setGrupos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const toggleConversationArchive = useCallback(
    (phone, shouldArchive) => {
      const normalized = normalizePhoneForApi(phone);
      if (!normalized) return;
      setConversations((prev) =>
        prev.filter((c) => normalizePhoneForApi(c.phoneNumber) !== normalized),
      );
      if (normalizePhoneForApi(activePhone) === normalized) {
        setActivePhone('');
        setMessages([]);
        setContactName('');
      }
      const api = shouldArchive ? arquivarConversa : desarquivarConversa;
      void api(normalized).catch((err) => {
        console.warn('[WhatsApp] arquivar/desarquivar falhou:', err?.message ?? err);
        void loadConversations();
      });
    },
    [activePhone, loadConversations],
  );

  const requestDeleteMessage = useCallback((message) => {
    if (!message?.id || message.id <= 0) return;
    setPendingDeleteMessage(message);
  }, []);

  const confirmDeleteMessage = useCallback(
    async (escopo = 'inbox') => {
      const message = pendingDeleteMessage;
      if (!message?.id) return;
      setPendingDeleteMessage(null);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setConversationSearchMatches((prev) => prev.filter((m) => m.id !== message.id));
      try {
        await apagarMensagem(message.id, { escopo });
      } catch (err) {
        const fallback =
          escopo === 'todos'
            ? 'Falha ao apagar mensagem para todos.'
            : 'Falha ao apagar mensagem.';
        toast.error(err?.message || fallback);
        if (activePhone) await fetchPage(activePhone, 0, false);
      }
    },
    [pendingDeleteMessage, toast, activePhone, fetchPage],
  );

  const requestDeleteConversation = useCallback((phone) => {
    const normalized = normalizePhoneForApi(phone);
    if (!normalized) return;
    setPendingDeleteConversationPhone(normalized);
  }, []);

  const confirmDeleteConversation = useCallback(async () => {
    const normalized = pendingDeleteConversationPhone;
    if (!normalized) return;
    setPendingDeleteConversationPhone('');
    setConversations((prev) => prev.filter((c) => normalizePhoneForApi(c.phoneNumber) !== normalized));
    if (normalizePhoneForApi(activePhone) === normalized) {
      setActivePhone('');
      setMessages([]);
      setContactName('');
      resetConversationSearch();
    }
    try {
      await apagarConversa(normalized);
    } catch (err) {
      toast.error(err?.message || 'Falha ao apagar conversa.');
      void loadConversations();
    }
  }, [pendingDeleteConversationPhone, activePhone, resetConversationSearch, loadConversations, toast]);

  const filteredConversations = useMemo(() => {
    const q = query.trim();
    if (!q) return conversations;
    return conversations.filter((conv) => conversationMatchesQuery(conv, q));
  }, [conversations, query]);

  const toggleSelectedPhone = useCallback((phone) => {
    const normalized = normalizePhoneForApi(phone);
    if (!normalized) return;
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) next.delete(normalized);
      else next.add(normalized);
      return next;
    });
  }, []);

  const selectAllVisiblePhones = useCallback(() => {
    setSelectedPhones(
      new Set(filteredConversations.map((c) => normalizePhoneForApi(c.phoneNumber)).filter(Boolean)),
    );
  }, [filteredConversations]);

  const handleBulkMarkRead = useCallback(async () => {
    const phones = [...selectedPhones];
    if (!phones.length || bulkSelectionBusy) return;
    setBulkSelectionBusy(true);
    setConversations((prev) => {
      const { conversations: next, unreadClearedCount } = zeroUnreadMultipleAndReport(prev, phones);
      if (unreadClearedCount) adjustUnreadConversations?.(-unreadClearedCount);
      return next;
    });
    exitSelectionMode();
    try {
      await marcarLidasLote(phones);
    } catch (err) {
      console.warn('[WhatsApp] marcar-lida lote falhou:', err?.message ?? err);
      void loadConversations();
    }
  }, [selectedPhones, bulkSelectionBusy, exitSelectionMode, loadConversations, adjustUnreadConversations]);

  const handleBulkPin = useCallback(async () => {
    const phones = [...selectedPhones];
    if (!phones.length || bulkSelectionBusy) return;
    setBulkSelectionBusy(true);
    setConversations((prev) => pinMultipleInConversationList(prev, phones));
    exitSelectionMode();
    try {
      await fixarConversasLote(phones);
    } catch (err) {
      console.warn('[WhatsApp] fixar lote falhou:', err?.message ?? err);
      void loadConversations();
    }
  }, [selectedPhones, bulkSelectionBusy, exitSelectionMode, loadConversations]);

  const handleBulkArchive = useCallback(async () => {
    const phones = [...selectedPhones];
    if (!phones.length || bulkSelectionBusy) return;
    setBulkSelectionBusy(true);
    setConversations((prev) =>
      prev.filter((c) => !selectedPhones.has(normalizePhoneForApi(c.phoneNumber))),
    );
    if (selectedPhones.has(normalizePhoneForApi(activePhone))) {
      setActivePhone('');
      setMessages([]);
      setContactName('');
      resetConversationSearch();
    }
    exitSelectionMode();
    try {
      await arquivarConversasLote(phones);
    } catch (err) {
      console.warn('[WhatsApp] arquivar lote falhou:', err?.message ?? err);
      void loadConversations();
    }
  }, [
    selectedPhones,
    bulkSelectionBusy,
    activePhone,
    exitSelectionMode,
    loadConversations,
    resetConversationSearch,
  ]);

  const selectionBulkActions = useMemo(
    () => [
      {
        id: 'read',
        label: 'Lidas',
        title: 'Marcar selecionadas como lidas',
        onClick: () => void handleBulkMarkRead(),
        disabled: selectedPhones.size === 0,
      },
      {
        id: 'pin',
        label: 'Fixar',
        title: 'Fixar selecionadas no topo',
        onClick: () => void handleBulkPin(),
        disabled: selectedPhones.size === 0,
      },
      {
        id: 'archive',
        label: 'Arquivar',
        title: 'Arquivar selecionadas',
        onClick: () => void handleBulkArchive(),
        primary: true,
        disabled: selectedPhones.size === 0,
      },
    ],
    [selectedPhones.size, handleBulkMarkRead, handleBulkPin, handleBulkArchive],
  );

  const openConversation = useCallback(
    async (phone, nameHint = '', contextosHint = null, photoHint = null) => {
      const normalized = normalizePhoneForApi(phone);
      if (!normalized) return;
      markConversationReadLocal(normalized);
      resetConversationSearch();
      setMobileHeaderMenuOpen(false);
      setActivePhone(normalized);
      setContactName(nameHint || '');
      setContactPhotoUrl(photoHint ?? null);
      setContactPhotoMenuOpen(false);
      setPendingContactPhotoFile(null);
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
    [fetchPage, setSearchParams, toast, markConversationReadLocal, resetConversationSearch],
  );

  const closeMobileConversation = useCallback(() => {
    setMobileHeaderMenuOpen(false);
    setContactPhotoMenuOpen(false);
    resetConversationSearch();
    setActivePhone('');
    setSearchParams({}, { replace: true });
  }, [resetConversationSearch, setSearchParams]);

  useEffect(() => {
    if (!conversationSearchOpen || !activePhone) return undefined;
    const term = conversationSearchQuery.trim();
    if (term.length < 2) {
      setConversationSearchMatches([]);
      setConversationSearchIndex(0);
      return undefined;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setConversationSearchLoading(true);
      try {
        const res = await searchMessages(normalizePhoneForApi(activePhone), term, ac.signal);
        const matches = Array.isArray(res?.matches) ? res.matches : [];
        setConversationSearchMatches(matches);
        setConversationSearchIndex(0);
        if (matches[0]?.id) {
          ensureMessageInThread(matches[0]);
          scrollToMessageId(matches[0].id);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.warn('[WhatsApp] busca na conversa falhou:', err?.message ?? err);
        }
        setConversationSearchMatches([]);
        setConversationSearchIndex(0);
      } finally {
        setConversationSearchLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [
    conversationSearchOpen,
    conversationSearchQuery,
    activePhone,
    searchMessages,
    ensureMessageInThread,
    scrollToMessageId,
  ]);

  useEffect(() => {
    if (!conversationSearchOpen) return;
    window.setTimeout(() => conversationSearchInputRef.current?.focus(), 0);
  }, [conversationSearchOpen]);

  const handleIniciarConversaSuccess = useCallback(
    async (phone, name) => {
      setIniciarModalOpen(false);
      try {
        await loadConversations({ silent: true });
      } catch {
        // lista pode estar desatualizada; conversa abre mesmo assim
      }
      await openConversation(phone, name);
    },
    [loadConversations, openConversation],
  );

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (isValidBrazilPhone(trimmed)) {
      await openConversation(trimmed);
      return;
    }

    const localMatches = conversations.filter((conv) => conversationMatchesQuery(conv, trimmed));
    if (localMatches.length === 1) {
      const conv = localMatches[0];
      await openConversation(conv.phoneNumber, conv.contactName, conv.contextos, conv.contactPhotoUrl);
      return;
    }
    if (localMatches.length > 1) {
      return;
    }

    setSearchingConversations(true);
    try {
      const remoto = await buscarConversasPorNome(trimmed);
      if (remoto.length === 1) {
        await openConversation(remoto[0].phone, remoto[0].name);
        return;
      }
      if (remoto.length > 1) {
        setConversations((prev) => {
          const existing = new Set(prev.map((c) => normalizePhoneForApi(c.phoneNumber)));
          const novos = remoto
            .filter((r) => r.phone && !existing.has(r.phone))
            .map((r) => ({
              phoneNumber: r.phone,
              contactName: r.name || null,
              lastMessagePreview: '',
              unreadCount: 0,
              pinned: false,
            }));
          return novos.length ? sortConversationsByPinAndRecency([...prev, ...novos]) : prev;
        });
        return;
      }
      toast.error('Nenhuma conversa encontrada para essa busca.');
    } catch (err) {
      toast.error(err?.message || 'Erro ao buscar conversas.');
    } finally {
      setSearchingConversations(false);
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
    setDraft('');
    setSending(true);
    try {
      const res = await sendText(activePhone, text);
      if (res?.success === false) {
        toast.error(res.error || FREE_TEXT_DELIVERY_ERROR);
        setDraft((prev) => (prev.trim() ? prev : text));
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
      toast.success('Mensagem enviada.');
      window.setTimeout(scrollToBottom, 50);
      loadConversations({ silent: true });
    } catch (err) {
      toast.error(err?.message || FREE_TEXT_DELIVERY_ERROR);
      setDraft((prev) => (prev.trim() ? prev : text));
    } finally {
      setSending(false);
    }
  };

  const applyMediaAttach = useCallback(
    (file) => {
      const result = handleAttachSelect(file);
      if (!result.ok) {
        toast.error(result.erro);
        setSelectedFile(null);
        setMediaCaption('');
        return;
      }
      setSelectedFile(result.file);
    },
    [toast],
  );

  const onPasteCompositor = useMemo(
    () =>
      criarOnPasteCompositor({
        conversaAtiva: Boolean(activePhone),
        onAttachFile: applyMediaAttach,
      }),
    [activePhone, applyMediaAttach],
  );

  const displayMessages = useMemo(() => enrichMessagesWithReactions(messages), [messages]);

  const {
    forwardSelectActive,
    forwardSelectedMessages,
    forwardModalOpen,
    startForwardSelection,
    toggleForwardSelection,
    cancelForwardSelection,
    openForwardModal,
    closeForwardModal,
    finishForwardSuccess,
    isForwardSelected,
    forwardSelectionCount,
  } = useWhatsAppForwardSelection(messages);

  useEffect(() => {
    cancelForwardSelection();
  }, [activePhone, cancelForwardSelection]);

  useCloseOnEscape(forwardSelectActive && !forwardModalOpen, cancelForwardSelection);

  const handleForwardSuccess = useCallback(
    (_response, destino) => {
      const n = forwardSelectedMessages.length;
      const rotulo =
        n === 1
          ? 'Mensagem encaminhada'
          : `${n} mensagens encaminhadas`;
      toast.success(
        `${rotulo} para ${destino?.contactName || formatPhoneDisplay(destino?.phoneNumber)}.`,
      );
      finishForwardSuccess();
      void loadConversations();
    },
    [toast, loadConversations, finishForwardSuccess, forwardSelectedMessages.length],
  );

  const lastOutboundTemplateMessage = useMemo(
    () => findLastOutboundTemplateMessage(messages),
    [messages],
  );

  const contextoVinculoAtivo = useMemo(() => {
    const ctx = contextosAtivos[indiceContexto] ?? contextosAtivos[0];
    if (!ctx) return null;
    return {
      clienteId: ctx.clienteId ?? null,
      processoId: ctx.processoId ?? null,
    };
  }, [contextosAtivos, indiceContexto]);

  const handleTemplateSendSuccess = useCallback(
    async ({ templateName, params }) => {
      const preview = params.filter(Boolean).join(', ') || templateName;
      setMessages((prev) => [
        ...prev,
        {
          id: `local-template-${Date.now()}`,
          direction: 'OUTBOUND',
          messageType: 'TEMPLATE',
          templateName,
          content: preview,
          status: 'SENT',
          createdAt: new Date().toISOString(),
          phoneNumber: activePhone,
        },
      ]);
      toast.success('Template enviado.');
      window.setTimeout(scrollToBottom, 50);
      loadConversations({ silent: true });
      try {
        await fetchPage(activePhone, 0, false);
        window.setTimeout(scrollToBottom, 50);
      } catch {
        /* mantém mensagem otimista */
      }
    },
    [activePhone, fetchPage, loadConversations, toast],
  );

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
    if (conv) {
      setContactPhotoUrl(conv.contactPhotoUrl ?? null);
    }
  }, [conversations, activePhone]);

  const handleContactPhotoFileSelect = useCallback(
    (file) => {
      const result = handleAttachSelect(file);
      if (!result.ok) {
        toast.error(result.erro);
        return;
      }
      if (result.categoria !== 'image') {
        toast.error('Selecione uma imagem JPEG ou PNG.');
        return;
      }
      setContactPhotoMenuOpen(false);
      setPendingContactPhotoFile(result.file);
    },
    [toast],
  );

  const confirmContactPhotoUpload = useCallback(async () => {
    if (!activePhone || !pendingContactPhotoFile || contactPhotoBusy) return;
    const file = pendingContactPhotoFile;
    const optimisticUrl = contactPhotoProxyUrl(activePhone);
    setPendingContactPhotoFile(null);
    setContactPhotoBusy(true);
    invalidateWhatsAppContactPhotoObjectUrl(activePhone);
    setContactPhotoUrl(optimisticUrl);
    setConversations((prev) => updateContactPhotoInList(prev, activePhone, optimisticUrl));
    try {
      const res = await definirFotoContato(activePhone, file);
      const url = res?.contactPhotoUrl || optimisticUrl;
      invalidateWhatsAppContactPhotoObjectUrl(activePhone);
      setContactPhotoUrl(url);
      setConversations((prev) => updateContactPhotoInList(prev, activePhone, url));
      toast.success('Foto atualizada.');
    } catch (err) {
      invalidateWhatsAppContactPhotoObjectUrl(activePhone);
      setContactPhotoUrl(null);
      setConversations((prev) => updateContactPhotoInList(prev, activePhone, null));
      toast.error(err?.message || 'Erro ao definir foto.');
      void loadConversations();
    } finally {
      setContactPhotoBusy(false);
    }
  }, [activePhone, pendingContactPhotoFile, contactPhotoBusy, toast, loadConversations]);

  const removeContactPhoto = useCallback(async () => {
    if (!activePhone || contactPhotoBusy) return;
    setContactPhotoMenuOpen(false);
    setContactPhotoBusy(true);
    invalidateWhatsAppContactPhotoObjectUrl(activePhone);
    setContactPhotoUrl(null);
    setConversations((prev) => updateContactPhotoInList(prev, activePhone, null));
    try {
      await removerFotoContato(activePhone);
      toast.success('Foto removida.');
    } catch (err) {
      toast.error(err?.message || 'Erro ao remover foto.');
      void loadConversations();
    } finally {
      setContactPhotoBusy(false);
    }
  }, [activePhone, contactPhotoBusy, toast, loadConversations]);

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
    if (!latestStatusUpdate?.waMessageId) return;
    setMessages((prev) => mergeMessageStatusUpdate(prev, latestStatusUpdate));
  }, [latestStatusUpdate]);

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
      openConversation(fromUrl, conv?.contactName, conv?.contextos, conv?.contactPhotoUrl);
    }
  }, [conversations, openConversation, searchParams]);

  useEffect(() => {
    if (messages.length && !loadingMore) scrollToBottom();
  }, [messages.length, loadingMore]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex min-h-0 flex-1 flex-col md:flex-row gap-0 overflow-hidden max-w-6xl w-full mx-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm max-md:min-h-[calc(100dvh-11rem)] md:h-[calc(100dvh-12rem)]"
      >
      <aside
        className={`w-full md:w-80 shrink-0 flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 min-h-0 ${
          activePhone ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-3 shrink-0 border-b border-slate-200 dark:border-slate-700 space-y-2">
          <button
            type="button"
            onClick={() => setIniciarModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-700 to-green-800 hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/25 ring-1 ring-white/15 transition-all duration-150"
          >
            <MessageSquarePlus className="w-4 h-4" aria-hidden />
            Nova conversa
          </button>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setShowArchivedView(false)}
              className={`flex-1 px-2 py-1.5 transition-colors ${
                !showArchivedView
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-900/60 text-slate-500 hover:text-slate-700'
              }`}
            >
              Ativas
            </button>
            <button
              type="button"
              onClick={() => setShowArchivedView(true)}
              className={`flex-1 px-2 py-1.5 transition-colors border-l border-slate-200 dark:border-slate-600 ${
                showArchivedView
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-900/60 text-slate-500 hover:text-slate-700'
              }`}
            >
              Arquivadas
            </button>
          </div>
          {!showArchivedView ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectionMode) exitSelectionMode();
                  else setSelectionMode(true);
                }}
                className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  selectionMode
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {selectionMode ? 'Sair da seleção' : 'Selecionar'}
              </button>
              {selectionMode ? (
                <button
                  type="button"
                  onClick={selectAllVisiblePhones}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  title="Selecionar todas as conversas visíveis"
                >
                  Todas
                </button>
              ) : null}
            </div>
          ) : null}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="search"
              className={chatComposeInputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversa ou telefone"
            />
            <button type="submit" className={chatComposeBtnClass} disabled={loading || searchingConversations} title="Buscar conversa ou telefone">
              {loading || searchingConversations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
          <div className="space-y-1.5">
            <div
              className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scroll-smooth items-center"
              role="tablist"
              aria-label="Filtrar por grupo"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!selectedClienteCodigo}
                onClick={() => setSelectedClienteCodigo(null)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !selectedClienteCodigo
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-emerald-400'
                }`}
              >
                Todas
              </button>
              {grupos.map((grupo) => {
                const ativo = selectedClienteCodigo === grupo.codigo;
                const label =
                  grupo.qtdConversas > 0 ? `${grupo.nome} (${grupo.qtdConversas})` : grupo.nome;
                return (
                  <button
                    key={grupo.codigo}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    title={label}
                    onClick={() => setSelectedClienteCodigo(grupo.codigo)}
                    className={`shrink-0 max-w-[10rem] truncate px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      ativo
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-emerald-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={abrirModalNovoGrupo}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Plus className="h-3.5 w-3.5" />
                Grupo
              </button>
            </div>
            {grupoSelecionado ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={abrirModalEditarGrupo}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  <Pencil className="h-3 w-3" />
                  Editar grupo «{grupoSelecionado.nome}»
                </button>
              </div>
            ) : null}
          </div>
        </div>

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
                ? showArchivedView
                  ? 'Nenhuma conversa arquivada.'
                  : selectedClienteCodigo
                    ? 'Nenhuma conversa para este cliente.'
                    : 'Nenhuma conversa ainda. Envie uma mensagem em "Enviar mensagem" para iniciar.'
                : 'Nenhuma conversa corresponde à busca.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredConversations.map((conv) => {
                const normalizedPhone = normalizePhoneForApi(conv.phoneNumber);
                const selected = normalizedPhone === activePhone;
                const hasUnread = unreadCountOf(conv) > 0;
                const isPinned = Boolean(conv.pinned);
                const isChecked = selectedPhones.has(normalizedPhone);
                const rowClassName = `group w-full text-left px-3 py-3 hover:bg-white dark:hover:bg-slate-800 transition-colors flex gap-2.5 ${
                  selected && !selectionMode
                    ? 'bg-white dark:bg-slate-800 border-l-4 border-emerald-600'
                    : 'border-l-4 border-transparent'
                } ${isPinned && !selectionMode ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''} ${
                  selectionMode && isChecked ? 'bg-emerald-50/80 dark:bg-emerald-950/30' : ''
                }`;

                const rowContent = (
                  <>
                    {selectionMode ? (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        tabIndex={-1}
                        className="mt-2 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        aria-label={`Selecionar ${tituloContato(conv.contactName, conv.phoneNumber)}`}
                      />
                    ) : null}
                    <WhatsAppContactAvatar
                      nome={conv.contactName}
                      telefone={conv.phoneNumber}
                      contactPhotoUrl={conv.contactPhotoUrl}
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
                          {!selectionMode && !showArchivedView ? (
                            <WhatsAppConversationPinButton
                              pinned={isPinned}
                              onToggle={() => toggleConversationPin(conv.phoneNumber, isPinned)}
                            />
                          ) : null}
                          {!selectionMode ? (
                            <WhatsAppConversationArchiveButton
                              archivedView={showArchivedView}
                              onToggle={() => toggleConversationArchive(conv.phoneNumber, !showArchivedView)}
                            />
                          ) : null}
                          {!selectionMode && !showArchivedView ? (
                            <WhatsAppConversationDeleteButton
                              onDelete={() => requestDeleteConversation(conv.phoneNumber)}
                            />
                          ) : null}
                          <WhatsAppUnreadBadge count={conv.unreadCount} />
                          <span
                            className="text-[10px] text-slate-400"
                            title={formatDateTimeBR(conv.lastMessageAt)}
                          >
                            {formatRelativeConversationTime(conv.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                      {String(conv.contactName ?? '').trim() ? (
                        <p className="text-xs text-slate-500 truncate">{formatPhoneDisplay(conv.phoneNumber)}</p>
                      ) : null}
                      <ContextoProcessoLinha ctx={conv.contextoPrincipal} className="mt-0.5" />
                      <p className="text-xs text-slate-500 truncate mt-0.5">{previewText(conv)}</p>
                    </div>
                  </>
                );

                return (
                  <li key={conv.phoneNumber}>
                    {selectionMode ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSelectedPhone(conv.phoneNumber)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleSelectedPhone(conv.phoneNumber);
                          }
                        }}
                        className={`${rowClassName} cursor-pointer`}
                      >
                        {rowContent}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openConversation(conv.phoneNumber, conv.contactName, conv.contextos, conv.contactPhotoUrl)}
                        className={rowClassName}
                      >
                        {rowContent}
                      </button>
                    )}
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
        <WhatsAppConversationSelectionBar
          selectedCount={selectionMode ? selectedPhones.size : 0}
          actions={selectionBulkActions}
          onCancel={exitSelectionMode}
          busy={bulkSelectionBusy}
        />
      </aside>

      <section
        className={`flex-1 min-w-0 flex-col min-h-0 md:min-h-[280px] ${
          activePhone ? 'flex max-md:flex-1' : 'hidden md:flex'
        }`}
      >
        {!activePhone ? (
          <div className="hidden md:flex flex-1 items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-800/20">
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
            <div className="shrink-0 px-2 md:px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              {/* Cabeçalho mobile — uma linha enxuta */}
              <div className="md:hidden flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={closeMobileConversation}
                  className="shrink-0 inline-flex items-center justify-center rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Voltar para lista de conversas"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setContactPhotoMenuOpen((open) => !open)}
                    disabled={contactPhotoBusy}
                    className="rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                    title="Foto do contato"
                    aria-label="Foto do contato"
                  >
                    <WhatsAppContactAvatar
                      nome={contactName}
                      telefone={activePhone}
                      contactPhotoUrl={contactPhotoUrl}
                      size="sm"
                    />
                  </button>
                  {contactPhotoMenuOpen ? (
                    <div className="absolute top-full left-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => contactPhotoFileInputRef.current?.click()}
                        disabled={contactPhotoBusy}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        <Camera className="h-3.5 w-3.5 shrink-0" />
                        Definir foto
                      </button>
                      {contactPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() => void removeContactPhoto()}
                          disabled={contactPhotoBusy}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
                        >
                          <ImageMinus className="h-3.5 w-3.5 shrink-0" />
                          Remover foto
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {tituloContato(contactName, activePhone)}
                  </p>
                  {String(contactName ?? '').trim() ? (
                    <p className="text-[11px] text-slate-500 tabular-nums truncate">
                      {formatPhoneDisplay(activePhone)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileHeaderMenuOpen(false);
                    setConversationSearchOpen(true);
                  }}
                  className={`shrink-0 inline-flex items-center justify-center rounded-lg border p-1.5 ${
                    conversationSearchOpen
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                  title="Buscar no histórico"
                  aria-label="Buscar no histórico"
                >
                  <Search className="h-4 w-4" />
                </button>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMobileHeaderMenuOpen((open) => !open)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    aria-label="Mais ações"
                    aria-expanded={mobileHeaderMenuOpen}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {mobileHeaderMenuOpen ? (
                    <div className="absolute top-full right-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileHeaderMenuOpen(false);
                          setModalVinculosAberto(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                        Vínculos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileHeaderMenuOpen(false);
                          requestDeleteConversation(activePhone);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        Apagar conversa
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Cabeçalho desktop — inalterado */}
              <div className="hidden md:flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setContactPhotoMenuOpen((open) => !open)}
                      disabled={contactPhotoBusy}
                      className="rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                      title="Foto do contato"
                      aria-label="Foto do contato"
                      aria-expanded={contactPhotoMenuOpen}
                    >
                      <WhatsAppContactAvatar
                        nome={contactName}
                        telefone={activePhone}
                        contactPhotoUrl={contactPhotoUrl}
                        size="md"
                      />
                    </button>
                    {contactPhotoMenuOpen ? (
                      <div className="absolute top-full left-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => contactPhotoFileInputRef.current?.click()}
                          disabled={contactPhotoBusy}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                          <Camera className="h-3.5 w-3.5 shrink-0" />
                          Definir foto
                        </button>
                        {contactPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => void removeContactPhoto()}
                            disabled={contactPhotoBusy}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
                          >
                            <ImageMinus className="h-3.5 w-3.5 shrink-0" />
                            Remover foto
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <input
                      ref={contactPhotoFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      disabled={contactPhotoBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        if (file) handleContactPhotoFileSelect(file);
                      }}
                    />
                  </div>
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
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConversationSearchOpen(true)}
                    className={`inline-flex items-center justify-center rounded-lg border p-1.5 text-xs font-semibold hover:bg-white dark:hover:bg-slate-700 ${
                      conversationSearchOpen
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                    title="Buscar no histórico da conversa"
                    aria-label="Buscar no histórico da conversa"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalVinculosAberto(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    title="Buscar pessoas e vínculos (cód. + proc.) deste telefone"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Vínculos
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDeleteConversation(activePhone)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                    title="Apagar conversa da inbox (não apaga no WhatsApp do contato)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar
                  </button>
                </div>
              </div>
              <input
                ref={contactPhotoFileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={contactPhotoBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  if (file) handleContactPhotoFileSelect(file);
                }}
              />
              {pendingContactPhotoFile ? (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <WhatsAppMediaAttachPreview
                    selectedFile={pendingContactPhotoFile}
                    onClearFile={() => setPendingContactPhotoFile(null)}
                    disabled={contactPhotoBusy}
                    containerClass="space-y-2"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingContactPhotoFile(null)}
                      disabled={contactPhotoBusy}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmContactPhotoUpload()}
                      disabled={contactPhotoBusy}
                      className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {contactPhotoBusy ? 'Salvando…' : 'Salvar foto'}
                    </button>
                  </div>
                </div>
              ) : null}
              {conversationSearchOpen ? (
                <ConversationMessageSearchBar
                  query={conversationSearchQuery}
                  onQueryChange={setConversationSearchQuery}
                  onClose={resetConversationSearch}
                  total={conversationSearchMatches.length}
                  currentIndex={conversationSearchIndex}
                  onPrev={() => goToConversationMatch('prev')}
                  onNext={() => goToConversationMatch('next')}
                  loading={conversationSearchLoading}
                  inputRef={conversationSearchInputRef}
                />
              ) : null}
              <PainelContextoChat
                contextos={contextosAtivos}
                indice={indiceContexto}
                onIndiceChange={setIndiceContexto}
              />
              <WhatsAppConversationGruposPanel
                phoneNumber={activePhone}
                onChanged={() => void recarregarGruposAbas()}
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
              {displayMessages.map((msg, idx) => {
                const prevKey = idx > 0 ? dateKeyBR(displayMessages[idx - 1].createdAt) : null;
                const curKey = dateKeyBR(msg.createdAt);
                const showDaySep = idx === 0 || curKey !== prevKey;
                return (
                  <Fragment key={msg.id ?? msg.waMessageId}>
                    {showDaySep ? <DaySeparator iso={msg.createdAt} /> : null}
                    <ChatBubble
                      message={msg}
                      onRetryOutboundMedia={handleRetryOutboundMedia}
                      onLocalPreviewConsumed={handleLocalPreviewConsumed}
                      highlightTerm={searchMatchIds.has(msg.id) ? searchHighlightTerm : ''}
                      isActiveSearchMatch={msg.id != null && msg.id === activeSearchMessageId}
                      onDeleteMessage={requestDeleteMessage}
                      onForwardMessage={startForwardSelection}
                      forwardSelectMode={forwardSelectActive}
                      forwardSelected={isForwardSelected(msg)}
                      onToggleForwardSelect={toggleForwardSelection}
                    />
                  </Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {forwardSelectActive ? (
              <ForwardSelectionBar
                count={forwardSelectionCount}
                onCancel={cancelForwardSelection}
                onForward={openForwardModal}
              />
            ) : null}
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
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(true)}
                  className="inline-flex shrink-0 flex-none items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                  title="Enviar mensagem por template (reenviar anterior ou escolher outro)"
                >
                  <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Template</span>
                </button>
                <input
                  type="text"
                  className={chatComposeInputClass}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={onPasteCompositor}
                  placeholder={selectedFile ? 'Ou envie só o anexo…' : 'Digite uma mensagem…'}
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
              <p className="hidden md:block text-[11px] text-amber-700 dark:text-amber-300/90 px-1">{FREE_TEXT_WINDOW_HINT}</p>
            </form>
          </>
        )}
      </section>

      <ModalVinculosTelefoneConversa
        open={modalVinculosAberto}
        telefone={activePhone}
        onClose={() => setModalVinculosAberto(false)}
      />
      <IniciarConversaModal
        open={iniciarModalOpen}
        onClose={() => setIniciarModalOpen(false)}
        onSuccess={handleIniciarConversaSuccess}
      />
      <EnviarTemplateConversaModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        phoneNumber={activePhone}
        contactName={contactName}
        lastTemplateMessage={lastOutboundTemplateMessage}
        contextoVinculo={contextoVinculoAtivo}
        onSuccess={handleTemplateSendSuccess}
      />
      <WhatsAppDeleteMessageDialog
        open={Boolean(pendingDeleteMessage)}
        message={pendingDeleteMessage}
        onDeleteInbox={() => void confirmDeleteMessage('inbox')}
        onDeleteForEveryone={() => void confirmDeleteMessage('todos')}
        onCancel={() => setPendingDeleteMessage(null)}
      />
      <EncaminharMensagemModal
        open={forwardModalOpen}
        messages={forwardSelectedMessages}
        sourcePhoneNumber={activePhone}
        onClose={closeForwardModal}
        onSuccess={handleForwardSuccess}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteConversationPhone)}
        title={WHATSAPP_DELETE_CONVERSATION_CONFIRM.title}
        message={WHATSAPP_DELETE_CONVERSATION_CONFIRM.message}
        confirmLabel={WHATSAPP_DELETE_CONVERSATION_CONFIRM.confirmLabel}
        onConfirm={() => void confirmDeleteConversation()}
        onCancel={() => setPendingDeleteConversationPhone('')}
        danger
      />
      <ModalGrupoWhatsApp
        open={modalGrupoOpen}
        modo={modalGrupoModo}
        grupoInicial={grupoSelecionado}
        onClose={() => setModalGrupoOpen(false)}
        onSalvo={() => void recarregarGruposAbas()}
      />
      </div>
    </div>
  );
}
