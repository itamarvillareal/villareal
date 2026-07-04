import { normalizePhoneForApi } from '../../../utils/whatsappFormat.js';

function recencyMs(conv) {
  const t = conv?.lastMessageAt;
  if (!t) return 0;
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Fixadas primeiro; dentro de cada grupo, lastMessageAt desc (mesma regra do backend). */
export function sortConversationsByPinAndRecency(conversations) {
  if (!Array.isArray(conversations) || conversations.length <= 1) {
    return Array.isArray(conversations) ? [...conversations] : [];
  }
  const pinned = [];
  const rest = [];
  for (const c of conversations) {
    if (c?.pinned) pinned.push(c);
    else rest.push(c);
  }
  const byRecency = (a, b) => recencyMs(b) - recencyMs(a);
  pinned.sort(byRecency);
  rest.sort(byRecency);
  return [...pinned, ...rest];
}

export function togglePinInConversationList(conversations, phone, pinned) {
  const normalized = normalizePhoneForApi(phone);
  if (!normalized || !Array.isArray(conversations)) return conversations ?? [];
  const next = conversations.map((c) =>
    normalizePhoneForApi(c.phoneNumber) === normalized ? { ...c, pinned: Boolean(pinned) } : c,
  );
  return sortConversationsByPinAndRecency(next);
}
