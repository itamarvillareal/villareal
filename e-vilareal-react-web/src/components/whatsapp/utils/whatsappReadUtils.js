import { marcarConversaLida } from '../../../repositories/whatsappRepository.js';
import { normalizePhoneForApi } from '../../../utils/whatsappFormat.js';
import { unreadCountOf } from '../components/WhatsAppUnreadBadge.jsx';

export function zeroUnreadInConversations(conversations, phone) {
  const normalized = normalizePhoneForApi(phone);
  if (!normalized) return conversations;
  return conversations.map((c) =>
    normalizePhoneForApi(c.phoneNumber) === normalized ? { ...c, unreadCount: 0 } : c,
  );
}

/** Fire-and-forget: não bloqueia UI; falha só vai pro console. */
export function marcarConversaLidaAsync(phoneNumber) {
  void marcarConversaLida(phoneNumber).catch((err) => {
    console.warn('[WhatsApp] marcar-lida falhou:', err?.message ?? err);
  });
}

/**
 * Aplica INBOUND SSE à lista em memória: sobe pro topo, atualiza preview e incrementa unread
 * (exceto conversa ativa, que permanece 0; REACTION não incrementa não-lida).
 * @returns {{ conversations, found, wasUnread, becameUnread }}
 */
export function applyInboundToConversationList(conversations, inbound, activePhone) {
  const isReaction = String(inbound?.messageType ?? '').toUpperCase() === 'REACTION';
  if (String(inbound?.direction ?? '').toUpperCase() !== 'INBOUND') {
    return { conversations, found: false, wasUnread: false, becameUnread: false };
  }

  const phone = normalizePhoneForApi(inbound.phoneNumber);
  if (!phone) return { conversations, found: false, wasUnread: false, becameUnread: false };

  const isActive = Boolean(activePhone && normalizePhoneForApi(activePhone) === phone);
  const idx = conversations.findIndex((c) => normalizePhoneForApi(c.phoneNumber) === phone);

  if (idx < 0) {
    return { conversations, found: false, wasUnread: false, becameUnread: false };
  }

  const conv = conversations[idx];
  const wasUnread = unreadCountOf(conv) > 0;
  const updated = {
    ...conv,
    lastMessagePreview: inbound.content ?? conv.lastMessagePreview,
    lastMessageContent: inbound.content ?? conv.lastMessageContent,
    lastMessageType: inbound.messageType ?? conv.lastMessageType,
    lastMessageDirection: 'INBOUND',
    lastMessageAt: inbound.createdAt ?? conv.lastMessageAt,
    unreadCount: isActive ? 0 : isReaction ? unreadCountOf(conv) : unreadCountOf(conv) + 1,
    contactName: inbound.contactName || conv.contactName,
  };

  const rest = conversations.filter((_, i) => i !== idx);
  const becameUnread = !isActive && !wasUnread && !isReaction;

  return {
    conversations: [updated, ...rest],
    found: true,
    wasUnread,
    becameUnread,
  };
}

export function countUnreadConversations(conversations) {
  if (!Array.isArray(conversations)) return 0;
  return conversations.filter((c) => unreadCountOf(c) > 0).length;
}

/** Zera unread e retorna se havia não-lidas antes (para ajuste do total global). */
export function zeroUnreadAndReportHadUnread(conversations, phone) {
  const normalized = normalizePhoneForApi(phone);
  if (!normalized) return { conversations, hadUnread: false };
  let hadUnread = false;
  const next = conversations.map((c) => {
    if (normalizePhoneForApi(c.phoneNumber) !== normalized) return c;
    if (unreadCountOf(c) > 0) hadUnread = true;
    return { ...c, unreadCount: 0 };
  });
  return { conversations: next, hadUnread };
}
